/**
 * Comparación pipeline recomendación con/sin contexto geo (sin activar flag global).
 * Simula lo que hace TravelSearchService cuando hay geoScoringContext + prefiltrado opcional.
 *
 * Uso:
 *   npm run geo:smoke-compare-flag -- --companyId=<uuid> [--destination=Vietnam]
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import {
  mapTripRowDbToSearchRow,
  travelSearchTripSelect,
} from '../src/services/travel/travel-search.service';
import { enrichTripSearchRowsWithGeoPlaces } from '../src/services/geo/geo-search-rows';
import { TripGeoRetrievalService } from '../src/services/geo/trip-geo-retrieval.service';
import { runTravelRecommendation } from '../src/services/recommendation/pipeline';
import type { TravelSearchIntent } from '../src/services/travel/travel-search.schema';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

async function main() {
  const companyId = arg('--companyId')?.trim();
  const destination = arg('--destination')?.trim() ?? 'Vietnam';
  if (!companyId) {
    console.error('Uso: --companyId=<uuid> [--destination=texto]');
    process.exit(1);
  }

  const trips = await prisma.travelTrip.findMany({
    where: { companyId, status: 'APPROVED' },
    select: travelSearchTripSelect,
  });
  const rows = trips.map(mapTripRowDbToSearchRow);
  await enrichTripSearchRowsWithGeoPlaces(companyId, rows);

  const intent: TravelSearchIntent = {
    destination,
    durationDays: 12,
    budgetPerPerson: 3000,
    month: 3,
  };

  const policy = await prisma.company.findFirst({
    where: { id: companyId },
    select: { recommendationPolicy: true },
  });

  const base = await runTravelRecommendation({
    companyId,
    intent,
    rows,
    options: {
      skipHybridRetrieval: true,
      companyPolicyJson: policy?.recommendationPolicy ?? undefined,
    },
  });

  const plan = await new TripGeoRetrievalService().plan(companyId, intent.destination, {
    bypassFeatureFlag: true,
  });

  let nonRelaxed = rows;
  if (plan.usePrefilter && plan.candidateTripIds?.size && plan.scoringContext) {
    nonRelaxed = rows.filter(
      (r) => plan.candidateTripIds!.has(r.id) || !plan.tripsWithGeoLinkIds.has(r.id),
    );
  }

  const geo = await runTravelRecommendation({
    companyId,
    intent,
    rows,
    options: {
      skipHybridRetrieval: true,
      companyPolicyJson: policy?.recommendationPolicy ?? undefined,
      geoScoringContext: plan.scoringContext,
      nonRelaxedCandidateRows: nonRelaxed,
    },
  });

  const topBase = base.response.ranked[0]?.tripId ?? null;
  const topGeo = geo.response.ranked[0]?.tripId ?? null;

  console.log(
    JSON.stringify(
      {
        companyId,
        destination,
        catalogApproved: rows.length,
        geoPlanNotes: plan.notes,
        geoPrefilter: plan.usePrefilter,
        poolGeo: geo.telemetry.counts.retrievalPool,
        geoPrefilterActive: geo.telemetry.counts.geoPrefilterActive,
        topTripId_base: topBase,
        topTripId_geo: topGeo,
        scoreTop_base: base.response.ranked[0]?.score ?? null,
        scoreTop_geo: geo.response.ranked[0]?.score ?? null,
      },
      null,
      2,
    ),
  );
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
