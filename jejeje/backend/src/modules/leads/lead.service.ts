import {
  LeadActivityType,
  LeadActorType,
  LeadAgentRunStatus,
  LeadAgentTriggerType,
  LeadStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import prisma from '../../infrastructure/db';
import { leadIntentExtractorAgent } from '../../services/leads/lead-intent-extractor.agent';
import { LEAD_INTENT_EXTRACTOR_AGENT_KEY } from '../../services/leads/lead-intent-extractor.schema';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/AppError';
import { isValidLeadStatusTransition } from './lead-status';
import type { z } from 'zod';
import {
  createLeadBodySchema,
  intakeBodySchema,
  listLeadsQuerySchema,
  patchLeadDetailsSchema,
  patchLeadSchema,
  patchTravelProfileSchema,
  publicLeadFormSchema,
  travelProfileInputSchema,
} from './lead.schema';

type IntakeBody = z.infer<typeof intakeBodySchema>;
type CreateLeadBody = z.infer<typeof createLeadBodySchema>;
type ListQuery = z.infer<typeof listLeadsQuerySchema>;
type PatchLead = z.infer<typeof patchLeadSchema>;
type PatchDetails = z.infer<typeof patchLeadDetailsSchema>;
type PublicLeadForm = z.infer<typeof publicLeadFormSchema>;
type TravelProfileInput = z.infer<typeof travelProfileInputSchema>;
type PatchTravelProfile = z.infer<typeof patchTravelProfileSchema>;

const STRIP_RAW_KEYS = new Set(
  ['companyid', 'company_id', 'assigned_user_id', 'assigneduserid', 'role', 'status', 'internal'],
);

function sanitizeRawPayload(input: unknown): unknown {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return input;
  }
  const o = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (STRIP_RAW_KEYS.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
}

function splitFullName(name: string): { firstName: string | null; lastName: string | null; fullName: string } {
  const fullName = name.trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null, fullName: '' };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: null, fullName };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' '), fullName };
}

function travelProfileHasData(p: TravelProfileInput | undefined): boolean {
  if (!p) return false;
  return Object.values(p).some((v) => {
    if (v === undefined || v === null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v as object).length > 0;
    return true;
  });
}

function mapTravelProfileCreate(
  companyId: string,
  leadId: string,
  p: TravelProfileInput,
): Prisma.LeadTravelProfileUncheckedCreateInput {
  return {
    id: randomUUID(),
    companyId,
    leadId,
    destinationText: p.destinationText ?? null,
    preferredDestinations:
      p.preferredDestinations === undefined || p.preferredDestinations === null
        ? Prisma.JsonNull
        : (p.preferredDestinations as Prisma.InputJsonValue),
    activitiesText: p.activitiesText ?? null,
    activityTags:
      p.activityTags === undefined || p.activityTags === null
        ? Prisma.JsonNull
        : (p.activityTags as Prisma.InputJsonValue),
    travelDateText: p.travelDateText ?? null,
    travelDateFrom: p.travelDateFrom ? new Date(p.travelDateFrom) : null,
    travelDateTo: p.travelDateTo ? new Date(p.travelDateTo) : null,
    flexibleDates: p.flexibleDates ?? null,
    durationDays:
      p.durationDays != null && p.durationDays >= 1 && p.durationDays <= 365
        ? p.durationDays
        : null,
    budgetAmount:
      p.budgetAmount != null && p.budgetAmount > 0 ? p.budgetAmount : null,
    budgetCurrency: p.budgetCurrency?.trim() || 'EUR',
    budgetType: p.budgetType ?? 'UNKNOWN',
    tripType: p.tripType ?? 'UNKNOWN',
    departureAirportText: p.departureAirportText ?? null,
    departureAirportCode: p.departureAirportCode ?? null,
    rawFormPayload:
      p.rawFormPayload === undefined || p.rawFormPayload === null
        ? Prisma.JsonNull
        : (p.rawFormPayload as Prisma.InputJsonValue),
  };
}

