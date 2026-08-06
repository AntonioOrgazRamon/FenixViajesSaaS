/**
 * Validación manual: extrae hoteles del fixture Puerto Rico (sin Jest).
 * No exige un número fijo de filas: comprobar subconjunto esperado + ausencia de ruido.
 * npx ts-node --transpile-only scripts/validate-hotel-extract.ts
 */
import { extractCleanHotelsFromBlocks, MIN_HOTEL_CONFIDENCE } from '../src/services/travel/trip-hotels-extract.service';

const hotelsTableBlock = `Ciudad Hotel
· Área Río Grande Hyatt Regency Grand
Reserve Puerto Rico`;

const hotelDescriptionsBlock = `Embárcate en un retiro inolvidable junto a la playa en el hotel resort Hyatt Regency Grand Reserve Puerto Rico...
HYATT REGENCY GRAND RESERVE PUERTO RICO FAIRMONT EL SAN JUAN HOTEL
HOTELES EN PUERTO RICO
Con una ubicación ideal en una antigua granja de cocos y en medio de la naturaleza el St. Regis Bahia Beach Resort cuenta con 2 millas...
El Condado Vanderbilt, se inauguró en 1919...
THE ST. REGIS BAHIA BEACH RESORT CONDADO VANDERBILT
HOTELES EN PUERTO RICO
Descubre la combinación ideal...
EL CONQUISTADOR RESORT DORADO BEACH A RITZ-CARLTON RESERVE
HOTELES EN PUERTO RICO`;

const expected: Array<{ city: string | null; hotelName: string }> = [
  { city: 'Área Río Grande', hotelName: 'Hyatt Regency Grand Reserve Puerto Rico' },
  { city: null, hotelName: 'Fairmont El San Juan Hotel' },
  { city: null, hotelName: 'The St. Regis Bahia Beach Resort' },
  { city: null, hotelName: 'Condado Vanderbilt' },
  { city: null, hotelName: 'El Conquistador Resort' },
  { city: null, hotelName: 'Dorado Beach, a Ritz-Carlton Reserve' },
];

const forbiddenSubstrings = [
  'tratamientos de spa',
  'puerto rico de lujo',
  'día 6 san juan',
  'servicios incluidos',
  'hoteles de',
  'días libres',
  'seguro de viaje',
  'tasas aéreas',
  'experiencias culinarias',
  'acompañado de noches',
];

function coversExpected(
  a: Array<{ city: string | null; hotelName: string }>,
  b: typeof expected,
) {
  for (const e of b) {
    const m = a.find((x) => x.hotelName === e.hotelName && x.city === e.city);
    if (!m) {
      return false;
    }
  }
  return true;
}

const r = extractCleanHotelsFromBlocks({ hotelsTableBlock, hotelDescriptionsBlock, title: 'PR' });

const out = r.hotels.map((h) => ({ city: h.city, hotelName: h.hotelName }));
const blob = r.hotels.map((h) => h.hotelName).join(' ').toLowerCase();
let lowConf = 0;
for (const h of r.hotels) {
  if (h.confidence < MIN_HOTEL_CONFIDENCE) {
    lowConf++;
  }
}
let forbiddenHit = 0;
for (const f of forbiddenSubstrings) {
  if (blob.includes(f)) {
    forbiddenHit++;
  }
}

console.log(JSON.stringify(out, null, 2));
console.log('rejected (sample):', r.rejectedCandidates.slice(0, 15));
const ok =
  coversExpected(out, expected) &&
  lowConf === 0 &&
  forbiddenHit === 0;
console.log('assert:', ok ? 'OK' : 'FAIL', { lowConf, forbiddenHit });

if (!ok) {
  console.log('expected subset:', expected);
  process.exit(1);
}
