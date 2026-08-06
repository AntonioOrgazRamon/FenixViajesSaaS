import prisma from '../../infrastructure/db';
import { config } from '../../common/config';
import { logger } from '../../common/logger';
import { type TravelSearchIntent } from './travel-search.schema';
import type { TravelTripSearchRow, DestinationPointsGeoOpts } from './travel-search.scoring';
import { runTravelRecommendation } from '../recommendation/pipeline';
import type { Prisma } from '@prisma/client';
import { enrichTripSearchRowsWithGeoPlaces } from '../geo/geo-search-rows';
import { TripGeoRetrievalService } from '../geo/trip-geo-retrieval.service';

export const travelSearchTripSelect = {
  id: true,
  title: true,
  provider: true,
  mainDestination: true,
  durationDays: true,
  indicativePrice: true,
  currency: true,
  season: true,
  description: true,
  luxuryLevel: true,
  budgetTier: true,
  pace: true,
  climatePreference: true,
  exclusivity: true,
  styleTags: {
    select: { style: true },
  },
  tripDestinations: {
    select: { destination: { select: { name: true, normalizedName: true } } },
  },
  departures: {
    orderBy: { orderIndex: 'asc' as const },
    select: { startDate: true, endDate: true, departureText: true },
  },
  highlights: {
    orderBy: { orderIndex: 'asc' as const },
    select: { text: true },
  },
  services: {
    orderBy: { orderIndex: 'asc' as const },
    select: { type: true, text: true },
  },
  hotels: {
    orderBy: { orderIndex: 'asc' as const },
    select: { hotelName: true, city: true, category: true },
  },
  itineraryDays: {
    orderBy: { dayNumber: 'asc' as const },
    select: { dayNumber: true, title: true, description: true },
  },
} as const;

export type TripRowDb = Prisma.TravelTripGetPayload<{ select: typeof travelSearchTripSelect }>;

export function mapTripRowDbToSearchRow(t: TripRowDb): TravelTripSearchRow {
  return {
    id: t.id,
    provider: t.provider ?? null,
    title: t.title,
    mainDestination: t.mainDestination,
    durationDays: t.durationDays,
    indicativePrice: t.indicativePrice != null ? t.indicativePrice.toString() : null,
    currency: t.currency,
    season: t.season,
    description: t.description,
    tripDestinations: t.tripDestinations,
    departures: t.departures,
    highlights: t.highlights,
    services: t.services,
    hotels: t.hotels,
    itineraryDays: t.itineraryDays,
    luxuryLevel: t.luxuryLevel,
    budgetTier: t.budgetTier,
    pace: t.pace,
    climatePreference: t.climatePreference,
    exclusivity: t.exclusivity,
    styleAxes: t.styleTags?.map((s) => s.style) ?? [],
  };
}

export type SearchIntentOptions = {
  persistRecommendation?: { leadId?: string; userId?: string };
  telemetryVerbose?: boolean;
  /**
   * QA/staging: usar planificación geo (+ scoring context) aunque `TRAVEL_GEO_RETRIEVAL_ENABLED=false`,
   * sin tocar variables de entorno globales.
   */
  geoStagingBypass?: boolean;
};

/**
 * Búsqueda por intención: motor `runTravelRecommendation` (Fase 1 siempre;
 * Fase 2 retrieval híbrido solo si `TRAVEL_HYBRID_RETRIEVAL_ENABLED`;
 * capa geo opcional si `TRAVEL_GEO_RETRIEVAL_ENABLED` tras backfill).
 */
export class TravelSearchService {
  async searchByIntent(companyId: string, intent: TravelSearchIntent, opts?: SearchIntentOptions) {
    const company = await prisma.company.findFirst({
      where: { id: companyId },
      select: { recommendationPolicy: true },
    });

    const trips = await prisma.travelTrip.findMany({
      where: { companyId, status: 'APPROVED' },
      select: travelSearchTripSelect,
    });

    const rows = trips.map(mapTripRowDbToSearchRow);
    await enrichTripSearchRowsWithGeoPlaces(companyId, rows);

    let geoScoringContext: DestinationPointsGeoOpts | undefined;
    let nonRelaxedCandidateRows: TravelTripSearchRow[] | undefined;

    const useGeoGraph =
      Boolean(intent.destination?.trim()) &&
      (config.TRAVEL_GEO_RETRIEVAL_ENABLED || opts?.geoStagingBypass === true);

    if (useGeoGraph) {
      const plan = await new TripGeoRetrievalService().plan(companyId, intent.destination, {
        bypassFeatureFlag: opts?.geoStagingBypass === true && !config.TRAVEL_GEO_RETRIEVAL_ENABLED,
      });
      geoScoringContext = plan.scoringContext;
      if (opts?.telemetryVerbose) {
        logger.info({ companyId, geoNotes: plan.notes }, 'travel geo retrieval plan');
      }
      if (plan.usePrefilter && plan.candidateTripIds?.size && plan.scoringContext) {
        nonRelaxedCandidateRows = rows.filter(
          (r) => plan.candidateTripIds!.has(r.id) || !plan.tripsWithGeoLinkIds.has(r.id),
        );
      }
    }

    const { response } = await runTravelRecommendation({
      companyId,
      intent,
      rows,
      options: {
        companyPolicyJson: company?.recommendationPolicy ?? undefined,
        persist: opts?.persistRecommendation,
        telemetryVerbose: opts?.telemetryVerbose,
        geoScoringContext,
        nonRelaxedCandidateRows,
      },
    });

    return response;
  }
}
