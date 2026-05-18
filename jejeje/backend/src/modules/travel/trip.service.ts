import { Prisma, type TravelTripStatus } from '@prisma/client';
import prisma from '../../infrastructure/db';
import { NotFoundError, ValidationError } from '../../common/errors/AppError';
import { tripAiExtractZ } from '../../services/travel/trip-ai.schemas';
import { TripNormalizationService } from '../../services/travel/trip-normalization.service';
import { TripImportService } from '../../services/travel/trip-import.service';

const normalizer = new TripNormalizationService();
const tripImport = new TripImportService();

const tripInclude = {
  tripDestinations: { include: { destination: true } },
  itineraryDays: { orderBy: { dayNumber: 'asc' as const } },
  services: { orderBy: { orderIndex: 'asc' as const } },
  departures: { orderBy: { orderIndex: 'asc' as const } },
  hotels: { orderBy: { orderIndex: 'asc' as const } },
  highlights: { orderBy: { orderIndex: 'asc' as const } },
  observations: { orderBy: { orderIndex: 'asc' as const } },
} as const;

export class TravelTripService {
  /**
   * Listado con filtro de estado. COMPANY_USER solo ve APPROVED.
   */
  async list(
    companyId: string,
    role: string,
    query: { status?: TravelTripStatus; page?: number; pageSize?: number },
  ) {
    const page = query.page || 1;
    /** Catálogo admin: permitir listados grandes (selector "todos" en UI). */
    const take = Math.min(5000, Math.max(1, query.pageSize || 20));
    const skip = (Math.max(1, page) - 1) * take;

    const where: Prisma.TravelTripWhereInput = { companyId };
    if (role === 'COMPANY_USER') {
      where.status = 'APPROVED';
    } else if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      prisma.travelTrip.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: {
          document: { select: { id: true, originalName: true, status: true } },
        },
      }),
      prisma.travelTrip.count({ where }),
    ]);
    return { items, total, page, pageSize: take };
  }

  async getById(id: string, companyId: string, role: string) {
    const t = await prisma.travelTrip.findFirst({
      where: { id, companyId },
      include: tripInclude,
    });
    if (!t) {
      throw new NotFoundError('Viaje no encontrado');
    }
    if (role === 'COMPANY_USER' && t.status !== 'APPROVED') {
      throw new NotFoundError('Viaje no encontrado');
    }
    return t;
  }

  async update(
    id: string,
    companyId: string,
    body: Record<string, unknown>,
  ) {
    const t = await prisma.travelTrip.findFirst({ where: { id, companyId } });
    if (!t) {
      throw new NotFoundError('Viaje no encontrado');
    }
    const data: Prisma.TravelTripUpdateInput = {};
    if (typeof body.title === 'string') data.title = body.title.slice(0, 500);
    if (typeof body.provider === 'string' || body.provider === null) data.provider = body.provider as string | null;
    if (typeof body.season === 'string' || body.season === null) data.season = body.season as string | null;
    if (typeof body.mainDestination === 'string' || body.mainDestination === null) {
      data.mainDestination = body.mainDestination as string | null;
    }
    if (typeof body.description === 'string' || body.description === null) {
      data.description = body.description as string | null;
    }
    if (typeof body.durationDays === 'number') data.durationDays = body.durationDays;
    if (typeof body.durationNights === 'number') data.durationNights = body.durationNights;
    if (typeof body.indicativePrice === 'number') {
      data.indicativePrice = new Prisma.Decimal(body.indicativePrice);
    }
    if (typeof body.currency === 'string' || body.currency === null) {
      data.currency = body.currency as string | null;
    }

    return prisma.travelTrip.update({ where: { id }, data, include: tripInclude });
  }

  async setStatus(
    id: string,
    companyId: string,
    status: 'APPROVED' | 'REJECTED',
  ) {
    const t = await prisma.travelTrip.findFirst({ where: { id, companyId } });
    if (!t) {
      throw new NotFoundError('Viaje no encontrado');
    }
    return prisma.travelTrip.update({
      where: { id },
      data: { status },
      include: tripInclude,
    });
  }

  async search(
    companyId: string,
    q: {
      country?: string;
      minDays?: number;
      maxDays?: number;
      minPrice?: number;
      maxPrice?: number;
      q?: string;
    },
  ) {
    const where: Prisma.TravelTripWhereInput = {
      companyId,
      status: 'APPROVED',
    };
    if (q.minDays != null || q.maxDays != null) {
      where.durationDays = {};
      if (q.minDays != null) where.durationDays.gte = q.minDays;
      if (q.maxDays != null) where.durationDays.lte = q.maxDays;
    }
    if (q.minPrice != null || q.maxPrice != null) {
      where.indicativePrice = {};
      if (q.minPrice != null) where.indicativePrice.gte = new Prisma.Decimal(q.minPrice);
      if (q.maxPrice != null) where.indicativePrice.lte = new Prisma.Decimal(q.maxPrice);
    }
    if (q.country) {
      const sub = q.country.trim();
      where.OR = [
        { mainDestination: { contains: sub } },
        { tripDestinations: { some: { destination: { name: { contains: sub } } } } },
      ];
    }
    if (q.q) {
      const t = q.q.trim();
      where.AND = [
        {
          OR: [
            { title: { contains: t } },
            { description: { contains: t } },
            { mainDestination: { contains: t } },
          ],
        },
      ];
    }

    return prisma.travelTrip.findMany({
      where,
      orderBy: { title: 'asc' },
      take: 200,
      include: { document: { select: { id: true, originalName: true } } },
    });
  }

  /**
   * Checkpoint: crear un viaje manual (borrador o pendiente de revisión) sin PDF.
   */
  async createManual(companyId: string, body: unknown) {
    const parsed = tripAiExtractZ.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || 'JSON inválido');
    }
    const data = normalizer.normalizeTripStrings(parsed.data);
    const ded = normalizer.dedupeDestinations(data.destinations);
    const conf = data.confidence ?? 0.5;
    return tripImport.persistTrip(companyId, null, {
      sourcePageStart: 0,
      sourcePageEnd: 0,
      rawText: data.description || data.title,
      data: { ...data, destinations: ded, confidence: conf },
      confidence: conf,
    });
  }
}
