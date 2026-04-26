/**
 * Aserciones sobre el validador de hoteles (sin PDF).
 * npx ts-node --transpile-only scripts/hotel-guard-cases.ts
 */
import {
  finalHotelPersistenceBarrier,
  maxHotelPersistenceConfidence,
  MIN_HOTEL_CONFIDENCE,
  normalizeHotelName,
  rejectHotelCandidate,
} from '../src/services/travel/trip-hotels-extract.service';

const mustReject = [
  'Puerto Rico DE Lujo',
  'La Posibilidad De Visitar Alguna De Las Escasas',
  'Lujo Se Mezclan Con La Elegancia Tropical Del',
  'Excelente En Esta Isla, Desde Los Recuerdos y',
  'Servicios Incluidos',
  'Salidas 2025/26',
  'Días 3 - 5 Puerto Rico',
  'Día 6 San Juan - Ciudad De Origen',
  'Seguro De Viaje',
  'Hoteles (indicados o Similares)',
  'Del 1/5/25 Al 31/3/26: Diarias',
  'CARIBE DE LUJO 2025/26',
  'Tratamientos De Spa, Acompañado De Noches',
  'Experiencias Culinarias Increíbles',
  'Comerciales Con Más De 300 Tiendas',
  'Hoteles De',
  'Días Libres',
  'Tasas Aéreas y Carburante',
  'Con El Único Bosque Lluvioso',
  'A Todo Ello Se Une Una Naturaleza Increíble',
];

const mustPassMinConf = [
  'Hyatt Regency Grand Reserve Puerto Rico',
  'FAIRMONT EL SAN JUAN HOTEL',
  'THE ST. REGIS BAHIA BEACH RESORT',
  'Dorado Beach, a Ritz-Carlton Reserve',
  'Condado Vanderbilt',
  'Iberostar Bávaro',
];

/** Barrera final (sin whitelist): narrativa real que colaba en PR */
const mustRejectFinalBarrier = [
  'Bahías Bioluminiscentes Del Mundo.',
  'Noche a Bordo.',
  'Excursión a bahías bioluminiscentes',
];

const mustPassFinalBarrier = [
  'Hyatt Regency Grand Reserve Puerto Rico',
  'Fairmont El San Juan Hotel',
  'The St. Regis Bahia Beach Resort',
  'Condado Vanderbilt',
  'El Conquistador Resort',
  'Dorado Beach, a Ritz-Carlton Reserve',
];

let fail = 0;
for (const s of mustReject) {
  if (maxHotelPersistenceConfidence(s) >= MIN_HOTEL_CONFIDENCE) {
    console.error('NO debía aceptar:', s, 'max', maxHotelPersistenceConfidence(s), 'reject', rejectHotelCandidate(s));
    fail++;
  }
}
for (const s of mustPassMinConf) {
  if (maxHotelPersistenceConfidence(s) < MIN_HOTEL_CONFIDENCE) {
    console.error('Debería alcanzar confiencia mín. (al menos bajo un origen):', s);
    fail++;
  }
}

for (const s of mustRejectFinalBarrier) {
  if (finalHotelPersistenceBarrier(s) == null) {
    console.error('finalHotelPersistenceBarrier debía rechazar:', s);
    fail++;
  }
}
for (const s of mustPassFinalBarrier) {
  if (finalHotelPersistenceBarrier(s) != null) {
    console.error('finalHotelPersistenceBarrier no debía rechazar:', s, finalHotelPersistenceBarrier(s));
    fail++;
  }
}

const fair = normalizeHotelName('FAIRMONT EL SAN JUAN HOTEL');
if (!/Fairmont El San Juan Hotel/i.test(fair)) {
  console.error('normalizeHotelName Fairmont:', fair);
  fail++;
}

if (fail) {
  process.exit(1);
}
console.log(
  'OK: guardas conf + barrera final +',
  mustPassFinalBarrier.length,
  'PR + normalización Fairmont',
);
process.exit(0);
