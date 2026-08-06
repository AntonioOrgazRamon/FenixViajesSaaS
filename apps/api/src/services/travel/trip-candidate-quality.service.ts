/**
 * Capa de calidad previa a persistencia.
 * Regla de oro: ≥4/6 señales fuertes en el MISMO segmento; título bonito no basta.
 */

import type { TripAiExtract } from './trip-ai.schemas';
import type { IndexExpectedTrip } from './travel-index-coverage.service';
import { logger } from '../../common/logger';
import {
  extractTripTitle,
  hasMainDestinationLine,
  isBlockedFirstLineOrTitle,
  signalDuration,
} from './trip-segmentation-icarion';
import { looksNarrativeOrBrokenTitle, normalizeTravelTitle } from './travel-segment-validator.service';
import { similarityToIndexTitle } from './catalog-trip-title.service';

export const CANDIDATE_SCORE_VALID_MIN = 70;
export const CANDIDATE_SCORE_REVIEW_MIN = 50;
/** Mínimo de señales fuertes (de 6) para persistir */
export const STRONG_SIGNALS_REQUIRED = 4;

export type StrongSignalId =
  | 'day1'
  | 'itinerary_3plus'
  | 'duration_xy'
  | 'precio_orientativo'
  | 'servicios_incluidos'
  | 'salidas';

const ALL_STRONG: StrongSignalId[] = [
  'day1',
  'itinerary_3plus',
  'duration_xy',
  'precio_orientativo',
  'servicios_incluidos',
  'salidas',
];

export type CandidateDecision = 'VALID' | 'REVIEW' | 'REJECT';

export type CandidateRejectCode =
  | 'REJECTED_FRAGMENT_TITLE'
  | 'REJECTED_NO_TRIP_STRUCTURE'
  | 'REJECTED_DUPLICATE'
  | 'REJECTED_HOTEL_ONLY'
  | 'REJECTED_LOW_CONFIDENCE'
  | 'REJECTED_INDEX_OR_TITLE_LIST'
  | 'REJECTED_TITLE_NOT_NEAR_STRUCTURE';

export type TripCandidateQualityResult = {
  score: number;
  decision: CandidateDecision;
  rejectCode: CandidateRejectCode | null;
  positiveSignals: string[];
  negativeSignals: string[];
  titleNormalized: string;
  titleInferred: string | null;
  strongSignalCount: number;
  strongSignalsPresent: StrongSignalId[];
  missingStrongSignals: StrongSignalId[];
};

const BULLET_TITLE = /^\s*[·•]\s*/;
const FRAGMENT_TITLE_START =
  /^(·|•|-|AUTOCAR|SUBIDA|SUBIREMOS|BAJADA|VISTA\s|VEREMOS|VISITAREMOS|PARADA\s|EXCURSI[ÓO]N\s|TRASLADO\s|NOCHE\s|D[ÍI]A\s*\d)/i;
const CONNECTOR_START = /^(DE|DEL|EN|Y|CON|PARA|POR|LA|EL|LOS|LAS)\s+[A-ZÁÉÍÓÚÑ0-9]/i;
const NARRATIVE_FUTURE = /\b(TENDREMOS|SEGUIREMOS|VEREMOS|VISITAREMOS|DESCUBRIREMO|DISFRUTAREMO|PODR[EÁ]MOS)\b/i;
const HISTORICAL_ASIDE = /\bDURANTE\s+EL\s+PER[IÍ]ODO\b|\bAZUCHI|\bMOMOYAMA\b/i;
const HOTEL_BULLET_LINE = /^\s*·\s*[A-Za-zÁÉÍÓÚÑáéíóúñ].{2,60}$/;

/** Marketing / cuerpo / párrafo — no nombre de producto (genérico, sin listar PDF concreto). */
const MARKETING_TITLE = /\b(PARA\s+DESCUBRIR|PARA\s+DISFRUTAR|COMPLETO\s+RECORRIDO|RECORRIDO\s+COMPLETO|MARAVILLOSAS?\s+FOTOS|FOTOS\s+CON\s+LAS|VISTA\s+MARAVILLOSA|DESCUBRIR\s+EL\s+MUNDO)\b/i;
const NARRATIVE_VERBS_TITLE = /\b(VEREMOS|SEGUIREMOS|TENDREMOS|VISITAREMOS|DISFRUTAREMOS)\b/i;

