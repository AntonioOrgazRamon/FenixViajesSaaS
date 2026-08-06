import type { Prisma, TravelTripStatus, TravelStyleAxis } from '@prisma/client';
import prisma from '../../infrastructure/db';

export type TravelLibraryQualityFlags = {
  noPrice: boolean;
  noHotels: boolean;
  noImage: boolean;
  noItinerary: boolean;
  noGeo: boolean;
  importWarning?: boolean;
};

export type TravelLibraryListItem = {
  id: string;
  title: string;
  mainDestination: string | null;
  countries: string[];
  cities: string[];
  durationDays: number | null;
  priceFrom: number | null;
  currency: string | null;
  status: TravelTripStatus;
  importSlug: string | null;
  heroImage: string | null;
  mediaCount: number;
  qualityFlags: TravelLibraryQualityFlags;
  styles: TravelStyleAxis[];
  createdAt: string;
  updatedAt: string;
};

export type TravelLibraryMetrics = {
  totalTrips: number;
  approved: number;
  pendingReview: number;
  draftRejected: number;
  countryCount: number;
  withoutPrice: number;
  withoutPrimaryImage: number;
};

export type TravelLibraryListResponse = {
  metrics: TravelLibraryMetrics;
  items: TravelLibraryListItem[];
  page: number;
  pageSize: number;
  total: number;
};

function destNamesByKind(
  rows: { destination: { name: string; type: string } }[],
  kind: string,
): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.destination.type === kind) set.add(r.destination.name);
  }
  return [...set];
}

function buildQualityFlags(t: {
  indicativePrice: Prisma.Decimal | null;
  hotels: unknown[];
  itineraryDays: unknown[];
  tripGeoPlaces: unknown[];
  mediaAssets: { isPrimary: boolean }[];
  jsonImportItems: { validationStatus: string }[];
}): TravelLibraryQualityFlags {
  const importWarning = t.jsonImportItems.some((j) => j.validationStatus === 'WARNING');
  return {
    noPrice: t.indicativePrice == null,
    noHotels: t.hotels.length === 0,
    noImage: !t.mediaAssets.some((m) => m.isPrimary),
    noItinerary: t.itineraryDays.length === 0,
    noGeo: t.tripGeoPlaces.length === 0,
    importWarning: importWarning || undefined,
  };
}

export type TravelLibraryQuery = {
  page?: number;
  pageSize?: number;
  status?: TravelTripStatus;
  preset?: string;
  country?: string;
  city?: string;
  style?: TravelStyleAxis;
  minDays?: number;
  maxDays?: number;
  q?: string;
};

export class TravelLibraryService {
  async metrics(companyId: string): Promise<TravelLibraryMetrics> {
    const [
      totalTrips,
      approved,
      pendingReview,
      draft,
      rejected,
      countryRows,
      withoutPrice,
      withoutPrimaryImage,
    ] = await Promise.all([
      prisma.travelTrip.count({ where: { companyId } }),
      prisma.travelTrip.count({ where: { companyId, status: 'APPROVED' } }),
      prisma.travelTrip.count({ where: { companyId, status: 'PENDING_REVIEW' } }),
      prisma.travelTrip.count({ where: { companyId, status: 'DRAFT' } }),
      prisma.travelTrip.count({ where: { companyId, status: 'REJECTED' } }),
      prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(DISTINCT d.normalized_name) AS c
        FROM travel_trip_destinations td
        INNER JOIN destinations d ON d.id = td.destination_id
        INNER JOIN travel_trips t ON t.id = td.trip_id
        WHERE t.company_id = ${companyId} AND d.type = 'COUNTRY'
      `,
      prisma.travelTrip.count({ where: { companyId, indicativePrice: null } }),
      prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*) AS c
        FROM travel_trips t
        WHERE t.company_id = ${companyId}
          AND NOT EXISTS (
            SELECT 1 FROM travel_media_assets m
            WHERE m.trip_id = t.id AND m.company_id = ${companyId} AND m.is_primary = true
          )
      `,
    ]);

    return {
      totalTrips,
      approved,
      pendingReview,
      draftRejected: draft + rejected,
      countryCount: Number(countryRows[0]?.c ?? 0n),
      withoutPrice,
      withoutPrimaryImage: Number(withoutPrimaryImage[0]?.c ?? 0n),
    };
  }

