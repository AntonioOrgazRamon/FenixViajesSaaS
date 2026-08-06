import type { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../infrastructure/db';
import { config } from '../../common/config';
import { logger } from '../../common/logger';
import {
  mapTripRowDbToSearchRow,
  travelSearchTripSelect,
} from '../travel/travel-search.service';
import { buildTripEmbeddingDocument } from './embedding/trip-embedding-document';
import { embeddingService } from './embedding/embedding.service';
import { HYBRID_RETRIEVAL_PROFILE_VERSION } from './constants';

const MODEL = () => config.TRAVEL_EMBEDDING_MODEL;

export type SyncTripEmbeddingResult = {
  tripId: string;
  skipped: boolean;
  reason?: string;
  contentHash?: string;
  dims?: number;
};

export async function syncTripEmbeddingForTrip(
  companyId: string,
  tripId: string,
  opts?: { dryRun?: boolean; force?: boolean },
): Promise<SyncTripEmbeddingResult> {
  const trip = await prisma.travelTrip.findFirst({
    where: { id: tripId, companyId, status: 'APPROVED' },
    select: travelSearchTripSelect,
  });
  if (!trip) {
    throw new Error('Viaje no encontrado, no APPROVED o no pertenece al tenant');
  }

  const row = mapTripRowDbToSearchRow(trip);
  const doc = buildTripEmbeddingDocument(row);

  if (opts?.dryRun) {
    return { tripId, skipped: true, reason: 'dry-run', contentHash: doc.contentHash };
  }

  const existing = await prisma.travelTripEmbedding.findUnique({
    where: {
      companyId_tripId_model: { companyId, tripId, model: MODEL() },
    },
    select: { contentHash: true },
  });
  if (existing?.contentHash === doc.contentHash && !opts?.force) {
    return { tripId, skipped: true, reason: 'unchanged_hash', contentHash: doc.contentHash };
  }

  const emb = await embeddingService.embedText(doc.content, doc.contentHash, { companyId });

  await prisma.travelTripEmbedding.upsert({
    where: {
      companyId_tripId_model: { companyId, tripId, model: MODEL() },
    },
    create: {
      id: uuidv4(),
      companyId,
      tripId,
      model: MODEL(),
      dims: emb.dims,
      vector: emb.vector as unknown as Prisma.InputJsonValue,
      contentHash: doc.contentHash,
      content: doc.content.slice(0, 65_000),
      metadata: {
        ...doc.metadata,
        profileVersionLabel: HYBRID_RETRIEVAL_PROFILE_VERSION,
      } as Prisma.InputJsonValue,
      profileVersion: 1,
    },
    update: {
      dims: emb.dims,
      vector: emb.vector as unknown as Prisma.InputJsonValue,
      contentHash: doc.contentHash,
      content: doc.content.slice(0, 65_000),
      metadata: {
        ...doc.metadata,
        profileVersionLabel: HYBRID_RETRIEVAL_PROFILE_VERSION,
      } as Prisma.InputJsonValue,
    },
  });

  logger.info({ companyId, tripId, dims: emb.dims }, 'TravelTrip embedding guardado');

  return { tripId, skipped: false, contentHash: doc.contentHash, dims: emb.dims };
}

export type RebuildEmbeddingsSummary = {
  companyId: string;
  dryRun: boolean;
  limit: number | null;
  processed: number;
  embedded: number;
  skipped: number;
  errors: { tripId: string; message: string }[];
};

export async function rebuildCompanyTripEmbeddings(
  companyId: string,
  opts?: { dryRun?: boolean; limit?: number; force?: boolean },
): Promise<RebuildEmbeddingsSummary> {
  const dryRun = Boolean(opts?.dryRun);
  const limit = opts?.limit != null && opts.limit > 0 ? opts.limit : null;

  const trips = await prisma.travelTrip.findMany({
    where: { companyId, status: 'APPROVED' },
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
    ...(limit ? { take: limit } : {}),
  });

  const out: RebuildEmbeddingsSummary = {
    companyId,
    dryRun,
    limit,
    processed: 0,
    embedded: 0,
    skipped: 0,
    errors: [],
  };

  for (const t of trips) {
    out.processed++;
    try {
      const r = await syncTripEmbeddingForTrip(companyId, t.id, {
        dryRun,
        force: opts?.force,
      });
      if (r.skipped) out.skipped++;
      else out.embedded++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      out.errors.push({ tripId: t.id, message: msg });
      logger.warn({ err: e, tripId: t.id, companyId }, 'Fallo embedding trip');
    }
  }

  return out;
}

export async function getEmbeddingStatusForCompany(companyId: string): Promise<{
  approvedTripCount: number;
  embeddingRowCount: number;
  model: string;
}> {
  const model = MODEL();
  const [approvedTripCount, embeddingRowCount] = await Promise.all([
    prisma.travelTrip.count({ where: { companyId, status: 'APPROVED' } }),
    prisma.travelTripEmbedding.count({ where: { companyId, model } }),
  ]);
  return { approvedTripCount, embeddingRowCount, model };
}