/** Sufijos de producto válidos pese a palabras “parecidas” a marketing. */
const VALID_PRODUCT_SUFFIX = /\b(AL\s+COMPLETO|DE\s+LUJO|CON\s+SAPA|CON\s+OBEROI|CON\s+AMRITSAR|Y\s+CAMBOYA|Y\s+HALONG|E\s+ICONOS)\b/i;

export function countDistinctItineraryDays(text: string, trip: TripAiExtract): number {
  const u = new Set<number>();
  for (const d of trip.itineraryDays) u.add(d.dayNumber);
  const t = text.slice(0, 80_000);
  for (const m of t.matchAll(/\bD[ÍI]A[S]?\s*(\d{1,2})\b/gi)) {
    const n = parseInt(m[1]!, 10);
    if (Number.isFinite(n)) u.add(n);
  }
  return u.size;
}

/**
 * Las 6 señales fuertes exigidas. Preferencia al texto del segmento (no solo JSON IA).
 */
export function countStrongSignals(text: string, trip: TripAiExtract): {
  count: number;
  present: StrongSignalId[];
  missing: StrongSignalId[];
} {
  const t = text.slice(0, 100_000);
  const present: StrongSignalId[] = [];

  const day1Text = /\bD[ÍI]A\s*1\b/i.test(t);
  const day1Trip = trip.itineraryDays.some((d) => d.dayNumber === 1);
  if (day1Text || day1Trip) present.push('day1');

  const nDistinct = countDistinctItineraryDays(t, trip);
  if (nDistinct >= 3) present.push('itinerary_3plus');

  const durText = /\b\d{1,2}\s*\/\s*\d{1,2}\b/.test(t);
  const durTrip = trip.durationDays != null && trip.durationNights != null && trip.durationDays > 0;
  if (durText || durTrip) present.push('duration_xy');

  if (/\bPRECIO\s+ORIENTATIVO\b/i.test(t)) present.push('precio_orientativo');

  if (/\bSERVICIOS\s+INCLUIDOS\b/i.test(t)) present.push('servicios_incluidos');

  if (/\bSALIDAS\b/i.test(t)) present.push('salidas');

  const set = new Set(present);
  const missing = ALL_STRONG.filter((x) => !set.has(x));
  return { count: set.size, present: [...set], missing };
}

/** Muchas líneas tipo índice → lista de títulos sin ficha completa. */
export function looksLikeTitleListOrIndexPage(text: string): boolean {
  const head = text.slice(0, 7000);
  const lines = head.split(/\n/).map((l) => l.trim()).filter(Boolean);
  let indexLike = 0;
  for (const s of lines) {
    if (/^\d{1,3}\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]{4,}/.test(s)) indexLike++;
    else if (/^[A-Za-zÁÉÍÓÚÑ0-9][^.\n]{5,85}\s+\d{1,3}\s*$/.test(s)) indexLike++;
  }
  const hasFullFicha =
    /\bSERVICIOS\s+INCLUIDOS\b/i.test(head) &&
    /\bPRECIO\s+ORIENTATIVO\b/i.test(head) &&
    /\bD[ÍI]A\s*1\b/i.test(head) &&
    /\bSALIDAS\b/i.test(head);
  return indexLike >= 7 && !hasFullFicha;
}

/**
 * Título debe estar cerca del bloque estructural (no aislado al final tipo lista).
 */
export function titleNearStructuralBlocks(text: string, title: string): boolean {
  const t = text.slice(0, 42_000);
  const norm = normalizeTravelTitle(title).toUpperCase().replace(/\s+/g, ' ');
  if (norm.length < 6) return true;
  const needle = norm.slice(0, Math.min(36, norm.length));
  const ti = t.toUpperCase().replace(/\s+/g, ' ').indexOf(needle);
  if (ti < 0) {
    const toks = norm.split(' ').filter((w) => w.length > 3).slice(0, 4);
    if (toks.length < 2) return false;
    let hits = 0;
    let firstHit = t.length;
    const up = t.toUpperCase();
    for (const w of toks) {
      const p = up.indexOf(w);
      if (p >= 0) {
        hits++;
        firstHit = Math.min(firstHit, p);
      }
    }
    if (hits < 2) return false;
    return verifyTitleOffset(t, firstHit);
  }
  return verifyTitleOffset(t, ti);
}