  async list(companyId: string, query: TravelLibraryQuery): Promise<TravelLibraryListResponse> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(48, Math.max(1, query.pageSize ?? 24));
    const skip = (page - 1) * pageSize;

    const where: Prisma.TravelTripWhereInput = { companyId };

    if (query.status) {
      where.status = query.status;
    }

    const preset = query.preset?.toLowerCase();
    if (preset === 'approved') where.status = 'APPROVED';
    else if (preset === 'pending') where.status = 'PENDING_REVIEW';
    else if (preset === 'no_price') where.indicativePrice = null;
    else if (preset === 'no_media') {
      where.NOT = {
        mediaAssets: { some: { isPrimary: true, companyId } },
      };
    } else if (preset === 'no_geo') {
      where.tripGeoPlaces = { none: {} };
    } else if (preset === 'no_itinerary') {
      where.itineraryDays = { none: {} };
    }

    if (query.country?.trim()) {
      const key = query.country.trim().toLowerCase();
      where.tripDestinations = {
        some: {
          destination: {
            type: 'COUNTRY',
            OR: [{ normalizedName: { contains: key } }, { name: { contains: query.country.trim() } }],
          },
        },
      };
    }

    if (query.city?.trim()) {
      const c = query.city.trim();
      where.tripDestinations = {
        some: {
          destination: {
            type: { in: ['CITY', 'REGION', 'AREA'] },
            OR: [{ normalizedName: { contains: c.toLowerCase() } }, { name: { contains: c } }],
          },
        },
      };
    }

    if (query.style) {
      where.styleTags = { some: { style: query.style } };
    }

