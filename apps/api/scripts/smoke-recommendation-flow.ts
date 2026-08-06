/**
 * Smoke: motor Fase 1 en memoria + comprobación de tablas en BD si hay DATABASE_URL.
 * No crea leads ni PDFs; valida que el stack compile y que la migración del motor exista.
 *
 * npm run smoke:recommendation
 */
import 'dotenv/config';
import { runTravelRecommendation } from '../src/services/recommendation/pipeline';
import type { TravelSearchIntent } from '../src/services/travel/travel-search.schema';
import type { TravelTripSearchRow } from '../src/services/travel/travel-search.scoring';

function row(id: string, dest: string, days: number, price: string): TravelTripSearchRow {
  return {
    id,
    provider: null,
    title: `Viaje ${dest}`,
    mainDestination: dest,
    durationDays: days,
    indicativePrice: price,
    currency: 'EUR',
    season: 'Primavera',
    description: 'Cultural',
    tripDestinations: [{ destination: { name: dest, normalizedName: dest.toLowerCase() } }],
    departures: [],
    highlights: [{ text: 'Highlight' }],
    services: [{ type: 'INCLUDED', text: 'Vuelos' }],
    hotels: [],
    itineraryDays: [],
    luxuryLevel: 'STANDARD',
    budgetTier: 'MID',
    pace: 'MODERATE',
    climatePreference: null,
    exclusivity: null,
    styleAxes: ['CULTURE'],
  };
}

void (async () => {
  const intent: TravelSearchIntent = {
    destination: 'Italia',
    durationDays: 10,
    budgetPerPerson: 2800,
    month: 5,
  };

  const a = row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Italia', 10, '2600');
  const b = row('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'Grecia', 9, '2400');

  const { response, telemetry } = await runTravelRecommendation({
    companyId: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
    intent,
    rows: [a, b],
    options: { skipHybridRetrieval: true },
  });

  const ok =
    response.ranked.length >= 1 &&
    response.picks.recommended != null &&
    telemetry.counts.catalogApproved === 2;

  if (!ok) {
    console.error('Smoke motor: resultado inesperado', { response, telemetry });
    process.exit(1);
  }

  console.log('OK motor in-memory (Fase 1): ranked=', response.ranked.length, 'slots=', {
    rec: response.picks.recommended?.tripId,
    budget: response.picks.budget?.tripId,
    luxury: response.picks.luxury?.tripId,
  });

  if (process.env.DATABASE_URL) {
    const prisma = (await import('../src/infrastructure/db')).default;
    try {
      await prisma.recommendationRun.findFirst({ select: { id: true } });
      await prisma.travelTripEmbedding.findMany({ take: 1 });
      console.log('OK BD: tablas recommendation_runs y travel_trip_embeddings accesibles.');
    } catch (e) {
      console.warn('Advertencia BD smoke:', e);
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  } else {
    console.log('Sin DATABASE_URL: omitida comprobación de tablas.');
  }

  console.log('Smoke recommendation: OK');
})();