function mapTravelProfilePatchToUpdate(p: PatchTravelProfile): Prisma.LeadTravelProfileUpdateInput {
  const u: Prisma.LeadTravelProfileUpdateInput = {};
  if (p.destinationText !== undefined) u.destinationText = p.destinationText;
  if (p.preferredDestinations !== undefined) {
    u.preferredDestinations =
      p.preferredDestinations === null ? Prisma.JsonNull : (p.preferredDestinations as Prisma.InputJsonValue);
  }
  if (p.activitiesText !== undefined) u.activitiesText = p.activitiesText;
  if (p.activityTags !== undefined) {
    u.activityTags =
      p.activityTags === null ? Prisma.JsonNull : (p.activityTags as Prisma.InputJsonValue);
  }
  if (p.travelDateText !== undefined) u.travelDateText = p.travelDateText;
  if (p.travelDateFrom !== undefined) u.travelDateFrom = p.travelDateFrom ? new Date(p.travelDateFrom) : null;
  if (p.travelDateTo !== undefined) u.travelDateTo = p.travelDateTo ? new Date(p.travelDateTo) : null;
  if (p.flexibleDates !== undefined) u.flexibleDates = p.flexibleDates;
  if (p.durationDays !== undefined) {
    u.durationDays =
      p.durationDays != null && p.durationDays >= 1 && p.durationDays <= 365
        ? p.durationDays
        : null;
  }
  if (p.budgetAmount !== undefined) {
    u.budgetAmount = p.budgetAmount != null && p.budgetAmount > 0 ? p.budgetAmount : null;
  }
  if (p.budgetCurrency !== undefined) u.budgetCurrency = p.budgetCurrency?.trim() || 'EUR';
  if (p.budgetType !== undefined) u.budgetType = p.budgetType ?? 'UNKNOWN';
  if (p.tripType !== undefined) u.tripType = p.tripType ?? 'UNKNOWN';
  if (p.departureAirportText !== undefined) u.departureAirportText = p.departureAirportText;
  if (p.departureAirportCode !== undefined) u.departureAirportCode = p.departureAirportCode;
  if (p.rawFormPayload !== undefined) {
    u.rawFormPayload =
      p.rawFormPayload === null ? Prisma.JsonNull : (p.rawFormPayload as Prisma.InputJsonValue);
  }
  return u;
}

function patchTravelProfileToCreateInput(
  companyId: string,
  leadId: string,
  p: PatchTravelProfile,
): Prisma.LeadTravelProfileUncheckedCreateInput {
  const full: TravelProfileInput = {
    destinationText: p.destinationText ?? null,
    preferredDestinations: p.preferredDestinations ?? null,
    activitiesText: p.activitiesText ?? null,
    activityTags: p.activityTags ?? null,
    travelDateText: p.travelDateText ?? null,
    travelDateFrom: p.travelDateFrom ?? null,
    travelDateTo: p.travelDateTo ?? null,
    flexibleDates: p.flexibleDates ?? null,
    durationDays: p.durationDays ?? null,
    budgetAmount: p.budgetAmount ?? null,
    budgetCurrency: p.budgetCurrency ?? null,
    budgetType: p.budgetType ?? null,
    tripType: p.tripType ?? null,
    departureAirportText: p.departureAirportText ?? null,
    departureAirportCode: p.departureAirportCode ?? null,
    rawFormPayload: p.rawFormPayload ?? null,
  };
  return mapTravelProfileCreate(companyId, leadId, full);
}

export function serializeLeadTravelProfile(row: {
  id: string;
  companyId: string;
  leadId: string;
  destinationText: string | null;
  preferredDestinations: Prisma.JsonValue | null;
  activitiesText: string | null;
  activityTags: Prisma.JsonValue | null;
  travelDateText: string | null;
  travelDateFrom: Date | null;
  travelDateTo: Date | null;
  flexibleDates: boolean | null;
  durationDays: number | null;
  budgetAmount: Prisma.Decimal | null;
  budgetCurrency: string;
  budgetType: string;
  tripType: string;
  departureAirportText: string | null;
  departureAirportCode: string | null;
  rawFormPayload: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): {
  id: string;
  companyId: string;
  leadId: string;
  destinationText: string | null;
  preferredDestinations: Prisma.JsonValue | null;
  activitiesText: string | null;
  activityTags: Prisma.JsonValue | null;
  travelDateText: string | null;
  travelDateFrom: string | null;
  travelDateTo: string | null;
  flexibleDates: boolean | null;
  durationDays: number | null;
  budgetAmount: number | null;
  budgetCurrency: string;
  budgetType: string;
  tripType: string;
  departureAirportText: string | null;
  departureAirportCode: string | null;
  rawFormPayload: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    ...row,
    budgetAmount: row.budgetAmount != null ? Number(row.budgetAmount) : null,
    travelDateFrom: row.travelDateFrom?.toISOString() ?? null,
    travelDateTo: row.travelDateTo?.toISOString() ?? null,
  };
}

