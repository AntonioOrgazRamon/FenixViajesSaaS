/**
 * Casos deterministas motor de recomendación Fase 1 (pipeline completo, sin DB).
 * npm run test:travel-search
 */
import type { TravelSearchIntent } from '../src/services/travel/travel-search.schema';
import { tokenJaccard, tokenize, type TravelTripSearchRow } from '../src/services/travel/travel-search.scoring';
import { runTravelRecommendation } from '../src/services/recommendation/pipeline';

let failed = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    console.error('FAIL:', name, detail ?? '');
    failed++;
  }
}

function baseTrip(id: string, overrides: Partial<TravelTripSearchRow> = {}): TravelTripSearchRow {
  const row: TravelTripSearchRow = {
    id,
    provider: null,
    title: 'Circuito Vietnam',
    mainDestination: 'Vietnam',
    durationDays: 12,
    indicativePrice: '2500',
    currency: 'EUR',
    season: 'Primavera',
    description: 'Viaje cultural con naturaleza',
    tripDestinations: [
      { destination: { name: 'Vietnam', normalizedName: 'vietnam' } },
      { destination: { name: 'Hanói', normalizedName: 'hanoi' } },
    ],
    departures: [{ startDate: new Date('2026-03-10T00:00:00.000Z'), endDate: null, departureText: 'Salida marzo' }],
    highlights: [{ text: 'Bahía de Ha Long' }],
    services: [{ type: 'INCLUDED', text: 'vuelos directos' }],
    hotels: [{ hotelName: 'Boutique', city: 'Hanói', category: '4*' }],
    itineraryDays: [
      { dayNumber: 1, title: 'Llegada', description: null },
      { dayNumber: 2, title: 'Visita ciudad', description: 'Tour' },
    ],
    styleAxes: [],
    ...overrides,
  };
  return row;
}

void (async () => {
  assert('jaccard identical', tokenJaccard(['a', 'b'], ['b', 'a']) === 1);
  assert('tokenize min len', tokenize('aa bb ccc').join(',') === 'ccc');

  const intentFull: TravelSearchIntent = {
    destination: 'Vietnam',
    durationDays: 12,
    budgetPerPerson: 2800,
    month: 3,
    travelers: 2,
    travelType: 'cultural',
    tags: ['nature'],
    preferences: ['vuelos directos'],
  };

  const tripA = baseTrip('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
  const tripExpensive = baseTrip('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', {
    indicativePrice: '4000',
    title: 'Vietnam Deluxe',
    luxuryLevel: 'LUXURY',
    highlights: [...tripA.highlights, { text: 'Extra' }],
    services: [...tripA.services, { type: 'INCLUDED', text: 'todo incluido' }],
    hotels: [...tripA.hotels, { hotelName: 'Resort', city: 'Danang', category: '5*' }],
  });
  const tripCheap = baseTrip('cccccccc-cccc-4ccc-cccc-cccccccccccc', {
    indicativePrice: '1900',
    title: 'Vietnam Esencial',
    durationDays: 10,
    luxuryLevel: 'STANDARD',
  });

  const { response } = await runTravelRecommendation({
    companyId: 'dddddddd-dddd-4ddd-dddd-dddddddddddd',
    intent: intentFull,
    rows: [tripA, tripExpensive, tripCheap],
    options: { skipHybridRetrieval: true },
  });

  const picks = response.picks;
  const ranked = response.ranked;

  assert('schema v2', response.schemaVersion === '2.0.0');
  assert('ranked non-empty', ranked.length >= 1);
  assert('score range no plateau', ranked[0].score > 40 && ranked[0].score <= 100, String(ranked[0].score));
  assert('contributions', (ranked[0].contributions?.length ?? 0) >= 1);
  assert('recommended top score', picks.recommended?.tripId === ranked[0].tripId);
  assert('budget cheapest id', picks.budget?.tripId === tripCheap.id);
  assert('luxury expensive id', picks.luxury?.tripId === tripExpensive.id);

  const intentEmpty: TravelSearchIntent = {};
  const loose = await runTravelRecommendation({
    companyId: 'dddddddd-dddd-4ddd-dddd-dddddddddddd',
    intent: intentEmpty,
    rows: [tripA],
    options: { skipHybridRetrieval: true },
  });
  assert('no criteria uses dossier', loose.response.ranked[0]?.score != null, String(loose.response.ranked[0]?.score));

  console.log('\nEjemplo ranked[0]:', JSON.stringify(ranked[0], null, 2));
  console.log(
    '\nPicks:',
    JSON.stringify(
      {
        recommended: picks.recommended?.tripId,
        budget: picks.budget?.tripId,
        luxury: picks.luxury?.tripId,
        alternative: picks.alternative?.tripId,
      },
      null,
      2,
    ),
  );

  if (failed) {
    console.error(`\n${failed} error(es).`);
    process.exit(1);
  }
  console.log('\nOK travel search validate');
})();
