import { Request, Response } from 'express';
import { z } from 'zod';
import { assertCatalogAdmin, resolveTenantCompanyId } from '../../common/company-context';
import { ValidationError } from '../../common/errors/AppError';
import { travelSearchIntentZ } from '../../services/travel/travel-search.schema';
import {
  mapTripRowDbToSearchRow,
  travelSearchTripSelect,
} from '../../services/travel/travel-search.service';
import prisma from '../../infrastructure/db';
import {
  getEmbeddingStatusForCompany,
  rebuildCompanyTripEmbeddings,
  syncTripEmbeddingForTrip,
} from '../../services/recommendation/trip-embedding-sync.service';
import { hybridRetrievalPreview } from '../../services/recommendation/retrieval/hybrid-retrieval.service';

const rebuildBodyZ = z.object({
  limit: z.number().int().min(1).max(5000).optional(),
  dryRun: z.boolean().optional(),
  force: z.boolean().optional(),
  companyId: z.string().uuid().optional(),
});

const previewBodyZ = z.object({
  intent: travelSearchIntentZ,
  companyId: z.string().uuid().optional(),
});

function companyIdFromReq(req: Request): string {
  return resolveTenantCompanyId(req);
}

export class TravelEmbeddingAdminController {
  regenerateTripEmbedding = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    const companyId = companyIdFromReq(req);
    const tripId = String(req.params.tripId);
    const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
    const force = req.query.force === '1' || req.query.force === 'true';
    const result = await syncTripEmbeddingForTrip(companyId, tripId, { dryRun, force });
    return res.json({ success: true, data: result });
  };

  rebuildEmbeddings = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    const companyId = companyIdFromReq(req);
    const parsed = rebuildBodyZ.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Body inválido');
    }
    const summary = await rebuildCompanyTripEmbeddings(companyId, {
      limit: parsed.data.limit,
      dryRun: parsed.data.dryRun,
      force: parsed.data.force,
    });
    return res.json({ success: true, data: summary });
  };

  embeddingsStatus = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    const companyId = companyIdFromReq(req);
    const status = await getEmbeddingStatusForCompany(companyId);
    return res.json({ success: true, data: status });
  };

  retrievalPreview = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    const parsed = previewBodyZ.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Body inválido');
    }
    const companyId = resolveTenantCompanyId(req);

    const trips = await prisma.travelTrip.findMany({
      where: { companyId, status: 'APPROVED' },
      select: travelSearchTripSelect,
    });
    const rows = trips.map(mapTripRowDbToSearchRow);

    const preview = await hybridRetrievalPreview(companyId, parsed.data.intent, rows);

    return res.json({
      success: true,
      data: {
        stats: preview.stats,
        warnings: preview.warnings,
        hybridTop: preview.candidates.slice(0, 48),
        channels: preview.channels,
        catalogSize: rows.length,
      },
    });
  };
}
