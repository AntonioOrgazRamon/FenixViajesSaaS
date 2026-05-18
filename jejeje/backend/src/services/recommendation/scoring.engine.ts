import type { TravelSearchIntent, ScoreContribution } from '../travel/travel-search.schema';
import type { DestinationPointsGeoOpts, TravelTripSearchRow } from '../travel/travel-search.scoring';
import { lexicalDestinationPoints, normalizeKey, tokenize, tokenJaccard } from '../travel/travel-search.scoring';
import { LuxuryLevel, TripPace, type TravelStyleAxis } from '@prisma/client';
import { luxuryRank } from './policy.util';
import { SEMANTIC_SIMILARITY_MAX_POINTS } from './constants';
import { mergeLexicalAndGeoDestinationPoints } from '../geo/geo-destination-score';

const MONTH_NAMES_ES: Record<number, string[]> = {
  1: ['enero'],
  2: ['febrero'],
  3: ['marzo'],
  4: ['abril'],
  5: ['mayo'],
  6: ['junio'],
  7: ['julio'],
  8: ['agosto'],
  9: ['septiembre', 'setiembre'],
  10: ['octubre'],
  11: ['noviembre'],
  12: ['diciembre'],
};

function monthHintFromSeason(season: string | null, targetMonth: number): boolean {
  if (!season?.trim()) return false;
  const k = normalizeKey(season);
  const hints = MONTH_NAMES_ES[targetMonth] ?? [];
  return hints.some((h) => k.includes(normalizeKey(h).replace(/-/g, '')) || k.includes(h));
}

export function tripCorpus(t: TravelTripSearchRow): string {
  const parts = [
    t.title,
    t.mainDestination,
    t.description,
    t.season,
    ...t.tripDestinations.map((d) => d.destination.name),
    ...t.highlights.map((h) => h.text),
    ...t.services.map((s) => s.text),
    ...t.hotels.map((h) => [h.hotelName, h.city, h.category].filter(Boolean).join(' ')),
    ...t.itineraryDays.flatMap((d) => [d.title, d.description].filter(Boolean) as string[]),
  ];
  return parts.filter(Boolean).join(' \n ');
}

export function destinationPoints(
  intentDest: string | undefined,
  trip: TravelTripSearchRow,
  geoOpts?: DestinationPointsGeoOpts,
): number {
  const lex = lexicalDestinationPoints(intentDest, trip);
  return mergeLexicalAndGeoDestinationPoints(lex, trip, geoOpts).points;
}

export function mergeDestinationScoreDetail(
  intentDest: string | undefined,
  trip: TravelTripSearchRow,
  geoOpts?: DestinationPointsGeoOpts,
) {
  const lex = lexicalDestinationPoints(intentDest, trip);
  const merged = mergeLexicalAndGeoDestinationPoints(lex, trip, geoOpts);
  return { ...merged, intentPresent: Boolean(intentDest?.trim()) };
}

function durationFactor(
  intentDays: number | undefined,
  tripDays: number | null,
): { pts: number; max: number; miss: boolean; detail: string } {
  const max = 20;
  if (intentDays == null) {
    return { pts: 0, max: 0, miss: false, detail: 'Duración (sin criterio)' };
  }
  if (tripDays == null) {
    return { pts: 8, max, miss: true, detail: `Duración 8/${max} (catálogo sin días)` };
  }
  const diff = Math.abs(tripDays - intentDays);
  const pts = Math.max(0, Math.round(max - diff * 2));
  return {
    pts,
    max,
    miss: pts < max * 0.35,
    detail: `Duración ${pts}/${max}`,
  };
}

function budgetFactor(
  budget: number | undefined,
  price: number | null,
): { pts: number; max: number; miss: boolean; detail: string } {
  const max = 20;
  if (budget == null) {
    return { pts: 0, max: 0, miss: false, detail: 'Presupuesto (sin criterio)' };
  }
  if (price == null || !Number.isFinite(price)) {
    return { pts: 5, max, miss: true, detail: `Presupuesto 5/${max} (sin precio en catálogo)` };
  }
  const ratio = price / budget;
  let pts = 4;
  if (ratio <= 1) pts = 20;
  else if (ratio <= 1.08) pts = 18;
  else if (ratio <= 1.15) pts = 16;
  else if (ratio <= 1.25) pts = 13;
  else if (ratio <= 1.4) pts = 10;
  else if (ratio <= 1.6) pts = 7;
  return {
    pts,
    max,
    miss: ratio > 1.15,
    detail: `Presupuesto ${pts}/${max}`,
  };
}

