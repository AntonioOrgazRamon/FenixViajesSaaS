/**
 * Tests TripCandidateQualityService — fragmentos, hoteles, inferencia título, deduplicado.
 * npx ts-node --transpile-only scripts/validate-candidate-quality.ts
 */
import type { TripAiExtract } from '../src/services/travel/trip-ai.schemas';
import {
  dedupeAndMergeCandidates,
  evaluateTripCandidate,
  inferCommercialTitleNearStructure,
  isGarbageFragmentTitle,
  normalizeTitleForDedupe,
  type PersistReadyCandidate,
} from '../src/services/travel/trip-candidate-quality.service';
import type { TravelSegmentValidationResult } from '../src/services/travel/travel-segment-validator.service';

const emptySegVal: TravelSegmentValidationResult = {
  isValidTravel: true,
  confidence: 0.8,
  reasons: [],
  detectedType: 'TRAVEL',
};

function baseTrip(title: string, over: Partial<TripAiExtract> = {}): TripAiExtract {
  return {
    title,
    provider: null,
    season: null,
    mainDestination: 'Asia',
    description: 'Desc',
    durationDays: 15,
    durationNights: 12,
    indicativePrice: 3690,
    currency: 'EUR',
    confidence: 0.8,
    destinations: [{ name: 'Singapur', type: 'CITY' }],
    itineraryDays: [
      { dayNumber: 1, title: null, description: 'Origen', meals: null, accommodation: null, order: 0 },
      { dayNumber: 2, title: null, description: 'Tour', meals: null, accommodation: null, order: 1 },
      { dayNumber: 3, title: null, description: 'Tour', meals: null, accommodation: null, order: 2 },
    ],
    services: [{ type: 'INCLUDED', text: 'Vuelo', order: 0 }],
    departures: [{ departureText: '2026', startDate: null, endDate: null, weekdays: null, order: 0 }],
    hotels: [{ hotelName: 'Test', city: null, category: null, order: 0 }],
    highlights: [],
    observations: [],
    ...over,
  };
}

const prText = `
PUERTO RICO DE LUJO
Puerto Rico
7 / 5
DÍA 1 CIUDAD DE ORIGEN
DÍA 2 San Juan
SERVICIOS INCLUIDOS Vuelos
SALIDAS 2026
PRECIO ORIENTATIVO 2.500 €
HOTELES (indicados)
`;

let failed = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    console.error('FAIL:', name, detail ?? '');
    failed++;
  }
}

assert('garbage: autocar', isGarbageFragmentTitle('AUTOCAR LA PLAZA DEL PALACIO IMPERIAL Y EL TEMPLO'));
assert('garbage: bali bullet', isGarbageFragmentTitle('· Bali Tony Villas'));
assert('garbage: tendremos', isGarbageFragmentTitle('Y TENDREMOS TIEMPO PARA DESCUBRIR EL MARAVILLOSO MUNDO SUBMARINO'));
assert('not garbage: singapur', !isGarbageFragmentTitle('SINGAPUR E ICONOS DE MALASIA'));

const singaporeText = `
MARAVILLOSAS FOTOS CON LAS TORRES. SEGUIREMOS
SINGAPUR E ICONOS DE MALASIA
Singapur, Kuala Lumpur
15 / 12
DÍA 1 CIUDAD DE ORIGEN
SERVICIOS INCLUIDOS
SALIDAS 2026
PRECIO ORIENTATIVO 3.690 €
`;
const inferred = inferCommercialTitleNearStructure(singaporeText, 'MARAVILLOSAS FOTOS CON LAS TORRES. SEGUIREMOS');
assert('infer: corrige a Singapur', !!inferred && /SINGAPUR/i.test(inferred!), inferred ?? 'null');

const prTrip = baseTrip('PUERTO RICO DE LUJO', { mainDestination: 'Puerto Rico' });
const prEval = evaluateTripCandidate({
  segmentText: prText,
  trip: prTrip,
  pageStart: 40,
  pageEnd: 44,
  indexEntries: [],
  originalSegmentTitle: 'PUERTO RICO DE LUJO',
});
assert('pr: score valid', prEval.score >= 70, String(prEval.score));
assert('pr: decision valid', prEval.decision === 'VALID', prEval.decision);

const autoEval = evaluateTripCandidate({
  segmentText: 'AUTOCAR LA PLAZA\nDÍA 2 foo',
  trip: baseTrip('AUTOCAR LA PLAZA DEL PALACIO'),
  pageStart: 1,
  pageEnd: 2,
  indexEntries: [],
  originalSegmentTitle: 'AUTOC',
});
assert('autocar: reject', autoEval.decision === 'REJECT' || autoEval.score < 50);

const hotelOnly = evaluateTripCandidate({
  segmentText: '· Bali Tony Villas\npool spa',
  trip: baseTrip('· Bali Tony Villas', {
    itineraryDays: [],
    durationDays: null,
    durationNights: null,
    indicativePrice: null,
    services: [],
    departures: [],
    hotels: [{ hotelName: 'Bali Tony Villas', city: 'Bali', category: null, order: 0 }],
  }),
  pageStart: 1,
  pageEnd: 1,
  indexEntries: [],
  originalSegmentTitle: '· Bali Tony Villas',
});
assert('hotel bullet: reject', hotelOnly.decision === 'REJECT' || hotelOnly.score < 50);

const stubPack = (
  title: string,
  pages: [number, number],
  score: number,
  trip: TripAiExtract,
): PersistReadyCandidate => ({
  seg: { pageStart: pages[0], pageEnd: pages[1], title, rawTextForAI: '' },
  cleaned: '',
  aiNorm: trip,
  confidence: 0.8,
  structuredHotelWhitelistNormKeys: new Set(),
  quality: {
    score,
    decision: score >= 70 ? 'VALID' : 'REVIEW',
    rejectCode: null,
    positiveSignals: [],
    negativeSignals: [],
    titleNormalized: normalizeTitleForDedupe(trip.title),
    titleInferred: null,
    strongSignalCount: 6,
    strongSignalsPresent: ['day1', 'itinerary_3plus', 'duration_xy', 'precio_orientativo', 'servicios_incluidos', 'salidas'],
    missingStrongSignals: [],
  },
  segmentValidation: emptySegVal,
});

const indiaTrip = baseTrip('INDIA SORPRENDENTE CON AMRITSAR', {
  durationDays: 14,
  durationNights: 11,
});
const p1 = stubPack('india a', [100, 102], 82, { ...indiaTrip });
const p2 = stubPack('india b', [101, 103], 71, { ...indiaTrip, description: 'más texto enriquecido '.repeat(8) });
const merged = dedupeAndMergeCandidates([p1, p2], () => undefined);
assert('dedupe: una india', merged.length === 1, String(merged.length));
assert('dedupe: gana mayor score', merged[0]!.quality.score >= 82, String(merged[0]?.quality.score));

if (failed) {
  console.error(`\n${failed} error(es).`);
  process.exit(1);
}
console.log('OK — validate-candidate-quality');
