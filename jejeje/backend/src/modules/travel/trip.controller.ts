import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { TravelStyleAxis } from '@prisma/client';
import { TravelTripService } from './trip.service';
import { TravelLibraryService } from './travel-library.service';
import { TravelSearchService } from '../../services/travel/travel-search.service';
import { travelSearchIntentRequestZ } from '../../services/travel/travel-search.schema';
import { toJsonSafe } from '../../common/jsonSafe';
import { getRecommendationRunForTenant } from '../../services/recommendation/recommendation-persistence.service';
import { assertCatalogAdmin, resolveTenantCompanyId } from '../../common/company-context';
import { TravelTripStatus } from '@prisma/client';
import prisma from '../../infrastructure/db';
import { NotFoundError, ValidationError } from '../../common/errors/AppError';
import { scheduleTravelMediaEnrichment } from '../../services/travel/media/travel-media-enrichment.service';

const svc = new TravelTripService();
const travelSearch = new TravelSearchService();
const travelLibrary = new TravelLibraryService();

const travelLibraryQueryZ = z.object({
  page: z.coerce.number().min(1).optional(),
  pageSize: z.coerce.number().min(1).max(48).optional(),
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED']).optional(),
  preset: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  style: z.string().optional(),
  minDays: z.coerce.number().optional(),
  maxDays: z.coerce.number().optional(),
  q: z.string().optional(),
});

export class TravelTripController {
  list = async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).end();
    const companyId = resolveTenantCompanyId(req);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as TravelTripStatus | undefined;
    const data = await svc.list(companyId, req.user.role, { page, pageSize, status });
    return res.json({ success: true, data });
  };

  libraryList = async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).end();
    const companyId = resolveTenantCompanyId(req);
    const parsed = travelLibraryQueryZ.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Query inválida');
    }
    const styleRaw = parsed.data.style?.trim();
    const style =
      styleRaw && /^[A-Z][A-Z0-9_]*$/.test(styleRaw) ? (styleRaw as TravelStyleAxis) : undefined;
    const data = await travelLibrary.list(companyId, { ...parsed.data, style });
    return res.json({ success: true, data });
  };

  libraryDetail = async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).end();
    const companyId = resolveTenantCompanyId(req);
    const tripId = String(req.params.tripId);
    const data = await travelLibrary.detail(companyId, tripId);
    if (!data) throw new NotFoundError('Viaje no encontrado');
    return res.json({ success: true, data });
  };

  enqueueTripMedia = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    const id = String(req.params.id);
    const t = await prisma.travelTrip.findFirst({ where: { id, companyId } });
    if (!t) throw new NotFoundError('Viaje no encontrado');
    if (t.status !== 'APPROVED') {
      throw new ValidationError('Solo se encola enriquecimiento para viajes APPROVED');
    }
    scheduleTravelMediaEnrichment(companyId, id);
    return res.json({ success: true, data: { queued: true } });
  };

  search = async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).end();
    const companyId = resolveTenantCompanyId(req);
    const data = await svc.search(companyId, {
      country: req.query.country as string,
      minDays: req.query.minDays ? parseInt(req.query.minDays as string) : undefined,
      maxDays: req.query.maxDays ? parseInt(req.query.maxDays as string) : undefined,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
      q: req.query.q as string,
    });
    return res.json({ success: true, data: { items: data } });
  };

  /** Búsqueda por intención (motor rec-engine). Body admite persistRun + leadId para auditar runs. */
  searchIntent = async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).end();
    const companyId = resolveTenantCompanyId(req);
    const parsed = travelSearchIntentRequestZ.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || 'Payload inválido');
    }
    const { persistRun, telemetryVerbose, leadId, ...intent } = parsed.data;
    const data = await travelSearch.searchByIntent(companyId, intent, {
      persistRecommendation: persistRun
        ? { leadId: leadId ?? undefined, userId: req.user.id }
        : undefined,
      telemetryVerbose: telemetryVerbose ?? undefined,
    });
    return res.json({ success: true, data });
  };

  getRecommendationRun = async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).end();
    const companyId = resolveTenantCompanyId(req);
    const run = await getRecommendationRunForTenant(String(req.params.runId), companyId);
    if (!run) {
      throw new NotFoundError('Run de recomendación no encontrado');
    }
    return res.json({ success: true, data: toJsonSafe(run) });
  };

  getOne = async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).end();
    const companyId = resolveTenantCompanyId(req);
    const data = await svc.getById(String(req.params.id), companyId, req.user.role);
    return res.json({ success: true, data: toJsonSafe(data) });
  };

  createManual = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    const data = await svc.createManual(companyId, req.body);
    return res.status(201).json({ success: true, data });
  };

  patch = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    const data = await svc.update(String(req.params.id), companyId, req.body);
    return res.json({ success: true, data });
  };

  approve = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    const data = await svc.setStatus(String(req.params.id), companyId, 'APPROVED');
    return res.json({ success: true, data });
  };

  reject = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    const data = await svc.setStatus(String(req.params.id), companyId, 'REJECTED');
    return res.json({ success: true, data });
  };

  /** FASE 11 — vinculación a lead: guarda contexto de propuesta (stubs, agente IA externo) */
  attachLeadProposal = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    const leadId = String(req.params.leadId);
    const { selectedTripIds, notes, proposalDraft } = req.body as {
      selectedTripIds?: string[];
      notes?: string;
      proposalDraft?: string;
    };
    const lead = await prisma.lead.findFirst({ where: { id: leadId, companyId } });
    if (!lead) {
      throw new NotFoundError('Lead no encontrado');
    }
    if (!Array.isArray(selectedTripIds) || !selectedTripIds.length) {
      throw new ValidationError('selectedTripIds requerido');
    }
    const ok = await prisma.travelTrip.findMany({
      where: { id: { in: selectedTripIds as string[] }, companyId, status: 'APPROVED' },
      select: { id: true },
    });
    if (ok.length !== selectedTripIds.length) {
      throw new ValidationError('Solo se permiten viajes aprobados de la misma empresa');
    }
    await prisma.leadDetail.upsert({
      where: { leadId },
      create: {
        id: uuidv4(),
        leadId,
        companyId,
        travelContext: {
          selectedTripIds,
          notes: notes ?? null,
          proposalDraft: proposalDraft ?? null,
          updatedAt: new Date().toISOString(),
        },
      },
      update: {
        travelContext: {
          selectedTripIds,
          notes: notes ?? null,
          proposalDraft: proposalDraft ?? null,
          updatedAt: new Date().toISOString(),
        },
      },
    });
    return res.json({ success: true, data: { leadId, saved: true } });
  };
}