function monthFromIntent(intent: TravelSearchIntent): number | null {
  if (intent.month != null) return intent.month;
  if (intent.approximateStartDate) {
    const d = new Date(intent.approximateStartDate);
    const m = d.getUTCMonth() + 1;
    if (m >= 1 && m <= 12) return m;
  }
  return null;
}

function datesFactor(
  intent: TravelSearchIntent,
  trip: TravelTripSearchRow,
): { pts: number; max: number; miss: boolean; detail: string } {
  const max = 15;
  const m = monthFromIntent(intent);
  if (m == null) {
    return { pts: 0, max: 0, miss: false, detail: 'Calendario (sin criterio)' };
  }
  let hit = false;
  for (const dep of trip.departures) {
    const sd = dep.startDate;
    const ed = dep.endDate;
    if (sd) {
      const dm = sd.getUTCMonth() + 1;
      if (dm === m) hit = true;
    } else if (ed) {
      const dm = ed.getUTCMonth() + 1;
      if (dm === m) hit = true;
    }
  }
  if (hit) {
    return { pts: max, max, miss: false, detail: `Calendario ${max}/${max}` };
  }
  if (monthHintFromSeason(trip.season, m)) {
    const p = Math.round(max * 0.65);
    return { pts: p, max, miss: false, detail: `Calendario ${p}/${max} (temporada)` };
  }
  if (!trip.departures.length && !trip.season?.trim()) {
    return {
      pts: 6,
      max,
      miss: true,
      detail: `Calendario 6/${max} (sin salidas/temporada en catálogo)`,
    };
  }
  return { pts: 3, max, miss: true, detail: `Calendario 3/${max}` };
}

function keywordFactor(
  intent: TravelSearchIntent,
  trip: TravelTripSearchRow,
): { pts: number; max: number; detail: string } {
  const max = 15;
  const raw: string[] = [];
  if (intent.travelType?.trim()) raw.push(intent.travelType);
  if (intent.tags?.length) raw.push(...intent.tags);
  if (intent.preferences?.length) raw.push(...intent.preferences);
  if (intent.travelers != null) raw.push(`viajeros ${intent.travelers}`);
  const userTokens = tokenize(raw.join(' '));
  if (!userTokens.length) {
    return { pts: 0, max: 0, detail: 'Preferencias (sin criterio)' };
  }
  const tripTokens = tokenize(tripCorpus(trip));
  const j = tokenJaccard(userTokens, tripTokens);
  const pts = Math.round(j * max);
  return {
    pts,
    max,
    detail: `Preferencias ${pts}/${max}`,
  };
}

/** Alineación intención ↔ ejes de experiencia estructurados en el viaje (penaliza UNKNOWN). */
function ontologyFactor(
  intent: TravelSearchIntent,
  trip: TravelTripSearchRow,
): { pts: number; max: number; detail: string } {
  const max = 12;
  const axes = (intent.travelStyleAxes?.length ? intent.travelStyleAxes : inferAxesFromKeywords(intent)) as TravelStyleAxis[];
  if (!axes.length) {
    return { pts: 0, max: 0, detail: 'Estilo (sin criterio estructurado)' };
  }
  const tripAxes = new Set(trip.styleAxes ?? []);
  if (!tripAxes.size && trip.luxuryLevel === LuxuryLevel.UNKNOWN && trip.pace === TripPace.UNKNOWN) {
    return { pts: 4, max, detail: `Estilo 4/${max} (catálogo sin etiquetas)` };
  }
  let hits = 0;
  for (const a of axes) {
    if (tripAxes.has(a)) hits++;
  }
  const ratio = hits / axes.length;
  const pts = Math.round(ratio * max);
  return {
    pts,
    max,
    detail: `Estilo estructurado ${pts}/${max}`,
  };
}

