/**
 * Prueba resolución geo + prefiltro de viajes (requiere DB migrada y datos).
 *
 * Uso:
 *   npm run geo:test-retrieval -- --companyId=<uuid> --destination="Japón"
 *   npm run geo:test-retrieval -- --smoke   (sin DB, solo asserts de fusión léxico/geo)
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import { TripGeoRetrievalService } from '../src/services/geo/trip-geo-retrieval.service';
import { mergeLexicalAndGeoDestinationPoints } from '../src/services/geo/geo-destination-score';
import type { TravelTripSearchRow, TripGeoPlaceLinkRow } from '../src/services/travel/travel-search.scoring';
import { lexicalDestinationPoints } from '../src/services/travel/travel-search.scoring';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

function smokeMerge() {
  const trip: TravelTripSearchRow = {
    id: 'trip-1',
    provider: null,
    title: 'Demo',
    mainDestination: 'Francia',
    durationDays: 10,
    indicativePrice: null,
    currency: null,
    season: null,
    description: null,
    tripDestinations: [],
    departures: [],
    highlights: [],
    services: [],
    hotels: [],
    itineraryDays: [],
    tripGeoPlaces: [
      {
        geoPlaceId: 'jp-city',
        normalizedKey: 'kyoto:city',
        kind: 'CITY',
        role: 'PRIMARY',
        ancestorIds: ['jp-country'],
      },
    ],
  };
  const geoOpts = {
    expandedIntentGeoPlaceIds: new Set(['jp-city', 'jp-country']),
    intentRootGeoPlaceIds: new Set(['jp-country']),
  };
  const lex = lexicalDestinationPoints('Japón', trip);
  const merged = mergeLexicalAndGeoDestinationPoints(lex, trip, geoOpts);
  if (merged.points <= lex) {
    throw new Error('expected geo bonus when hierarchy matches');
  }
  const unrelated: TripGeoPlaceLinkRow[] = [
    {
      geoPlaceId: 'fr-paris',
      normalizedKey: 'paris:city',
      kind: 'CITY',
      role: 'PRIMARY',
      ancestorIds: [],
    },
  ];
  const pen = mergeLexicalAndGeoDestinationPoints(8, { ...trip, tripGeoPlaces: unrelated }, geoOpts);
  if (pen.points >= pen.lexical) {
    throw new Error('expected geo penalty for unrelated TripGeoPlace');
  }
}

async function main() {
  if (process.argv.includes('--smoke')) {
    smokeMerge();
    console.log('geo:test-retrieval smoke OK');
    return;
  }

  const companyId = arg('--companyId')?.trim();
  const destination = arg('--destination')?.trim() ?? 'Europa';
  if (!companyId) {
    console.error('Uso: npm run geo:test-retrieval -- --companyId=<uuid> [--destination=texto] | --smoke');
    process.exit(1);
  }

  try {
    const svc = new TripGeoRetrievalService();
    const plan = await svc.plan(companyId, destination, { bypassFeatureFlag: true });
    const sampleTripIds = plan.candidateTripIds ? [...plan.candidateTripIds].slice(0, 12) : [];
    console.log(
      JSON.stringify(
        {
          destination,
          notes: plan.notes,
          usePrefilter: plan.usePrefilter,
          expandedSize: plan.scoringContext?.expandedIntentGeoPlaceIds.size ?? 0,
          rootsSize: plan.scoringContext?.intentRootGeoPlaceIds.size ?? 0,
          candidateTrips: plan.candidateTripIds?.size ?? 0,
          tripsWithGeoLinks: plan.tripsWithGeoLinkIds.size,
          sampleTripIds,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