async function assertUserInCompany(userId: string, companyId: string) {
  const u = await prisma.user.findFirst({
    where: { id: userId, companyId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!u) throw new ValidationError('El usuario asignado no pertenece a la empresa o no está activo');
}

export class LeadService {
  private extractTravelSnapshot(normalizedPayload: unknown): {
    destination: string | null;
    travelDate: string | null;
    seats: number | null;
  } {
    const p = normalizedPayload as
      | {
          travel?: { destination?: string; travelDate?: string; seats?: number };
        }
      | null
      | undefined;
    return {
      destination: p?.travel?.destination?.trim() || null,
      travelDate: p?.travel?.travelDate?.trim() || null,
      seats: typeof p?.travel?.seats === 'number' ? p.travel.seats : null,
    };
  }

  async createFromPublicForm(
    body: PublicLeadForm,
    integrationHeader: string | undefined,
    ip?: string,
    userAgent?: string
  ) {
    const company = await prisma.company.findFirst({
      where: { slug: body.company_slug, status: 'ACTIVE' },
    });
    if (!company) throw new NotFoundError('Empresa no encontrada');

    if (company.integrationToken) {
      const token = integrationHeader?.trim();
      if (!token || token !== company.integrationToken) {
        throw new ForbiddenError('Token de integración inválido o ausente');
      }
    }

    const email = body.email.trim().toLowerCase();
    const phone = body.phone.trim();
    const destination = body.destination.trim();
    const travelDateIso = new Date(body.travel_date).toISOString();
    const now = new Date();
    const shortWindow = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const recent = await prisma.lead.findMany({
      where: {
        companyId: company.id,
        createdAt: { gte: shortWindow },
        email,
        phone,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const duplicate = recent.find((r) => {
      const t = this.extractTravelSnapshot(r.normalizedPayload);
      return t.destination === destination && t.travelDate === travelDateIso;
    });

    const normalizedPayload = {
      source_detail: body.source_detail ?? null,
      origin: body.origin ?? null,
      travel: {
        destination,
        travelDate: travelDateIso,
        seats: body.seats,
      },
      contact: {
        first_name: body.first_name,
        last_name: body.last_name,
        full_name: `${body.first_name} ${body.last_name}`.trim(),
        email,
        phone,
      },
    };
    const rawPayload = sanitizeRawPayload(body.raw_payload ?? {});

    if (duplicate) {
      await prisma.leadActivity.create({
        data: {
          companyId: company.id,
          leadId: duplicate.id,
          actorType: LeadActorType.SYSTEM,
          activityType: LeadActivityType.EXTERNAL_EVENT,
          title: 'Posible duplicado detectado',
          description: 'Formulario público con datos equivalentes en ventana corta',
          metadata: {
            source: body.origin ?? body.source_detail ?? 'web_form',
            duplicateWindowHours: 6,
            ip,
            userAgent,
          } as Prisma.InputJsonValue,
        },
      });
      return {
        id: duplicate.id,
        status: duplicate.status,
        duplicated: true,
        message: 'Solicitud recibida correctamente.',
      };
    }

    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          companyId: company.id,
          source: 'WEB_FORM',
          sourceDetail: body.source_detail ?? body.origin ?? 'public-form',
          status: 'PENDING_REVIEW',
          firstName: body.first_name,
          lastName: body.last_name,
          fullName: `${body.first_name} ${body.last_name}`.trim(),
          email,
          phone,
          rawPayload: rawPayload === undefined ? Prisma.JsonNull : (rawPayload as Prisma.InputJsonValue),
          normalizedPayload: normalizedPayload as Prisma.InputJsonValue,
        },
      });

      await tx.leadDetail.create({
        data: {
          leadId: created.id,
          companyId: company.id,
          currentContext: {
            formOrigin: body.origin ?? null,
            destination,
            travelDate: travelDateIso,
            seats: body.seats,
          } as Prisma.InputJsonValue,
          travelContext: {
            destination,
            travelDate: travelDateIso,
            seats: body.seats,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.leadActivity.create({
        data: {
          companyId: company.id,
          leadId: created.id,
          actorType: LeadActorType.SYSTEM,
          activityType: LeadActivityType.CREATED,
          title: 'Lead creado desde formulario público',
          description: body.origin ?? body.source_detail ?? null,
          metadata: { ip, userAgent, destination, travelDate: travelDateIso, seats: body.seats } as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    await prisma.auditLog.create({
      data: {
        companyId: company.id,
        action: 'LEAD_CREATED',
        targetType: 'LEAD',
        targetId: lead.id,
        result: 'SUCCESS',
        metadata: {
          source: 'WEB_FORM',
          origin: body.origin ?? null,
          destination,
          travelDate: travelDateIso,
          seats: body.seats,
        } as Prisma.InputJsonValue,
        ipAddress: ip,
        userAgent,
      },
    });

    return { id: lead.id, status: lead.status, duplicated: false, message: 'Solicitud recibida correctamente.' };
  }

  async createFromIntake(
    body: IntakeBody,
    integrationHeader: string | undefined,
    ip?: string,
    userAgent?: string,
  ) {
    const company = await prisma.company.findFirst({
      where: { slug: body.company_slug, status: 'ACTIVE' },
    });
    if (!company) throw new NotFoundError('Empresa no encontrada');

    if (company.integrationToken) {
      const token = integrationHeader?.trim();
      if (!token || token !== company.integrationToken) {
        throw new ForbiddenError('Token de integración inválido o ausente');
      }
    }

    const contact = body.contact ?? {};
    let firstName = contact.first_name?.trim() || null;
    let lastName = contact.last_name?.trim() || null;
    let fullName = contact.full_name?.trim() || null;
    if (!fullName && (firstName || lastName)) {
      fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || null;
    }
    if (!firstName && !lastName && fullName) {
      const parts = fullName.split(/\s+/);
      firstName = parts[0] || null;
      lastName = parts.slice(1).join(' ') || null;
    }

    const rawPayload = sanitizeRawPayload(body.raw_payload ?? {});
    const normalizedPayload = {
      source_detail: body.source_detail,
      contact: body.contact,
      message: body.message,
      context: body.context,
    };

    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          companyId: company.id,
          source: body.source,
          sourceDetail: body.source_detail,
          status: 'PENDING_REVIEW',
          firstName,
          lastName,
          fullName,
          email: contact.email?.trim() || null,
          phone: contact.phone?.trim() || null,
          message: body.message?.trim() || null,
          rawPayload: rawPayload === undefined ? Prisma.JsonNull : (rawPayload as Prisma.InputJsonValue),
          normalizedPayload: normalizedPayload as Prisma.InputJsonValue,
        },
      });

      await tx.leadDetail.create({
        data: {
          leadId: created.id,
          companyId: company.id,
          currentContext: (body.context ?? {}) as Prisma.InputJsonValue,
        },
      });

      await tx.leadActivity.create({
        data: {
          companyId: company.id,
          leadId: created.id,
          actorType: LeadActorType.SYSTEM,
          activityType: LeadActivityType.CREATED,
          title: 'Lead creado',
          description: body.source_detail ?? null,
          metadata: { ip, userAgent } as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    await prisma.auditLog.create({
      data: {
        companyId: company.id,
        action: 'LEAD_CREATED',
        targetType: 'LEAD',
        targetId: lead.id,
        result: 'SUCCESS',
        metadata: { source: body.source } as Prisma.InputJsonValue,
        ipAddress: ip,
        userAgent,
      },
    });

    await leadIntentExtractorAgent.execute({
      companyId: company.id,
      leadId: lead.id,
      triggerType: LeadAgentTriggerType.ON_CREATE,
    });

    return { id: lead.id, status: lead.status };
  }

  async createFromCrm(
    companyId: string,
    body: CreateLeadBody,
    actorUserId: string,
    actorRole: string,
  ) {
    const { firstName, lastName, fullName } = splitFullName(body.name);
    const email = body.email?.trim()?.toLowerCase() || null;
    const phone = body.phone?.trim() || null;
    const message = body.message?.trim() || null;
    const tp = body.travelProfile;

    const normalizedPayload: Record<string, unknown> = {
      contact: { full_name: fullName, email, phone },
      message,
    };
    if (tp && travelProfileHasData(tp)) {
      normalizedPayload.travel = {
        destination: tp.destinationText ?? undefined,
        travelDate: tp.travelDateFrom ?? tp.travelDateText ?? undefined,
        activities: tp.activitiesText ?? undefined,
        departureAirport: tp.departureAirportText ?? undefined,
        durationDays: tp.durationDays ?? undefined,
      };
    }

    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          companyId,
          source: 'MANUAL',
          sourceDetail: 'crm-create',
          status: 'NEW',
          firstName,
          lastName,
          fullName,
          email,
          phone,
          message,
          normalizedPayload: normalizedPayload as Prisma.InputJsonValue,
          createdByUserId: actorUserId,
        },
      });

      await tx.leadDetail.create({
        data: {
          leadId: created.id,
          companyId,
          currentContext: {} as Prisma.InputJsonValue,
        },
      });

      if (tp && travelProfileHasData(tp)) {
        await tx.leadTravelProfile.create({
          data: mapTravelProfileCreate(companyId, created.id, tp),
        });
      }

      await tx.leadActivity.create({
        data: {
          companyId,
          leadId: created.id,
          actorUserId,
          actorType: LeadActorType.USER,
          activityType: LeadActivityType.CREATED,
          title: 'Lead creado en CRM',
          description: 'Alta manual con perfil de viaje opcional',
        },
      });

      return created;
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        actorUserId,
        actorRole,
        action: 'LEAD_CREATED',
        targetType: 'LEAD',
        targetId: lead.id,
        result: 'SUCCESS',
        metadata: { source: 'MANUAL', hasTravelProfile: Boolean(tp && travelProfileHasData(tp)) } as Prisma.InputJsonValue,
      },
    });

    return this.getById(companyId, lead.id);
  }

  async getTravelProfile(companyId: string, leadId: string) {
    await this.getById(companyId, leadId);
    const row = await prisma.leadTravelProfile.findUnique({ where: { leadId } });
    return row ? serializeLeadTravelProfile(row) : null;
  }

  async patchTravelProfile(
    companyId: string,
    leadId: string,
    data: PatchTravelProfile,
    actorUserId: string,
    actorRole: string,
  ) {
    await this.getById(companyId, leadId);
    const update = mapTravelProfilePatchToUpdate(data);
    if (Object.keys(update).length === 0) {
      const existing = await prisma.leadTravelProfile.findUnique({ where: { leadId } });
      return existing ? serializeLeadTravelProfile(existing) : null;
    }

    const row = await prisma.leadTravelProfile.upsert({
      where: { leadId },
      create: patchTravelProfileToCreateInput(companyId, leadId, data),
      update,
    });

    await prisma.leadActivity.create({
      data: {
        companyId,
        leadId,
        actorUserId,
        actorType: LeadActorType.USER,
        activityType: LeadActivityType.UPDATED,
        title: 'Perfil de viaje del lead actualizado',
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        actorUserId,
        actorRole,
        action: 'LEAD_UPDATED',
        targetType: 'LEAD_TRAVEL_PROFILE',
        targetId: leadId,
        result: 'SUCCESS',
      },
    });

    return serializeLeadTravelProfile(row);
  }

  async list(companyId: string, q: ListQuery) {
    const skip = (q.page - 1) * q.page_size;
    const where: Prisma.LeadWhereInput = {
      companyId,
      deletedAt: null,
    };

    if (q.status) where.status = q.status;
    if (q.source) where.source = q.source;
    if (q.priority) where.priority = q.priority;
    if (q.assigned_user_id) where.assignedUserId = q.assigned_user_id;
    if (q.created_by_user_id) where.createdByUserId = q.created_by_user_id;

    if (q.search?.trim()) {
      const s = q.search.trim();
      where.OR = [
        { fullName: { contains: s } },
        { email: { contains: s } },
        { phone: { contains: s } },
        { companyName: { contains: s } },
        { firstName: { contains: s } },
        { lastName: { contains: s } },
      ];
    }

    if (q.date_from || q.date_to) {
      where.createdAt = {};
      if (q.date_from) where.createdAt.gte = new Date(q.date_from);
      if (q.date_to) where.createdAt.lte = new Date(q.date_to);
    }

    const orderField =
      q.sort_by === 'updated_at' ? 'updatedAt' : q.sort_by === 'status' ? 'status' : 'createdAt';
    const orderDir = q.sort_order === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await prisma.$transaction([
      prisma.lead.findMany({
        where,
        skip,
        take: q.page_size,
        orderBy: { [orderField]: orderDir },
        include: {
          assignedUser: { select: { id: true, email: true, firstName: true, lastName: true } },
          travelProfile: { select: { destinationText: true, travelDateText: true, travelDateFrom: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      items: rows.map((r) => {
        const snap = this.extractTravelSnapshot(r.normalizedPayload);
        const tp = r.travelProfile;
        return {
          ...r,
          travel: {
            destination: snap.destination ?? tp?.destinationText ?? null,
            travelDate:
              snap.travelDate ??
              (tp?.travelDateFrom ? tp.travelDateFrom.toISOString() : null) ??
              tp?.travelDateText ??
              null,
            seats: snap.seats,
          },
          assignedUser: r.assignedUser,
          lastMovementAt: r.updatedAt,
        };
      }),
      total,
      page: q.page,
      page_size: q.page_size,
    };
  }

  async getById(companyId: string, leadId: string) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, companyId, deletedAt: null },
      include: {
        details: true,
        travelProfile: true,
        assignedUser: { select: { id: true, email: true, firstName: true, lastName: true } },
        createdByUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!lead) throw new NotFoundError('Lead no encontrado');
    return {
      ...lead,
      travelProfile: lead.travelProfile ? serializeLeadTravelProfile(lead.travelProfile) : null,
    };
  }

  async getDetailBundle(companyId: string, leadId: string) {
    const lead = await this.getById(companyId, leadId);

    const [activities, notes, agentRuns] = await Promise.all([
      prisma.leadActivity.findMany({
        where: { companyId, leadId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { actorUser: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      prisma.leadNote.findMany({
        where: { companyId, leadId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { author: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      prisma.leadAgentRun.findMany({
        where: { companyId, leadId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    return { lead, activities, notes, agentRuns };
  }

  async updateLead(
    companyId: string,
    leadId: string,
    data: PatchLead,
    actorUserId: string,
    actorRole: string,
  ) {
    const existing = await prisma.lead.findFirst({
      where: { id: leadId, companyId, deletedAt: null },
    });
    if (!existing) throw new NotFoundError('Lead no encontrado');

    const updates: Prisma.LeadUpdateInput = {};

    if (data.first_name !== undefined) updates.firstName = data.first_name;
    if (data.last_name !== undefined) updates.lastName = data.last_name;
    if (data.email !== undefined) updates.email = data.email;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.company_name !== undefined) updates.companyName = data.company_name;
    if (data.message !== undefined) updates.message = data.message;
    if (data.priority !== undefined) updates.priority = data.priority ?? undefined;

    if (data.assigned_user_id !== undefined) {
      if (data.assigned_user_id === null) {
        updates.assignedUser = { disconnect: true };
      } else {
        await assertUserInCompany(data.assigned_user_id, companyId);
        updates.assignedUser = { connect: { id: data.assigned_user_id } };
      }
    }

    if (data.status !== undefined && data.status !== existing.status) {
      if (!isValidLeadStatusTransition(existing.status as LeadStatus, data.status as LeadStatus)) {
        throw new ValidationError(`Transición de estado no permitida: ${existing.status} → ${data.status}`);
      }
      updates.status = data.status;
      if (data.status === 'CONVERTED') updates.convertedAt = new Date();
      if (data.status === 'LOST') updates.lostAt = new Date();
    }

    const lead = await prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id: leadId },
        data: updates,
        include: {
          assignedUser: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });

      if (data.status !== undefined && data.status !== existing.status) {
        await tx.leadActivity.create({
          data: {
            companyId,
            leadId,
            actorUserId,
            actorType: LeadActorType.USER,
            activityType: LeadActivityType.STATUS_CHANGED,
            title: `Estado: ${existing.status} → ${data.status}`,
            metadata: { from: existing.status, to: data.status } as Prisma.InputJsonValue,
          },
        });
        await tx.auditLog.create({
          data: {
            companyId,
            actorUserId,
            actorRole,
            action: 'LEAD_STATUS_CHANGED',
            targetType: 'LEAD',
            targetId: leadId,
            result: 'SUCCESS',
            metadata: { from: existing.status, to: data.status } as Prisma.InputJsonValue,
          },
        });
      }

      if (data.assigned_user_id !== undefined && data.assigned_user_id !== existing.assignedUserId) {
        await tx.leadActivity.create({
          data: {
            companyId,
            leadId,
            actorUserId,
            actorType: LeadActorType.USER,
            activityType: LeadActivityType.ASSIGNED,
            title: 'Asignación actualizada',
            metadata: {
              previous: existing.assignedUserId,
              next: data.assigned_user_id,
            } as Prisma.InputJsonValue,
          },
        });
        await tx.auditLog.create({
          data: {
            companyId,
            actorUserId,
            actorRole,
            action: 'LEAD_ASSIGNED',
            targetType: 'LEAD',
            targetId: leadId,
            result: 'SUCCESS',
          },
        });
      }

      const touchedContact =
        data.first_name !== undefined ||
        data.last_name !== undefined ||
        data.email !== undefined ||
        data.phone !== undefined ||
        data.company_name !== undefined ||
        data.message !== undefined ||
        data.priority !== undefined;

      if (touchedContact) {
        await tx.leadActivity.create({
          data: {
            companyId,
            leadId,
            actorUserId,
            actorType: LeadActorType.USER,
            activityType: LeadActivityType.UPDATED,
            title: 'Lead actualizado',
          },
        });
        await tx.auditLog.create({
          data: {
            companyId,
            actorUserId,
            actorRole,
            action: 'LEAD_UPDATED',
            targetType: 'LEAD',
            targetId: leadId,
            result: 'SUCCESS',
          },
        });
      }

      return updated;
    });

    return lead;
  }

  async updateDetails(companyId: string, leadId: string, data: PatchDetails, actorUserId: string, actorRole: string) {
    await this.getById(companyId, leadId);

    const detail = await prisma.leadDetail.findUnique({ where: { leadId } });
    if (!detail) throw new NotFoundError('Detalle de lead no encontrado');

    const updated = await prisma.leadDetail.update({
      where: { leadId },
      data: {
        purchaseHistory: data.purchase_history !== undefined ? (data.purchase_history as Prisma.InputJsonValue) : undefined,
        currentContext: data.current_context !== undefined ? (data.current_context as Prisma.InputJsonValue) : undefined,
        requirements: data.requirements !== undefined ? (data.requirements as Prisma.InputJsonValue) : undefined,
        preferences: data.preferences !== undefined ? (data.preferences as Prisma.InputJsonValue) : undefined,
        technicalSnapshot: data.technical_snapshot !== undefined ? (data.technical_snapshot as Prisma.InputJsonValue) : undefined,
        commercialSnapshot: data.commercial_snapshot !== undefined ? (data.commercial_snapshot as Prisma.InputJsonValue) : undefined,
        extraData: data.extra_data !== undefined ? (data.extra_data as Prisma.InputJsonValue) : undefined,
      },
    });

    await prisma.leadActivity.create({
      data: {
        companyId,
        leadId,
        actorUserId,
        actorType: LeadActorType.USER,
        activityType: LeadActivityType.UPDATED,
        title: 'Detalle ampliado actualizado',
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        actorUserId,
        actorRole,
        action: 'LEAD_UPDATED',
        targetType: 'LEAD_DETAIL',
        targetId: leadId,
        result: 'SUCCESS',
      },
    });

    return updated;
  }

  async listActivities(companyId: string, leadId: string, page: number, pageSize: number) {
    await this.getById(companyId, leadId);
    const skip = (page - 1) * pageSize;
    const where = { companyId, leadId };
    const [items, total] = await prisma.$transaction([
      prisma.leadActivity.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { actorUser: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      prisma.leadActivity.count({ where }),
    ]);
    return { items, total, page, page_size: pageSize };
  }

  async listNotes(companyId: string, leadId: string) {
    await this.getById(companyId, leadId);
    return prisma.leadNote.findMany({
      where: { companyId, leadId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
  }

  async createNote(companyId: string, leadId: string, content: string, authorUserId: string, actorRole: string) {
    await this.getById(companyId, leadId);
    const note = await prisma.leadNote.create({
      data: {
        companyId,
        leadId,
        authorUserId,
        content,
      },
      include: { author: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });

    await prisma.leadActivity.create({
      data: {
        companyId,
        leadId,
        actorUserId: authorUserId,
        actorType: LeadActorType.USER,
        activityType: LeadActivityType.NOTE_ADDED,
        title: 'Nota añadida',
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        actorUserId: authorUserId,
        actorRole,
        action: 'LEAD_NOTE_CREATED',
        targetType: 'LEAD_NOTE',
        targetId: note.id,
        result: 'SUCCESS',
      },
    });

    return note;
  }

  async updateNote(
    companyId: string,
    leadId: string,
    noteId: string,
    content: string,
    actorUserId: string,
    actorRole: string,
  ) {
    const note = await prisma.leadNote.findFirst({
      where: { id: noteId, companyId, leadId, deletedAt: null },
    });
    if (!note) throw new NotFoundError('Nota no encontrada');
    if (note.authorUserId !== actorUserId && actorRole !== 'COMPANY_ADMIN') {
      throw new ForbiddenError('No puedes editar esta nota');
    }

    const updated = await prisma.leadNote.update({
      where: { id: noteId },
      data: { content },
      include: { author: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        actorUserId,
        actorRole,
        action: 'LEAD_NOTE_UPDATED',
        targetType: 'LEAD_NOTE',
        targetId: noteId,
        result: 'SUCCESS',
      },
    });

    return updated;
  }

  async deleteNote(companyId: string, leadId: string, noteId: string, actorUserId: string, actorRole: string) {
    const note = await prisma.leadNote.findFirst({
      where: { id: noteId, companyId, leadId, deletedAt: null },
    });
    if (!note) throw new NotFoundError('Nota no encontrada');
    if (note.authorUserId !== actorUserId && actorRole !== 'COMPANY_ADMIN') {
      throw new ForbiddenError('No puedes eliminar esta nota');
    }

    await prisma.leadNote.update({
      where: { id: noteId },
      data: { deletedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        actorUserId,
        actorRole,
        action: 'LEAD_NOTE_UPDATED',
        targetType: 'LEAD_NOTE',
        targetId: noteId,
        result: 'SUCCESS',
        metadata: { softDeleted: true } as Prisma.InputJsonValue,
      },
    });

    return { ok: true };
  }

  async listAgentRuns(companyId: string, leadId: string) {
    await this.getById(companyId, leadId);
    return prisma.leadAgentRun.findMany({
      where: { companyId, leadId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async runAgentsManual(companyId: string, leadId: string, actorUserId: string, actorRole: string, keys?: string[]) {
    await this.getById(companyId, leadId);
    const agentKeys = keys?.length ? keys : [LEAD_INTENT_EXTRACTOR_AGENT_KEY];

    const runs = [];
    for (const agentKey of agentKeys) {
      const resolvedKey = agentKey === 'manual-default' ? LEAD_INTENT_EXTRACTOR_AGENT_KEY : agentKey;
      if (resolvedKey === LEAD_INTENT_EXTRACTOR_AGENT_KEY) {
        const { runId } = await leadIntentExtractorAgent.execute({
          companyId,
          leadId,
          triggerType: LeadAgentTriggerType.MANUAL,
          actorUserId,
        });
        const row = await prisma.leadAgentRun.findUniqueOrThrow({ where: { id: runId } });
        runs.push(row);
      } else {
        const stub = await prisma.leadAgentRun.create({
          data: {
            companyId,
            leadId,
            agentKey,
            triggerType: LeadAgentTriggerType.MANUAL,
            status: LeadAgentRunStatus.SUCCESS,
            outputPayload: { message: 'MVP stub: agente no implementado' } as Prisma.InputJsonValue,
            startedAt: new Date(),
            finishedAt: new Date(),
          },
        });
        runs.push(stub);
      }
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { lastAgentRunAt: new Date() },
    });

    await prisma.leadActivity.create({
      data: {
        companyId,
        leadId,
        actorUserId,
        actorType: LeadActorType.USER,
        activityType: LeadActivityType.AGENT_RUN,
        title: 'Ejecución manual de agentes',
        metadata: { agentKeys } as Prisma.InputJsonValue,
      },
    });

    for (const r of runs) {
      await prisma.auditLog.create({
        data: {
          companyId,
          actorUserId,
          actorRole,
          action:
            r.status === LeadAgentRunStatus.SUCCESS
              ? 'LEAD_AGENT_RUN_SUCCESS'
              : 'LEAD_AGENT_RUN_FAILED',
          targetType: 'LEAD',
          targetId: leadId,
          result: r.status === LeadAgentRunStatus.SUCCESS ? 'SUCCESS' : 'FAILURE',
          metadata: { agentKey: r.agentKey, runStatus: r.status } as Prisma.InputJsonValue,
        },
      });
    }

    return runs;
  }
}
