/**
 * Smoke test retrieval híbrido (logs legibles).
 * Con QA_COMPANY_ID + DATABASE_URL carga catálogo real; si no, demo en memoria.
 *
 * npm run qa:hybrid-retrieval
 */
import 'dotenv/config';
import type { TravelSearchIntent } from '../src/services/travel/travel-search.schema';
import { hybridRetrievalPreview } from '../src/services/recommendation/retrieval/hybrid-retrieval.service';
import { mapTripRowDbToSearchRow, travelSearchTripSelect } from '../src/services/travel/travel-search.service';
import type { TravelTripSearchRow } from '../src/services/travel/travel-search.scoring';
import prisma from '../src/infrastructure/db';

function baseTrip(id: string, dest: string, title: string): TravelTripSearchRow {
  return {
    id,
    provider: null,
    title,
    mainDestination: dest,
    durationDays: 14,
    indicativePrice: '3200',
    currency: 'EUR',
    season: 'Otoño',
    description: 'Circuito cultural y gastronomía',
    tripDestinations: [{ destination: { name: dest, normalizedName: dest.toLowerCase() } }],
    departures: [{ startDate: new Date('2026-10-05T00:00:00.000Z'), endDate: null, departureText: '' }],
    highlights: [{ text: 'Templos y mercados locales' }],
    services: [{ type: 'INCLUDED', text: 'desayunos' }],
    hotels: [{ hotelName: 'Boutique', city: 'Capital', category: '4*' }],
    itineraryDays: [{ dayNumber: 1, title: 'Llegada', description: null }],
    luxuryLevel: 'COMFORT',
    budgetTier: 'UPPER_MID',
    pace: 'MODERATE',
    climatePreference: null,
    exclusivity: null,
    styleAxes: ['CULTURE', 'GASTRONOMY'],
  };
}

async function main() {
  const companyEnv = process.env.QA_COMPANY_ID?.trim();
  const intent: TravelSearchIntent = {
    destination: 'Japón',
    durationDays: 14,
    month: 10,
    travelStyleAxes: ['CULTURE', 'GASTRONOMY'],
    budgetPerPerson: 3500,
    travelers: 2,
  };

  let companyId = companyEnv ?? 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  let rows: TravelTripSearchRow[];

  if (companyEnv) {
    const trips = await prisma.travelTrip.findMany({
      where: { companyId, status: 'APPROVED' },
      take: 80,
      select: travelSearchTripSelect,
      orderBy: { updatedAt: 'desc' },
    });
    rows = trips.map(mapTripRowDbToSearchRow);
  } else {
    rows = [
      baseTrip('11111111-1111-4111-1111-111111111111', 'Japón', 'Japón clásico 14 días'),
      baseTrip('22222222-2222-4222-2222-222222222222', 'Vietnam', 'Vietnam gastronómico 14 días'),
    ];
  }

  const t0 = Date.now();
  const preview = await hybridRetrievalPreview(companyId, intent, rows);
  const ms = Date.now() - t0;

  console.log('--- QA hybrid retrieval ---');
  console.log('intent:', JSON.stringify(intent));
  console.log('catalog rows:', rows.length);
  console.log('time_ms:', ms);
  console.log('stats:', preview.stats);
  console.log('warnings:', preview.warnings);
  if (preview.channels) {
    console.log('structured top:', preview.channels.structured.slice(0, 5));
    console.log('lexical top:', preview.channels.lexical.hits.slice(0, 5));
    console.log('vector top:', preview.channels.vector.hits.slice(0, 5));
  }
  console.log('hybrid top:', preview.candidates.slice(0, 8));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
