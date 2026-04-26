import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { TravelTripService } from './trip.service';
import { assertCatalogAdmin, resolveTenantCompanyId } from '../../common/company-context';
import { toJsonSafe } from '../../common/jsonSafe';
import { TravelTripStatus } from '@prisma/client';
import prisma from '../../infrastructure/db';
import { NotFoundError, ValidationError } from '../../common/errors/AppError';

const svc = new TravelTripService();

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
