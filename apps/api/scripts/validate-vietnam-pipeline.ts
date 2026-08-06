/**
 * Validación sintética Vietnam 2026/27:
 * - segmentación no debe crear títulos narrativos del itinerario
 * - hoteles en bloque "HOTELES (indicados o similares)" con ciudad + categoría
 *
 * npx ts-node --transpile-only scripts/validate-vietnam-pipeline.ts
 */
import { buildIcarionSegments } from '../src/services/travel/trip-segmentation-icarion';
import { extractCleanHotelsFromBlocks, filterHotelsForPersistence, normKey, normalizeHotelName } from '../src/services/travel/trip-hotels-extract.service';

const indexPage = `
ÍNDICE
Encantos de Vietnam
Encantos de Vietnam y Camboya
Luxury Vietnam
Luxury Vietnam y Camboya
`;

const fichaLuxury = `
LUXURY VIETNAM Y CAMBOYA
Hanoi, Bahía de Halong, Danang, Hoian, Hue, Ho Chi Minh y Siem Reap
Este viaje a Vietnam y Camboya, te permite descubrir estos países, alojándote en los mejores hoteles.
14 / 11

Día 1 Ciudad de origen - Hanoi
Llegada.
Día 2 Hanoi
Visitas en la ciudad.
Día 3 Hanoi - Bahía de Halong
Crucero.
Día 14 Ciudad de origen
Llegada.

SERVICIOS INCLUIDOS
...
SALIDAS 2026/27
...
PRECIO ORIENTATIVO
...

HOTELES (indicados o similares)
Ciudad Hotel
Cat. (5*/5*LUX)
· Hanoi Sofitel Legend Metropole
· Bahía de Halong Indochine Premium
· Hoian Namia River Retreat
· Hue Pilgrimage Village
· Ho Chi Minh Park Hyatt
· Siem Reap Park Hyatt
`;

const narrativeTrap = `
EN CU CHE NHA Y TENER UNA MARAVILLOSA VISIÓN
MARAVILLOSAS VISTAS PANORÁMICAS, HERMOSOS
HALONG. EMBARQUE EN UN MARAVILLOSO CRUCERO
PASEAR POR HOIAN, UNA MARAVILLA DE CIUDAD
`;

const pages = [
  { page: 2, text: indexPage },
  { page: 10, text: fichaLuxury },
  { page: 11, text: narrativeTrap },
];

const seg = buildIcarionSegments(pages, { log: false }).segments;
const badTitleRe =
  /(EN CU CHE|MARAVILLOSAS VISTAS|HALONG\.\s*EMBARQUE|PASEAR POR HOIAN|TENER UNA MARAVILLOSA VISI[ÓO]N)/i;
if (seg.some((s) => badTitleRe.test(s.title))) {
  console.error('FAIL: segmentación incluyó título narrativo', seg.map((x) => x.title));
  process.exit(1);
}
if (!seg.some((s) => /LUXURY\s+VIETNAM\s+Y\s+CAMBOYA/i.test(s.title))) {
  console.error('FAIL: no detectó "Luxury Vietnam y Camboya"');
  process.exit(1);
}

const hotels = extractCleanHotelsFromBlocks({
  hotelsTableBlock: `
HOTELES (indicados o similares)
Ciudad Hotel
Cat. (5*/5*LUX)
· Hanoi Sofitel Legend Metropole
· Bahía de Halong Indochine Premium
· Hoian Namia River Retreat
· Hue Pilgrimage Village
· Ho Chi Minh Park Hyatt
· Siem Reap Park Hyatt
`,
  hotelDescriptionsBlock: '',
  fullSegmentText: fichaLuxury,
  title: 'LUXURY VIETNAM Y CAMBOYA',
});

const rows = hotels.hotels.map((h, i) => ({
  category: h.category,
  city: h.city,
  hotelName: h.hotelName,
  order: i,
}));
const wl = new Set(rows.map((x) => normKey(normalizeHotelName(x.hotelName ?? ''))).filter(Boolean));
const persisted = filterHotelsForPersistence(rows, { visualWhitelistNormKeys: wl }).kept;

const expected = [
  { city: 'Hanoi', hotelName: 'Sofitel Legend Metropole', category: '5*/5*LUX' },
  { city: 'Bahía de Halong', hotelName: 'Indochine Premium', category: '5*/5*LUX' },
  { city: 'Hoian', hotelName: 'Namia River Retreat', category: '5*/5*LUX' },
  { city: 'Hue', hotelName: 'Pilgrimage Village', category: '5*/5*LUX' },
  { city: 'Ho Chi Minh', hotelName: 'Park Hyatt', category: '5*/5*LUX' },
  { city: 'Siem Reap', hotelName: 'Park Hyatt', category: '5*/5*LUX' },
];

for (const e of expected) {
  if (!persisted.some((x) => x.city === e.city && x.hotelName === e.hotelName && (x.category ?? null) === e.category)) {
    console.error('FAIL: falta hotel esperado', e, persisted);
    process.exit(1);
  }
}

const forbidden = ['Hyatt De Siem Reap', 'Ho Chi Minh Park Hyatt', 'Siem Reap Park Hyatt'];
for (const f of forbidden) {
  if (persisted.some((x) => (x.hotelName ?? '').toLowerCase() === f.toLowerCase())) {
    console.error('FAIL: hotel prohibido', f, persisted);
    process.exit(1);
  }
}

console.log('OK: Vietnam segmentation + hotels quality');
