import { randomUUID } from 'crypto';
import type { Prisma, TravelMediaJobStatus } from '@prisma/client';
import prisma from '../../../infrastructure/db';
import { config } from '../../../common/config';
import { logger } from '../../../common/logger';
import { buildTravelMediaQueries, type TripForMediaQuery } from './travel-media-query-builder';
import { createUnsplashProvider } from './unsplash.provider';
import { createPexelsProvider } from './pexels.provider';
import type { NormalizedTravelPhoto } from './travel-media.types';
import type { TravelImageSearchProvider } from './travel-media.types';

const tripIncludeForMedia = {
  tripDestinations: { include: { destination: true } },
  highlights: { orderBy: { orderIndex: 'asc' as const } },
  itineraryDays: { orderBy: { dayNumber: 'asc' as const } },
} as const;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function dedupePhotos(photos: NormalizedTravelPhoto[]): NormalizedTravelPhoto[] {
  const seenUrl = new Set<string>();
  const seenProv = new Set<string>();
  const out: NormalizedTravelPhoto[] = [];
  for (const p of photos) {
    const u = p.imageUrl.trim().toLowerCase();
    const k = `${p.sourceProvider}:${p.providerAssetId}`;
    if (seenUrl.has(u) || seenProv.has(k)) continue;
    seenUrl.add(u);
    seenProv.add(k);
    out.push(p);
  }
  return out;
}

function pickPrimaryIndex(photos: { width: number | null; height: number | null }[]): number {
  if (!photos.length) return 0;
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < photos.length; i++) {
    const w = photos[i].width ?? 0;
    const h = photos[i].height ?? 1;
    const landscapeBoost = w >= h ? 1.2 : 1;
    const minOk = w >= 640;
    const score = (minOk ? w : w * 0.5) * landscapeBoost;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

export class TravelMediaEnrichmentService {
  private providers(): {
    primary: TravelImageSearchProvider | null;
    fallback: TravelImageSearchProvider | null;
    primaryName: string;
  } {
    const unsplashKey = config.UNSPLASH_ACCESS_KEY?.trim();
    const pexelsKey = config.PEXELS_API_KEY?.trim();
    const unsplash = unsplashKey ? createUnsplashProvider(unsplashKey) : null;
    const pexels = pexelsKey ? createPexelsProvider(pexelsKey) : null;
    if (config.TRAVEL_MEDIA_PROVIDER === 'pexels') {
      return { primary: pexels, fallback: unsplash, primaryName: 'pexels' };
    }
    return { primary: unsplash, fallback: pexels, primaryName: 'unsplash' };
  }

  async runForTrip(companyId: string, tripId: string): Promise<void> {
    if (!config.TRAVEL_MEDIA_ENABLED) {
      logger.info({ companyId, tripId }, 'TRAVEL_MEDIA_ENABLED=false: skip enrichment');
      return;
    }
    const { primary, fallback, primaryName } = this.providers();
    if (!primary && !fallback) {
      logger.warn({ companyId, tripId }, 'Travel media: no UNSPLASH_ACCESS_KEY ni PEXELS_API_KEY');
      return;
    }

    const jobId = randomUUID();
    await prisma.travelMediaJob.create({
      data: {
        id: jobId,
        companyId,
        tripId,
        status: 'PENDING',
      },
    });

    const trip = await prisma.travelTrip.findFirst({
      where: { id: tripId, companyId, status: 'APPROVED' },
      include: tripIncludeForMedia,
    });
    if (!trip) {
      await prisma.travelMediaJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorMessage: 'Viaje no encontrado o no está APPROVED',
        },
      });
      return;
    }

    await prisma.travelMediaJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    const queries = buildTravelMediaQueries(trip as TripForMediaQuery);
    const maxImages = config.TRAVEL_MEDIA_MAX_IMAGES;
    const collected: NormalizedTravelPhoto[] = [];
    const errors: string[] = [];
    let providerUsed = '';

    async function runProvider(
      label: string,
      provider: TravelImageSearchProvider | null,
      perQuery: number,
    ) {
      if (!provider) return;
      providerUsed = providerUsed ? `${providerUsed}+${label}` : label;
      for (const q of queries) {
        if (collected.length >= maxImages) break;
        try {
          const batch = await provider.searchLandscapes(q, perQuery);
          for (const p of batch) {
            if (collected.length >= maxImages) break;
            collected.push(p);
          }
        } catch (e) {
          errors.push(`${label}:${q.slice(0, 40)}: ${e instanceof Error ? e.message : String(e)}`);
        }
        await sleep(220);
      }
    }

    try {
      await runProvider(primaryName, primary, 4);
      if (collected.length < maxImages && fallback) {
        await runProvider(fallback.name, fallback, 3);
      }

      const unique = dedupePhotos(collected).slice(0, maxImages);
      const primaryIdx = pickPrimaryIndex(unique);

      await prisma.$transaction(async (tx) => {
        await tx.travelMediaAsset.deleteMany({ where: { tripId } });
        for (let i = 0; i < unique.length; i++) {
          const p = unique[i];
          await tx.travelMediaAsset.create({
            data: {
              id: randomUUID(),
              companyId,
              tripId,
              sourceProvider: p.sourceProvider,
              queryUsed: p.queryUsed.slice(0, 500),
              imageUrl: p.imageUrl.slice(0, 2048),
              thumbnailUrl: p.thumbnailUrl ? p.thumbnailUrl.slice(0, 2048) : null,
              width: p.width,
              height: p.height,
              photographerName: p.photographerName,
              photographerUrl: p.photographerUrl,
              providerAssetId: p.providerAssetId.slice(0, 120),
              locationHint: p.locationHint,
              tags: p.tags?.length ? (p.tags as unknown as Prisma.InputJsonValue) : undefined,
              isPrimary: i === primaryIdx,
              orderIndex: i,
              metadataJson: p.metadataJson as Prisma.InputJsonValue,
            },
          });
        }
      });

      const status: TravelMediaJobStatus =
        unique.length === 0 ? 'FAILED' : errors.length ? 'PARTIAL' : 'SUCCESS';
      const errMsg =
        unique.length === 0
          ? errors.length
            ? errors.join('; ').slice(0, 16_000)
            : 'Sin resultados de proveedores'
          : errors.length
            ? errors.join('; ').slice(0, 16_000)
            : null;

      await prisma.travelMediaJob.update({
        where: { id: jobId },
        data: {
          status,
          finishedAt: new Date(),
          assetsCreated: unique.length,
          providerUsed: providerUsed.slice(0, 40),
          querySummary: queries.slice(0, 30).join(' | ').slice(0, 2000),
          errorMessage: errMsg,
          metadataJson: { queries: queries.length, errorCount: errors.length },
        },
      });

      logger.info(
        { companyId, tripId, assets: unique.length, status, providerUsed },
        'Travel media enrichment finished',
      );
    } catch (e) {
      logger.error({ err: e, companyId, tripId }, 'Travel media enrichment crashed');
      await prisma.travelMediaJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorMessage: e instanceof Error ? e.message.slice(0, 16_000) : String(e).slice(0, 16_000),
        },
      });
    }
  }
}

export function scheduleTravelMediaEnrichment(companyId: string, tripId: string): void {
  setImmediate(() => {
    void new TravelMediaEnrichmentService()
      .runForTrip(companyId, tripId)
      .catch((err) =>
        logger.warn({ err, companyId, tripId }, 'scheduleTravelMediaEnrichment failed'),
      );
  });
}