function verifyTitleOffset(t: string, ti: number): boolean {
  const dur = t.search(/\b\d{1,2}\s*\/\s*\d{1,2}\b/);
  const serv = t.search(/\bSERVICIOS\s+INCLUIDOS\b/i);
  const precio = t.search(/\bPRECIO\s+ORIENTATIVO\b/i);
  const sal = t.search(/\bSALIDAS\b/i);
  const anchors = [dur, serv, precio, sal].filter((x) => x >= 0);
  if (anchors.length === 0) return false;
  const firstA = Math.min(...anchors);
  const lastA = Math.max(...anchors);
  if (ti > lastA + 1800) return false;
  if (ti > firstA + 6500) return false;
  return true;
}

/** Título que no debe publicarse. >12 palabras = rechazo duro (salvo whitelist suave). */
export function isGarbageFragmentTitle(title: string | null | undefined): boolean {
  if (title == null || !title.trim()) return true;
  const t = normalizeTravelTitle(title);
  if (t.length < 4) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 12 && !VALID_PRODUCT_SUFFIX.test(t)) return true;
  if (BULLET_TITLE.test(t)) return true;
  if (FRAGMENT_TITLE_START.test(t)) return true;
  if (MARKETING_TITLE.test(t)) return true;
  if (NARRATIVE_VERBS_TITLE.test(t)) return true;
  if (CONNECTOR_START.test(t) && !/\b(DE\s+LUJO|ENCANTOS|ICONOS|NATURALEZA|LUXURY|CON\s+JAPAN|CON\s+RAIL|CON\s+OBEROI|CON\s+SAPA)\b/i.test(t)) {
    return true;
  }
  if (NARRATIVE_FUTURE.test(t)) return true;
  if (HISTORICAL_ASIDE.test(t)) return true;
  if (/\bMUNDO\s+SUBMARINO\b/i.test(t) && t.length > 25) return true;
  if (/^(LA|EL)\s+.+\s+(O|AL)\s+/.test(t) && t.length > 35) return true;
  if (looksNarrativeOrBrokenTitle(t)) return true;
  if (t.split(/\s+/).length > 18) return true;
  return false;
}

