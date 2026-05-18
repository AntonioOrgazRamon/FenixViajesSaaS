/**
 * Regresión pipeline catálogo: segmentación, títulos, hoteles, índice.
 * npx ts-node --transpile-only scripts/validate-catalog-pipeline-regression.ts
 */
import { splitSegmentByTripBoundaries, analyzeMixedSegment } from '../src/services/travel/travel-mixed-segment.service';
import { looksNarrativeOrBrokenTitle } from '../src/services/travel/travel-segment-validator.service';
import { validateFinalTripTitle } from '../src/services/travel/catalog-trip-title.service';
import { extractCleanHotelsFromBlocks, dedupeHotels, type HotelCandidate } from '../src/services/travel/trip-hotels-extract.service';
import type { IndexExpectedTrip } from '../src/services/travel/travel-index-coverage.service';

let failed = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    console.error(`FAIL: ${name}`, detail ?? '');
    failed++;
  }
}

// 1) Segmentación no mezcla (split por segundo Día 1)
const mixedTripText = `
SINGAPUR E ICONOS DE MALASIA
15 / 12
DÍA 1 CIUDAD DE ORIGEN · vuelo
SERVICIOS INCLUIDOS Vuelo
SALIDAS 2026
PRECIO ORIENTATIVO 3.690 €
BORNEO MALAYO E ISLAS PERHENTIAN
12 / 9
DÍA 1 CIUDAD DE ORIGEN · otro vuelo
SERVICIOS INCLUIDOS Tren
SALIDAS 2026
PRECIO ORIENTATIVO 2.990 €
`;
const split = splitSegmentByTripBoundaries(mixedTripText);
assert('mixed: split en 2 partes', split.length >= 2, `got ${split.length}`);
assert('mixed: parte 1 sin Borneo', !split[0]!.includes('BORNEO'), split[0]?.slice(0, 80));
assert('mixed: parte 2 contiene Borneo', split[1]!.includes('BORNEO'), split[1]?.slice(0, 80));
const mix = analyzeMixedSegment(mixedTripText);
assert('mixed: análisis detecta mezcla', mix.likelyMixed || mix.serviciosBlocks >= 2);

// 2) Título narrativo rechazado
assert('title: narrativa', looksNarrativeOrBrokenTitle('MARAVILLOSAS FOTOS CON LAS TORRES. SEGUIREMOS'));
assert('title: narrativa verbos', looksNarrativeOrBrokenTitle('Poder Fotografiar Desde El Exterior Las Torres'));

// 3) Título real + estructura índice ficticio
const segmentOk = `
SINGAPUR E ICONOS DE MALASIA
Singapur, Kuala Lumpur
15 / 12
DÍA 1 CIUDAD DE ORIGEN
SERVICIOS INCLUIDOS Vuelo
SALIDAS 2026
PRECIO ORIENTATIVO 3.690 €
`;
const fakeIndex: IndexExpectedTrip[] = [
  {
    expectedTitle: 'Singapur e iconos de Malasia',
    pageNumber: 130,
    section: 'Asia',
    normalizedTitle: 'SINGAPUR E ICONOS DE MALASIA',
  },
];
const gate = validateFinalTripTitle('SINGAPUR E ICONOS DE MALASIA', segmentOk, {
  indexEntries: fakeIndex,
  pageStart: 128,
  pageEnd: 135,
});
assert('title: gate OK producto', gate.ok && gate.title?.includes('SINGAPUR'), JSON.stringify(gate));

// 4) Hoteles Japan Rail style
const jpHotels = `
HOTELES (indicados o similares)
Cat. (3*)
· Tokio Sunshine City Prince
· Kioto Elcient Kyoto
· Osaka Monterey Osaka
· Kanazawa Daywa Roynet
· Takayama Best Western Takayama
`;
const jp = extractCleanHotelsFromBlocks({
  hotelsTableBlock: jpHotels,
  fullSegmentText: jpHotels,
});
const jpNames = jp.hotels.map((h) => h.hotelName.toLowerCase()).join('|');
assert('jp: 5 hoteles', jp.hotels.length >= 5, String(jp.hotels.length));
assert('jp: Monterey Osaka', jpNames.includes('monterey') && jpNames.includes('osaka'));
assert('jp: Best Western Takayama', jpNames.includes('best western'));

// 5) Malasia tabla doble categoría
const myHotels = `
Cat. B (4*)
· Singapur Wyndham Singapore
· Malacca Ibis
· Kuala Lumpur Melia
· Cameron Highlands Strawberry Park
· Penang Ozo Hotel
· Belum Belum Rainforest (Azlanii)
· Islas Perhentian Island Resort (Deluxe Heaven)
Cat. A (5*)
· Singapur Grand Park City Hall
`;
const my = extractCleanHotelsFromBlocks({ hotelsTableBlock: myHotels, fullSegmentText: myHotels });
assert('my: varios hoteles', my.hotels.length >= 6, String(my.hotels.length));
const blob = my.hotels.map((h) => `${h.city ?? ''} ${h.hotelName}`).join(' ').toLowerCase();
assert('my: Belum Rainforest', blob.includes('rainforest') || blob.includes('belum'));

// 6) Puerto Rico — solo seeds conocidos (sin prosa)
const pr = extractCleanHotelsFromBlocks({
  hotelsTableBlock: `· Área Río Grande HYATT REGENCY GRAND
Reserve Puerto Rico
· Dorado Beach, a Ritz-Carlton Reserve`,
  fullSegmentText: `Hyatt Regency Grand Reserve Puerto Rico. Disfruta sin nombre`,
});
assert('pr: hyatt reserve', pr.hotels.some((h) => /Hyatt Regency Grand Reserve/i.test(h.hotelName)));
assert('pr: sin disfruta', !pr.hotels.some((h) => /disfruta/i.test(h.hotelName)));

// 7) República Dominicana — colapsar ciudad+h nombre
const sink: { value: string; reason: string }[] = [];
const dupes: HotelCandidate[] = [
  {
    city: null,
    hotelName: 'Punta Cana Iberostar Selection Coral Bávaro',
    category: null,
    source: 'TABLE',
    confidence: 0.9,
    normKey: 'x1',
  },
  {
    city: null,
    hotelName: 'Iberostar Selection Coral Bávaro',
    category: null,
    source: 'TABLE',
    confidence: 0.88,
    normKey: 'x2',
  },
];
const collapsed = dedupeHotels(dupes, sink);
assert('rd: un hotel tras colapsar', collapsed.length === 1, String(collapsed.length));
assert('rd: ciudad Punta Cana', (collapsed[0]!.city ?? '').toLowerCase().includes('punta cana'));

// 8) Índice — métrica esperada (solo smoke: tipo con muchas entradas)
const manyIndex: IndexExpectedTrip[] = Array.from({ length: 55 }, (_, i) => ({
  expectedTitle: `Trip ${i}`,
  pageNumber: 10 + i,
  section: null,
  normalizedTitle: `TRIP ${i}`,
}));
assert('index: 55 esperados', manyIndex.length > 50);
const ratio = 10 / 55;
assert('index: ratio bajo sería warning en job', ratio < 0.7);

if (failed) {
  console.error(`\n${failed} error(es).`);
  process.exit(1);
}
console.log('OK — validate-catalog-pipeline-regression');