export function inferAxesFromKeywords(intent: TravelSearchIntent): TravelStyleAxis[] {
  const raw = [intent.travelType, ...(intent.tags ?? []), ...(intent.preferences ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const out = new Set<TravelStyleAxis>();
  const add = (s: string, a: TravelStyleAxis) => {
    if (raw.includes(s)) out.add(a);
  };
  add('cultura', 'CULTURE');
  add('cultural', 'CULTURE');
  add('playa', 'BEACH');
  add('naturaleza', 'NATURE');
  add('aventura', 'ADVENTURE');
  add('gastronom', 'GASTRONOMY');
  add('wellness', 'WELLNESS');
  add('spa', 'WELLNESS');
  add('fiesta', 'NIGHTLIFE');
  add('nocturn', 'NIGHTLIFE');
  add('city', 'CITY_BREAK');
  add('urban', 'CITY_BREAK');
  add('crucero', 'CRUISE');
  add('safari', 'SAFARI');
  add('ski', 'SKI');
  add('esqui', 'SKI');
  add('familia', 'FAMILY');
  add('luna de miel', 'HONEYMOON');
  add('honeymoon', 'HONEYMOON');
  return [...out];
}

function toContribution(
  factor: string,
  pts: number,
  max: number,
  detail: string,
  customerHint: string,
): ScoreContribution {
  return {
    factor,
    raw: pts,
    weight: max,
    contribution: pts,
    explanation: detail,
    explanationCustomer: customerHint,
    explanationSeller: detail,
  };
}

export type ScoreBreakdown = {
  contributions: ScoreContribution[];
  sumPts: number;
  sumMax: number;
  destinationPts: number;
  matches: string[];
  misses: string[];
  reasons: string[];
  /** 0–100 sin plateau; null si no hay dimensión activa. */
  baseScore100: number | null;
  /** Precio numérico si existe. */
  numericPrice: number | null;
};

function dossierCompletenessScore(trip: TravelTripSearchRow): ScoreBreakdown {
  let pts = 0;
  const max = 100;
  const daysWithContent = trip.itineraryDays.filter(
    (d) => (d.title?.trim().length ?? 0) > 0 || (d.description?.trim().length ?? 0) > 0,
  );
  pts += Math.min(40, daysWithContent.length * 4);
  pts += Math.min(25, trip.highlights.length * 5);
  pts += Math.min(20, trip.hotels.length * 4);
  const included = trip.services.filter((s) => s.type === 'INCLUDED').length;
  pts += Math.min(15, included * 3);
  pts = Math.min(100, Math.round(pts));
  const c = toContribution(
    'dossier_completeness',
    pts,
    max,
    `Completitud de dossier ${pts}/${max}`,
    'Valoración por riqueza de información publicada en catálogo (sin criterios del cliente).',
  );
  return {
    contributions: [c],
    sumPts: pts,
    sumMax: max,
    destinationPts: 0,
    matches: ['Catálogo detallado para navegación sin criterios'],
    misses: [],
    reasons: [c.explanation],
    baseScore100: pts,
    numericPrice: trip.indicativePrice != null ? parseFloat(trip.indicativePrice) : null,
  };
}

export type ScoreTripBreakdownOptions = {
  /** 0–1 señal del retrieval vectorial (normalizada en lote); no sustituye destino duro. */
  semanticSimilarity01?: number | null;
  semanticMaxPoints?: number;
  /** Grafo geo opcional (expandido desde la intención). */
  geoOpts?: DestinationPointsGeoOpts;
};

export function scoreTripBreakdown(
  intent: TravelSearchIntent,
  trip: TravelTripSearchRow,
  opts?: ScoreTripBreakdownOptions,
): ScoreBreakdown {
  const destMerged = mergeDestinationScoreDetail(intent.destination, trip, opts?.geoOpts);
  const d1 = destMerged.points;
  const d1Max = destMerged.intentPresent ? 30 : 0;
  const d2 = durationFactor(intent.durationDays, trip.durationDays);
  let priceNum: number | null = null;
  if (trip.indicativePrice != null) {
    const n = parseFloat(trip.indicativePrice);
    priceNum = Number.isFinite(n) ? n : null;
  }
  const d3 = budgetFactor(intent.budgetPerPerson, priceNum);
  const d4 = datesFactor(intent, trip);
  const d5 = keywordFactor(intent, trip);
  const d6 = ontologyFactor(intent, trip);

  const contributions: ScoreContribution[] = [];
  if (d1Max > 0) {
    const sellerExtra =
      destMerged.geoDelta !== 0
        ? ` (léxico ${destMerged.lexical}/${d1Max}; Δgeo ${destMerged.geoDelta})`
        : '';
    const customerTail = destMerged.customerHintSuffix.trim();
    const baseCustomer =
      d1 >= d1Max * 0.66
        ? 'El destino del circuito coincide bien con lo buscado.'
        : d1 >= d1Max * 0.35
          ? 'Hay cierta proximidad de destino respecto a la intención.'
          : 'El destino no encaja de forma clara con lo solicitado.';
    const customerHint =
      customerTail.length > 0 ? `${baseCustomer}${customerTail.startsWith(' ') ? '' : ' '}${customerTail}` : baseCustomer;
    contributions.push(
      toContribution(
        'destination',
        d1,
        d1Max,
        `Destino ${d1}/${d1Max}${sellerExtra}`.trim(),
        customerHint,
      ),
    );
  }
  if (d2.max > 0) {
    contributions.push(
      toContribution(
        'duration',
        d2.pts,
        d2.max,
        d2.detail,
        d2.miss ? 'La duración publicada se aleja de lo deseado o falta en catálogo.' : 'Duración alineada con la intención.',
      ),
    );
  }
  if (d3.max > 0) {
    contributions.push(
      toContribution(
        'budget',
        d3.pts,
        d3.max,
        d3.detail,
        d3.miss ? 'El precio orientativo no encaja del todo con el presupuesto indicado.' : 'Precio orientativo razonable frente al presupuesto.',
      ),
    );
  }
  if (d4.max > 0) {
    contributions.push(
      toContribution(
        'calendar',
        d4.pts,
        d4.max,
        d4.detail,
        d4.miss ? 'No hay evidencia clara de disponibilidad en el mes deseado.' : 'Mes o temporada coherentes con el calendario indicado.',
      ),
    );
  }
  if (d5.max > 0) {
    contributions.push(
      toContribution(
        'keywords',
        d5.pts,
        d5.max,
        d5.detail,
        d5.pts >= d5.max * 0.45
          ? 'El contenido del viaje refleja tipo o preferencias buscadas.'
          : 'Pocas coincidencias textuales con tipo o preferencias.',
      ),
    );
  }
  if (d6.max > 0) {
    contributions.push(
      toContribution(
        'ontology_style',
        d6.pts,
        d6.max,
        d6.detail,
        d6.pts >= d6.max * 0.5
          ? 'Las etiquetas estructuradas del catálogo alinean con el estilo buscado.'
          : 'Las etiquetas de estilo del catálogo apenas coinciden con la intención.',
      ),
    );
  }

  const semMaxCfg = opts?.semanticMaxPoints ?? SEMANTIC_SIMILARITY_MAX_POINTS;
  let sem01 = opts?.semanticSimilarity01;
  if (
    sem01 != null &&
    intent.destination?.trim() &&
    d1Max > 0 &&
    d1 < d1Max * 0.35
  ) {
    sem01 = 0;
  }
  if (sem01 != null && semMaxCfg > 0) {
    const sim = Math.max(0, Math.min(1, sem01));
    const pts = Math.round(sim * semMaxCfg);
    if (pts > 0) {
      contributions.push({
        factor: 'semanticSimilarity',
        raw: sim,
        weight: semMaxCfg,
        contribution: pts,
        explanation: `Similitud semántica ${pts}/${semMaxCfg} (retrieval híbrido; no sustituye destino ni precio).`,
        explanationCustomer:
          'El viaje se parece semánticamente a la intención por estilo, destino y experiencias publicadas.',
        explanationSeller: `Vector/híbrido aporta hasta ${semMaxCfg} pts; acotado si el destino literal no encaja.`,
      });
    }
  }

  const sumPts = contributions.reduce((a, c) => a + c.contribution, 0);
  const sumMax = contributions.reduce((a, c) => a + c.weight, 0);

  if (sumMax <= 0) {
    return dossierCompletenessScore(trip);
  }

  const baseScore100 = Math.min(100, Math.max(0, Math.round((sumPts / sumMax) * 100)));

  const matches: string[] = [];
  const misses: string[] = [];

  if (d1Max && d1 >= d1Max * 0.66) matches.push('Destino muy alineado con la búsqueda');
  else if (d1Max && d1 >= d1Max * 0.35) matches.push('Destino razonablemente cercano a la intención');
  else if (d1Max && d1 === 0) misses.push('Destino poco relacionado con lo buscado');

  if (d2.max && d2.pts >= d2.max * 0.75) matches.push('Duración encaja bien con lo solicitado');
  else if (d2.miss) misses.push('La duración del catálogo se aleja de lo buscado o no está definida');

  if (d3.max && d3.pts >= 17) matches.push('Precio orientativo compatible con el presupuesto');
  else if (d3.miss) misses.push('Precio orientativo por encima del presupuesto o no informado');

  if (d4.max && d4.pts >= d4.max * 0.65) matches.push('Calendario / temporada encajan con el mes deseado');
  else if (d4.miss) misses.push('No hay salida clara para el mes indicado');

  if (d5.max && d5.pts >= d5.max * 0.45) matches.push('El contenido del viaje refleja tipo o preferencias');
  else if (d5.max && d5.pts < d5.max * 0.2) misses.push('Pocas coincidencias textuales con tipo/preferencias');

  if (d6.max && d6.pts >= d6.max * 0.5) matches.push('Estilo/categorización del catálogo coherente con la intención');
  else if (d6.max && d6.pts < d6.max * 0.25) misses.push('Estilo publicado poco alineado con la intención');

  const rawSem = opts?.semanticSimilarity01;
  if (rawSem != null && semMaxCfg > 0) {
    const usable = !intent.destination?.trim() || d1Max === 0 || d1 >= d1Max * 0.35;
    if (usable) {
      const sim = Math.max(0, Math.min(1, rawSem));
      if (sim >= 0.72) matches.push('Alta similitud semántica con la intención (embeddings)');
      else if (sim < 0.28) misses.push('Baja similitud semántica respecto a la intención');
    }
  }

  const reasons = contributions.map((c) => c.explanation);

  return {
    contributions,
    sumPts,
    sumMax,
    destinationPts: d1,
    matches,
    misses,
    reasons,
    baseScore100,
    numericPrice: priceNum,
  };
}

export function applySoftConstraintPenalty(score: number, penalty: number): number {
  return Math.max(0, Math.round(score - penalty));
}

export function tripRegionKey(trip: TravelTripSearchRow): string {
  const m = trip.mainDestination?.trim();
  if (m) return normalizeKey(m);
  const first = trip.tripDestinations[0]?.destination?.name;
  return first ? normalizeKey(first) : 'unknown';
}

export function tripPriceBucket(price: number | null): number {
  if (price == null || !Number.isFinite(price)) return -1;
  return Math.round(Math.log(1 + price) / Math.log(1.12));
}

export function stylesSignature(trip: TravelTripSearchRow): string {
  const axes = [...(trip.styleAxes ?? [])].sort();
  return axes.join('|');
}

export function buildTripMeta(trip: TravelTripSearchRow): import('./types').TripMetaForDiversity {
  const numericPrice = trip.indicativePrice != null ? parseFloat(trip.indicativePrice) : null;
  const np = numericPrice != null && Number.isFinite(numericPrice) ? numericPrice : null;
  return {
    tripId: trip.id,
    regionKey: tripRegionKey(trip),
    priceBucket: tripPriceBucket(np),
    stylesKey: stylesSignature(trip),
    luxuryRank: luxuryRank(trip.luxuryLevel ?? LuxuryLevel.UNKNOWN),
    numericPrice: np,
  };
}