/** Normalización agresiva para deduplicar (documento). */
export function normalizeTitleForDedupe(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/^\s*\d{1,3}\s+/, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleTokenJaccard(a: string, b: string): number {
  const ta = new Set(normalizeTitleForDedupe(a).split(' ').filter((w) => w.length > 2));
  const tb = new Set(normalizeTitleForDedupe(b).split(' ').filter((w) => w.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let i = 0;
  for (const x of ta) if (tb.has(x)) i++;
  return i / (ta.size + tb.size - i);
}

/**
 * Inferencia de título SOLO vía extractTripTitle (patrones de catálogo), sin “cualquier mayúsculas”.
 */
export function inferCommercialTitleNearStructure(
  segmentText: string,
  currentTitle: string | null | undefined,
): string | null {
  const cap = Math.min(segmentText.length, 14_000);
  const head = segmentText.slice(0, cap);
  const durMatch = /\b\d{1,2}\s*\/\s*\d{1,2}\b/.exec(head);
  const cut = durMatch?.index != null ? head.slice(0, durMatch.index) : head;
  const beforeServ = (() => {
    const i = cut.search(/\bSERVICIOS\s+INCLUIDOS\b/i);
    return i > 120 ? cut.slice(0, i) : cut;
  })();
  const fromExtract = extractTripTitle(beforeServ);
  if (
    fromExtract &&
    !isGarbageFragmentTitle(fromExtract) &&
    !isBlockedFirstLineOrTitle(fromExtract) &&
    titleNearStructuralBlocks(segmentText, fromExtract) &&
    (!currentTitle || normalizeTitleForDedupe(fromExtract) !== normalizeTitleForDedupe(currentTitle))
  ) {
    return normalizeTravelTitle(fromExtract);
  }
  return null;
}

export function evaluateTripCandidate(input: {
  segmentText: string;
  trip: TripAiExtract;
  pageStart: number;
  pageEnd: number;
  indexEntries: IndexExpectedTrip[];
  originalSegmentTitle: string;
}): TripCandidateQualityResult {
  const positive: string[] = [];
  const negative: string[] = [];
  const text = input.segmentText;
  const trip = input.trip;

  const strong = countStrongSignals(text, trip);
  for (const id of strong.present) {
    positive.push(`fuerte:${id}`);
  }
  for (const id of strong.missing) {
    negative.push(`falta_fuerte:${id}`);
  }

  const indexLike = looksLikeTitleListOrIndexPage(text);

  let inferred: string | null = null;
  if (isGarbageFragmentTitle(trip.title) || looksNarrativeOrBrokenTitle(trip.title)) {
    inferred = inferCommercialTitleNearStructure(text, trip.title);
  }
  const effectiveTitle = inferred ?? trip.title;
  const titleNorm = normalizeTitleForDedupe(effectiveTitle);
  const nearOk = titleNearStructuralBlocks(text, effectiveTitle);

  if (hasMainDestinationLine(text) || (trip.mainDestination?.trim() ?? '').length > 2) {
    positive.push('destino');
  }

  let idxBoost = 0;
  for (const e of input.indexEntries) {
    if (e.pageNumber < input.pageStart - 15 || e.pageNumber > input.pageEnd + 15) continue;
    if (similarityToIndexTitle(effectiveTitle, e.expectedTitle) >= 0.4) {
      idxBoost = 6;
      positive.push('apoyo_indice');
      break;
    }
  }

  const hotelOnlySuspect =
    HOTEL_BULLET_LINE.test(effectiveTitle.trim()) ||
    (trip.hotels.length > 0 &&
      countDistinctItineraryDays(text, trip) < 2 &&
      !signalDuration(text) &&
      !/\bSERVICIOS\s+INCLUIDOS\b/i.test(text) &&
      !/\bPRECIO\s+ORIENTATIVO\b/i.test(text));

  let score =
    strong.count * 14 +
    (nearOk ? 10 : 0) +
    (indexLike ? -80 : 0) +
    idxBoost +
    (positive.includes('destino') ? 4 : 0) -
    (isGarbageFragmentTitle(effectiveTitle) ? 50 : 0) -
    (hotelOnlySuspect ? 45 : 0);

  score = Math.max(0, Math.min(100, Math.round(score)));

  let decision: CandidateDecision = 'VALID';
  let rejectCode: CandidateRejectCode | null = null;

  const garbageTitle = isGarbageFragmentTitle(effectiveTitle);

  if (indexLike) {
    decision = 'REJECT';
    rejectCode = 'REJECTED_INDEX_OR_TITLE_LIST';
  } else if (strong.count < STRONG_SIGNALS_REQUIRED) {
    decision = 'REJECT';
    rejectCode = 'REJECTED_NO_TRIP_STRUCTURE';
    score = Math.min(score, 42);
  } else if (!nearOk) {
    decision = 'REJECT';
    rejectCode = 'REJECTED_TITLE_NOT_NEAR_STRUCTURE';
  } else if (garbageTitle) {
    decision = 'REJECT';
    rejectCode = 'REJECTED_FRAGMENT_TITLE';
  } else if (hotelOnlySuspect) {
    decision = 'REJECT';
    rejectCode = 'REJECTED_HOTEL_ONLY';
  } else if (score < CANDIDATE_SCORE_REVIEW_MIN) {
    decision = 'REJECT';
    rejectCode = 'REJECTED_LOW_CONFIDENCE';
  } else if (score < CANDIDATE_SCORE_VALID_MIN) {
    decision = 'REVIEW';
  }

  return {
    score,
    decision,
    rejectCode,
    positiveSignals: positive,
    negativeSignals: negative,
    titleNormalized: titleNorm,
    titleInferred: inferred,
    strongSignalCount: strong.count,
    strongSignalsPresent: strong.present,
    missingStrongSignals: strong.missing,
  };
}

function mergeRicherTrip(primary: TripAiExtract, secondary: TripAiExtract): TripAiExtract {
  const pickLonger = <T extends string | null | undefined>(a: T, b: T): T =>
    ((a?.length ?? 0) >= (b?.length ?? 0) ? a : b) as T;
  return {
    ...primary,
    description: pickLonger(primary.description, secondary.description),
    itineraryDays:
      primary.itineraryDays.length >= secondary.itineraryDays.length
        ? primary.itineraryDays
        : secondary.itineraryDays,
    hotels: primary.hotels.length >= secondary.hotels.length ? primary.hotels : secondary.hotels,
    services: primary.services.length >= secondary.services.length ? primary.services : secondary.services,
    departures: primary.departures.length >= secondary.departures.length ? primary.departures : secondary.departures,
    destinations:
      primary.destinations.length >= secondary.destinations.length ? primary.destinations : secondary.destinations,
    highlights: primary.highlights.length >= secondary.highlights.length ? primary.highlights : secondary.highlights,
  };
}

export type PersistReadyCandidate = {
  seg: ImportPipelineSegmentLike;
  cleaned: string;
  aiNorm: TripAiExtract;
  confidence: number;
  structuredHotelWhitelistNormKeys: Set<string>;
  quality: TripCandidateQualityResult;
  segmentValidation: import('./travel-segment-validator.service').TravelSegmentValidationResult;
};

export type ImportPipelineSegmentLike = {
  pageStart: number;
  pageEnd: number;
  title: string;
  rawTextForAI: string;
  splitFromMixed?: boolean;
};

function pageRangesOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

function priceKey(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return 'x';
  return String(Math.round(p / 50) * 50);
}

function candidatesAreDuplicates(a: PersistReadyCandidate, b: PersistReadyCandidate): boolean {
  const t1 = a.quality.titleNormalized;
  const t2 = b.quality.titleNormalized;
  if (t1 && t2 && t1 === t2) return true;

  const j = titleTokenJaccard(a.aiNorm.title, b.aiNorm.title);
  const d1a = a.aiNorm.durationDays ?? -1;
  const d1b = b.aiNorm.durationDays ?? -1;
  const n1a = a.aiNorm.durationNights ?? -1;
  const n1b = b.aiNorm.durationNights ?? -1;
  const sameDur = d1a === d1b && n1a === n1b && d1a > 0;
  const pka = priceKey(Number(a.aiNorm.indicativePrice ?? null));
  const pkb = priceKey(Number(b.aiNorm.indicativePrice ?? null));
  const samePriceBucket = pka !== 'x' && pka === pkb;
  const pagesTouch = pageRangesOverlap(
    [a.seg.pageStart, a.seg.pageEnd],
    [b.seg.pageStart, b.seg.pageEnd],
  );
  const pagesNear = Math.abs(a.seg.pageStart - b.seg.pageStart) <= 8;

  if (j >= 0.78 && (sameDur || pagesNear)) return true;
  if (sameDur && samePriceBucket && pagesTouch) return true;
  if (j >= 0.88 && pagesTouch) return true;
  return false;
}

export function dedupeAndMergeCandidates(
  items: PersistReadyCandidate[],
  onDrop: (dropped: PersistReadyCandidate, kept: PersistReadyCandidate) => void,
): PersistReadyCandidate[] {
  const sorted = [...items].sort((x, y) => y.quality.score - x.quality.score);
  const kept: PersistReadyCandidate[] = [];
  for (const c of sorted) {
    const dup = kept.find((k) => candidatesAreDuplicates(c, k));
    if (dup) {
      if (c.quality.score > dup.quality.score) {
        const idx = kept.indexOf(dup);
        const merged: PersistReadyCandidate = {
          ...c,
          aiNorm: mergeRicherTrip(c.aiNorm, dup.aiNorm),
          seg: {
            ...c.seg,
            pageStart: Math.min(c.seg.pageStart, dup.seg.pageStart),
            pageEnd: Math.max(c.seg.pageEnd, dup.seg.pageEnd),
          },
        };
        onDrop(dup, merged);
        kept[idx] = merged;
      } else {
        dup.aiNorm = mergeRicherTrip(dup.aiNorm, c.aiNorm);
        dup.seg.pageStart = Math.min(dup.seg.pageStart, c.seg.pageStart);
        dup.seg.pageEnd = Math.max(dup.seg.pageEnd, c.seg.pageEnd);
        onDrop(c, dup);
      }
      continue;
    }
    kept.push(c);
  }
  return kept.sort((a, b) => a.seg.pageStart - b.seg.pageStart);
}

export class TripCandidateQualityService {
  evaluate = evaluateTripCandidate;
  inferTitle = inferCommercialTitleNearStructure;
  dedupe = dedupeAndMergeCandidates;
  normalizeTitle = normalizeTitleForDedupe;
  isGarbageTitle = isGarbageFragmentTitle;
}

export function logCandidateQuality(
  documentId: string,
  ctx: {
    originalTitle: string;
    finalTitle: string;
    pageStart: number;
    pageEnd: number;
    q: TripCandidateQualityResult;
    phase: 'prePersist' | 'postDedupe';
  },
): void {
  logger.info(
    {
      event: 'travel:candidate-quality',
      documentId,
      phase: ctx.phase,
      originalTitle: ctx.originalTitle.slice(0, 200),
      finalTitle: ctx.finalTitle.slice(0, 200),
      titleNormalized: ctx.q.titleNormalized,
      titleInferred: ctx.q.titleInferred,
      sourcePageStart: ctx.pageStart,
      sourcePageEnd: ctx.pageEnd,
      score: ctx.q.score,
      decision: ctx.q.decision,
      rejectCode: ctx.q.rejectCode,
      strongSignalCount: ctx.q.strongSignalCount,
      missingStrongSignals: ctx.q.missingStrongSignals,
      strongSignalsPresent: ctx.q.strongSignalsPresent,
      positiveSignals: ctx.q.positiveSignals,
      negativeSignals: ctx.q.negativeSignals,
    },
    `travel:candidate-quality ${ctx.q.decision} score=${ctx.q.score} fuerte=${ctx.q.strongSignalCount}/6`,
  );
}

/** Mensaje estable para depuración / trazas. */
export function formatCandidateRejectReason(r: TripCandidateQualityResult): string {
  switch (r.rejectCode) {
    case 'REJECTED_NO_TRIP_STRUCTURE':
      return `GOLDEN_RULE: ${r.strongSignalCount}/6 fuertes; faltan=${r.missingStrongSignals.join(',')}`;
    case 'REJECTED_INDEX_OR_TITLE_LIST':
      return 'INDEX_OR_TITLE_LIST';
    case 'REJECTED_TITLE_NOT_NEAR_STRUCTURE':
      return 'TITLE_NOT_NEAR_STRUCTURE';
    case 'REJECTED_FRAGMENT_TITLE':
      return 'FRAGMENT_OR_MARKETING_TITLE';
    case 'REJECTED_HOTEL_ONLY':
      return 'HOTEL_ONLY_SUSPECT';
    case 'REJECTED_LOW_CONFIDENCE':
      return 'LOW_CONFIDENCE_SCORE';
    default:
      return r.rejectCode ?? 'UNKNOWN';
  }
}

/** Log debug obligatorio para rechazados. */
export function logRejectedCandidate(
  documentId: string,
  ctx: {
    title: string;
    score: number;
    missingStrongSignals: StrongSignalId[];
    reason: string;
    rejectCode: CandidateRejectCode | null;
    pageStart: number;
    pageEnd: number;
  },
): void {
  logger.info(
    {
      event: 'travel:candidate-rejected-debug',
      documentId,
      title: ctx.title.slice(0, 240),
      score: ctx.score,
      missingStrongSignals: ctx.missingStrongSignals,
      reason: ctx.reason,
      rejectCode: ctx.rejectCode,
      sourcePageStart: ctx.pageStart,
      sourcePageEnd: ctx.pageEnd,
    },
    `travel:rechazado — ${ctx.reason}`,
  );
}
