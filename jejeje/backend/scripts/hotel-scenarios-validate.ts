/**
 * Bloques sintéticos (sin PDF) — Caribe MX, RD, tablas rotas, mayúsculas, prosa falsa.
 * npx ts-node --transpile-only scripts/hotel-scenarios-validate.ts
 */
import {
  extractCleanHotelsFromBlocks,
  maxHotelPersistenceConfidence,
  MIN_HOTEL_CONFIDENCE,
} from '../src/services/travel/trip-hotels-extract.service';

type Scenario = {
  name: string;
  hotelsTableBlock: string;
  hotelDescriptionsBlock: string;
  /** Cadenas que deben aparecer (subconjunto, no recuento fijo). */
  mustInclude: string[];
  /** Cadenas que nunca deben colarse. */
  mustNotInclude: string[];
};

const scenarios: Scenario[] = [
  {
    name: 'Caribe Mexicano (títulos + tabla)',
    hotelsTableBlock: `Ciudad Hotel
· Zona Riviera Hotel Xcaret Mexico
· Zona Banyan Banyan Tree Mayakoba`,
    hotelDescriptionsBlock: `HOTEL XCARET MEXICO
Disfruta el spa y el lujo sin nombre con vistas al maya
Tratamientos de spa, acompañado de noches bajo las estrellas`,
    mustInclude: ['Hotel Xcaret', 'Banyan Tree Mayakoba'],
    mustNotInclude: [
      'tratamientos de spa, acompañado',
      'Disfruta el spa y el lujo',
    ],
  },
  {
    name: 'República Dominicana',
    hotelsTableBlock: `Ciudad Hotel
· Bávaro Hotel Tortuga Bay`,
    hotelDescriptionsBlock: `CASA DE CAMPO
Seguro de viaje y vuelos con tasas
Con el único bosque y naturaleza increíble en Punta Cana`,
    mustInclude: ['Tortuga Bay', 'Casa de Campo'],
    mustNotInclude: ['Seguro de viaje', 'Con el único bosque', 'Tasas'],
  },
  {
    name: 'Tabla de hoteles rota (merge reserve)',
    hotelsTableBlock: `· Área Río Grande HYATT REGENCY GRAND
Reserve Puerto Rico`,
    hotelDescriptionsBlock: ``,
    mustInclude: ['Hyatt Regency Grand Reserve Puerto Rico'],
    mustNotInclude: ['HOTELES', 'naturaleza increíble'],
  },
  {
    name: 'Hoteles en mayúsculas y pegados',
    hotelsTableBlock: ``,
    hotelDescriptionsBlock: `BANYAN TREE MAYAKOBA ROSEWOOD MAYAKOBA`,
    mustInclude: ['Banyan Tree Mayakoba', 'Rosewood Mayakoba'],
    mustNotInclude: ['Comerciales', '300 tiendas'],
  },
  {
    name: 'Narrativa con “hotel” falsa (marca + prosa mezclada)',
    hotelsTableBlock: ``,
    hotelDescriptionsBlock: `Lujo: el hotel ofrece retiros y paz interior en la selva; no es un alojamiento concreto.
Con el hotel podrás descubrir experiencias de spa en grupo sin nombre comercial.
PARADISUS LA PERLA
Ofrece servicios y alojamiento con categoría cinco estrellas`,
    mustInclude: ['Paradisus La Perla'],
    mustNotInclude: [
      'Con el hotel podrás',
      'Lujo: el hotel ofrece',
      'experiencias de spa en grupo',
    ],
  },
  {
    name: 'Frase con “spa / lujo” que no es hotel (rechazada en bloque descriptivo)',
    hotelsTableBlock: ``,
    hotelDescriptionsBlock: `Lujo puro, spa y comerciales con galería de 300 tiendas; acompañado de noches inolvidables.
ANDAZ MAYAKOBA
El resort combina lujo y spa en un solo destino`,
    mustInclude: ['Andaz Mayakoba'],
    mustNotInclude: [
      'Lujo puro, spa y comerciales',
      'acompañado de noches inolvidables',
      '300 tiendas',
    ],
  },
];

let failed = 0;
for (const sc of scenarios) {
  const r = extractCleanHotelsFromBlocks({
    hotelsTableBlock: sc.hotelsTableBlock,
    hotelDescriptionsBlock: sc.hotelDescriptionsBlock,
    fullSegmentText: `${sc.hotelDescriptionsBlock}\n${sc.hotelsTableBlock}`,
    title: sc.name,
  });
  const names = r.hotels.map((h) => h.hotelName);
  const textBlob = names.join(' | ').toLowerCase();
  for (const need of sc.mustInclude) {
    if (!textBlob.includes(need.toLowerCase().replace(/\s+/g, ' '))) {
      console.error(`[${sc.name}] Falta incluir: "${need}"`, 'obtenido:', names);
      failed++;
    }
  }
  for (const bad of sc.mustNotInclude) {
    if (textBlob.includes(bad.toLowerCase().replace(/\s+/g, ' '))) {
      console.error(`[${sc.name}] Prohibido y apareció: "${bad}"`, 'obtenido:', names);
      failed++;
    }
  }
  for (const h of r.hotels) {
    if (h.confidence < MIN_HOTEL_CONFIDENCE) {
      console.error(`[${sc.name}] Conf baja:`, h.hotelName, h.confidence, maxHotelPersistenceConfidence(h.hotelName));
      failed++;
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log('OK: escenarios sintéticos', scenarios.length, '(mín. confiancia', MIN_HOTEL_CONFIDENCE, ')');
process.exit(0);