    if (query.minDays != null || query.maxDays != null) {
      where.durationDays = {};
      if (query.minDays != null) where.durationDays.gte = query.minDays;
      if (query.maxDays != null) where.durationDays.lte = query.maxDays;
    }

    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { mainDestination: { contains: q } },
        {
          tripDestinations: {
            some: { destination: { name: { contains: q } } },
          },
        },
      ];
    }

    const baseInclude = {
      tripDestinations: { include: { destination: true } },
      itineraryDays: { select: { id: true } },
      hotels: { select: { id: true } },
      tripGeoPlaces: { select: { geoPlaceId: true } },
      styleTags: { select: { style: true } },
      mediaAssets: {
        where: { companyId },
        select: { imageUrl: true, isPrimary: true },
        orderBy: { orderIndex: 'asc' as const },
      },
    } satisfies Prisma.TravelTripInclude;

    const [rawItems, total, metrics] = await Promise.all([
      prisma.travelTrip.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: baseInclude,
      }),
      prisma.travelTrip.count({ where }),
      this.metrics(companyId),
    ]);

    const items: TravelLibraryListItem[] = rawItems.map((t) => {
      const primary = t.mediaAssets.find((m) => m.isPrimary)?.imageUrl ?? t.mediaAssets[0]?.imageUrl ?? null;
      const flags = buildQualityFlags({
        indicativePrice: t.indicativePrice,
        hotels: t.hotels,
        itineraryDays: t.itineraryDays,
        tripGeoPlaces: t.tripGeoPlaces,
        mediaAssets: t.mediaAssets,
        jsonImportItems: [],
      });
      const priceNum =
        t.indicativePrice != null ? parseFloat(t.indicativePrice.toString()) : null;
      return {
        id: t.id,
        title: t.title,
        mainDestination: t.mainDestination,
        countries: destNamesByKind(t.tripDestinations, 'COUNTRY'),
        cities: destNamesByKind(t.tripDestinations, 'CITY').slice(0, 8),
        durationDays: t.durationDays,
        priceFrom: priceNum != null && Number.isFinite(priceNum) ? priceNum : null,
        currency: t.currency,
        status: t.status,
        importSlug: t.importSlug,
        heroImage: primary,
        mediaCount: t.mediaAssets.length,
        qualityFlags: flags,
        styles: t.styleTags.map((s) => s.style),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    });

    return { metrics, items, page, pageSize, total };
  }

  async detail(companyId: string, tripId: string) {
    const t = await prisma.travelTrip.findFirst({
      where: { id: tripId, companyId },
      include: {
        tripDestinations: { include: { destination: true }, orderBy: { orderIndex: 'asc' } },
        itineraryDays: { orderBy: { dayNumber: 'asc' } },
        highlights: { orderBy: { orderIndex: 'asc' } },
        services: { orderBy: { orderIndex: 'asc' } },
        hotels: { orderBy: { orderIndex: 'asc' } },
        departures: { orderBy: { orderIndex: 'asc' } },
        tripGeoPlaces: {
          orderBy: { orderIndex: 'asc' },
          include: { geoPlace: true },
        },
        mediaAssets: { where: { companyId }, orderBy: { orderIndex: 'asc' } },
        styleTags: true,
        document: { select: { id: true, originalName: true, status: true } },
        jsonImportItems: { select: { id: true, validationStatus: true, batchId: true }, take: 5 },
      },
    });
    if (!t) return null;

    const proposalsUsing = await prisma.proposalTrip.findMany({
      where: { travelTripId: tripId, companyId },
      select: {
        proposalVersion: {
          select: {
            proposal: {
              select: {
                id: true,
                status: true,
                createdAt: true,
                leadId: true,
                lead: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
        },
      },
    });
    const seen = new Set<string>();
    const proposalRefs: Array<{
      proposalId: string;
      status: string;
      leadId: string;
      leadName: string | null;
      leadEmail: string | null;
    }> = [];
    for (const row of proposalsUsing) {
      const p = row.proposalVersion.proposal;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      proposalRefs.push({
        proposalId: p.id,
        status: p.status,
        leadId: p.leadId,
        leadName: p.lead.fullName,
        leadEmail: p.lead.email,
      });
    }

    const flags = buildQualityFlags({
      indicativePrice: t.indicativePrice,
      hotels: t.hotels,
      itineraryDays: t.itineraryDays,
      tripGeoPlaces: t.tripGeoPlaces,
      mediaAssets: t.mediaAssets.map((m) => ({ isPrimary: m.isPrimary })),
      jsonImportItems: t.jsonImportItems,
    });

    const primaryHero =
      t.mediaAssets.find((m) => m.isPrimary)?.imageUrl ?? t.mediaAssets[0]?.imageUrl ?? null;
    const priceNum =
      t.indicativePrice != null ? parseFloat(t.indicativePrice.toString()) : null;

    return {
      id: t.id,
      title: t.title,
      mainDestination: t.mainDestination,
      description: t.description,
      provider: t.provider,
      season: t.season,
      durationDays: t.durationDays,
      durationNights: t.durationNights,
      priceFrom: priceNum != null && Number.isFinite(priceNum) ? priceNum : null,
      currency: t.currency,
      status: t.status,
      importSlug: t.importSlug,
      heroImage: primaryHero,
      countries: destNamesByKind(t.tripDestinations, 'COUNTRY'),
      cities: destNamesByKind(t.tripDestinations, 'CITY'),
      styles: t.styleTags.map((s) => s.style),
      qualityFlags: flags,
      tripDestinations: t.tripDestinations,
      itineraryDays: t.itineraryDays,
      highlights: t.highlights,
      services: t.services,
      hotels: t.hotels,
      departures: t.departures,
      geoLinks: t.tripGeoPlaces.map((g) => ({
        geoPlaceId: g.geoPlaceId,
        role: g.role,
        orderIndex: g.orderIndex,
        canonicalName: g.geoPlace.canonicalName,
        kind: g.geoPlace.kind,
        normalizedKey: g.geoPlace.normalizedKey,
      })),
      mediaAssets: t.mediaAssets.map((m) => ({
        id: m.id,
        imageUrl: m.imageUrl,
        thumbnailUrl: m.thumbnailUrl,
        isPrimary: m.isPrimary,
        width: m.width,
        height: m.height,
      })),
      document: t.document,
      jsonImportItems: t.jsonImportItems,
      proposalsUsing: proposalRefs,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}
