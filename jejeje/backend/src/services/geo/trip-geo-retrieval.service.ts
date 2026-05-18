import prisma from '../../infrastructure/db';
import { config } from '../../common/config';
import type { DestinationPointsGeoOpts } from '../travel/travel-search.scoring';
import { expandGeoPlaceClosure } from './geo-place.service';
import { GeoPlaceService } from './geo-place.service';

export type GeoPrefilterPlan = {
  usePrefilter: boolean;
  scoringContext?: DestinationPointsGeoOpts;
  candidateTripIds?: Set<string>;
  tripsWithGeoLinkIds: Set<string>;
  notes: string[];
};

async function loadApprovedTripIdsWithGeoLinks(companyId: string): Promise<Set<string>> {
  const grouped = await prisma.tripGeoPlace.groupBy({
    by: ['tripId'],
    where: {
      trip: { companyId, status: 'APPROVED' },
    },
  });
  return new Set(grouped.map((g) => g.tripId));
}

/**
 * Prefiltro por grafo geo + contexto para scoring. Fallback seguro al catálogo completo.
 */
export class TripGeoRetrievalService {
  constructor(private readonly geoPlaces = new GeoPlaceService()) {}

  async plan(
    companyId: string,
    destinationText: string | undefined,
    opts?: { bypassFeatureFlag?: boolean },
  ): Promise<GeoPrefilterPlan> {
    const notes: string[] = [];

    if (!opts?.bypassFeatureFlag && !config.TRAVEL_GEO_RETRIEVAL_ENABLED) {
      return {
        usePrefilter: false,
        scoringContext: undefined,
        candidateTripIds: undefined,
        tripsWithGeoLinkIds: new Set(),
        notes: ['GEO_DISABLED'],
      };
    }

    const trimmed = destinationText?.trim();
    if (!trimmed) {
      return {
        usePrefilter: false,
        scoringContext: undefined,
        candidateTripIds: undefined,
        tripsWithGeoLinkIds: new Set(),
        notes: ['NO_DESTINATION_TEXT'],
      };
    }

    const resolved = await this.geoPlaces.resolveIntentToGeoPlaces(companyId, trimmed);
    if (!resolved.length) {
      return {
        usePrefilter: false,
        scoringContext: undefined,
        candidateTripIds: undefined,
        tripsWithGeoLinkIds: new Set(),
        notes: ['NO_GEO_PLACE_FOR_INTENT'],
      };
    }

    const rootIds = resolved.slice(0, 8).map((p) => p.id);
    const intentRootGeoPlaceIds = new Set(rootIds);
    const expandedIntentGeoPlaceIds = new Set<string>();
    for (const id of rootIds) {
      const closure = await expandGeoPlaceClosure(companyId, [id], config.TRAVEL_GEO_CLOSURE_MAX_DEPTH);
      for (const x of closure) expandedIntentGeoPlaceIds.add(x);
    }

    const scoringContext: DestinationPointsGeoOpts = {
      expandedIntentGeoPlaceIds,
      intentRootGeoPlaceIds,
    };

    const expandedList = [...expandedIntentGeoPlaceIds];
    if (!expandedList.length) {
      return {
        usePrefilter: false,
        scoringContext,
        candidateTripIds: undefined,
        tripsWithGeoLinkIds: new Set(),
        notes: ['EMPTY_CLOSURE'],
      };
    }

    const grouped = await prisma.tripGeoPlace.groupBy({
      by: ['tripId'],
      where: {
        geoPlaceId: { in: expandedList },
        trip: { companyId, status: 'APPROVED' },
      },
    });
    const candidateTripIds = new Set(grouped.map((g) => g.tripId));
    notes.push(`GEO_CANDIDATES_${candidateTripIds.size}`);

    const min = config.TRAVEL_GEO_PREFILTER_MIN_MATCHES;
    if (candidateTripIds.size < min) {
      notes.push(`PREFILTER_SKIPPED_LT_${min}`);
      return {
        usePrefilter: false,
        scoringContext,
        candidateTripIds: undefined,
        tripsWithGeoLinkIds: new Set(),
        notes,
      };
    }

    const tripsWithGeoLinkIds = await loadApprovedTripIdsWithGeoLinks(companyId);
    notes.push(`TRIPS_WITH_GEO_LINKS_${tripsWithGeoLinkIds.size}`);

    return {
      usePrefilter: true,
      scoringContext,
      candidateTripIds,
      tripsWithGeoLinkIds,
      notes,
    };
  }
}
