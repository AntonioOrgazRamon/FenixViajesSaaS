/**
 * Validación y resolución final de título (anti-narrativa, apoyo índice por página).
 */

import type { IndexExpectedTrip } from './travel-index-coverage.service';
import { isBlockedFirstLineOrTitle, isValidProductTitle } from './trip-segmentation-icarion';
import { looksNarrativeOrBrokenTitle, normalizeTravelTitle } from './travel-segment-validator.service';

/** Re-export para tests */
export { normalizeTravelTitle };

function normTitleForSim(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenJaccard(a: string, b: string): number {
  const ta = new Set(normTitleForSim(a).split(' ').filter((x) => x.length > 1));
  const tb = new Set(normTitleForSim(b).split(' ').filter((x) => x.length > 1));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const x of ta) if (tb.has(x)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export function similarityToIndexTitle(candidate: string, indexTitle: string): number {
  const c = normTitleForSim(candidate);
  const i = normTitleForSim(indexTitle);
  if (!c || !i) return 0;
  if (c.includes(i) || i.includes(c)) return 0.92;
  return tokenJaccard(candidate, indexTitle);
}

export function findBestIndexTitleForPages(
  title: string,
  indexEntries: IndexExpectedTrip[],
  pageStart: number,
  pageEnd: number,
): { entry: IndexExpectedTrip; score: number } | null {
  let best: { entry: IndexExpectedTrip; score: number } | null = null;
  for (const e of indexEntries) {
    if (e.pageNumber < pageStart - 12 || e.pageNumber > pageEnd + 12) continue;
    const sc = similarityToIndexTitle(title, e.expectedTitle);
    if (!best || sc > best.score) best = { entry: e, score: sc };
  }
  return best && best.score >= 0.38 ? best : null;
}

export type TitleGateResult = {
  ok: boolean;
  title: string | null;
  reason: string | null;
  indexSupportScore: number;
  rejectedCandidates: string[];
};

/**
 * Comprueba si el título puede persistirse como producto real.
 */
export function validateFinalTripTitle(
  rawTitle: string | null | undefined,
  segmentText: string,
  ctx: { indexEntries: IndexExpectedTrip[]; pageStart: number; pageEnd: number },
): TitleGateResult {
  const rejected: string[] = [];
  const tryOne = (cand: string | null | undefined, label: string): string | null => {
    if (!cand) return null;
    const t = normalizeTravelTitle(cand);
    if (!t || t.length < 6) return null;
    if (looksNarrativeOrBrokenTitle(t)) {
      rejected.push(`${label}:narrative:${t.slice(0, 80)}`);
      return null;
    }
    if (isBlockedFirstLineOrTitle(t)) {
      rejected.push(`${label}:blocked:${t.slice(0, 80)}`);
      return null;
    }
    if (!isValidProductTitle(t) && t.length < 12) return null;
    const idx = findBestIndexTitleForPages(t, ctx.indexEntries, ctx.pageStart, ctx.pageEnd);
    const indexSupportScore = idx?.score ?? 0;
    if (ctx.indexEntries.length >= 8 && indexSupportScore < 0.22 && !/[A-ZÁÉÍÚÑ]{3,}/.test(t)) {
      rejected.push(`${label}:weak_index:${t.slice(0, 80)}`);
      return null;
    }
    if (!isValidProductTitle(t) && indexSupportScore < 0.35) {
      rejected.push(`${label}:product_shape:${t.slice(0, 80)}`);
      return null;
    }
    return t;
  };

  const merged =
    tryOne(rawTitle, 'primary') ??
    tryOne(extractTitleFromSummaryTail(segmentText), 'summary_tail') ??
    tryOne(findIndexFallback(ctx), 'index_only');

  if (!merged) {
    return {
      ok: false,
      title: null,
      reason: 'INVALID_TITLE',
      indexSupportScore: 0,
      rejectedCandidates: rejected,
    };
  }
  const idx = findBestIndexTitleForPages(merged, ctx.indexEntries, ctx.pageStart, ctx.pageEnd);
  return {
    ok: true,
    title: merged,
    reason: null,
    indexSupportScore: idx?.score ?? 0,
    rejectedCandidates: rejected,
  };
}

function extractTitleFromSummaryTail(text: string): string | null {
  const lastPrecio = text.lastIndexOf('PRECIO ORIENTATIVO');
  const head = lastPrecio > 400 ? text.slice(Math.max(0, lastPrecio - 3_500), lastPrecio) : text.slice(0, 4_000);
  const lines = head.split(/\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i]!;
    if (l.length < 10 || l.length > 100) continue;
    if (/servicios|salidas|d[ií]a\s*\d|€|\d{1,2}\s*\/\s*\d{1,2}/i.test(l)) continue;
    if (!/[A-ZÁÉÍÓÚÑ]/.test(l)) continue;
    const t = normalizeTravelTitle(l);
    if (!looksNarrativeOrBrokenTitle(t) && !isBlockedFirstLineOrTitle(t)) return t;
  }
  return null;
}

function findIndexFallback(ctx: { indexEntries: IndexExpectedTrip[]; pageStart: number; pageEnd: number }): string | null {
  for (const e of ctx.indexEntries) {
    if (e.pageNumber >= ctx.pageStart - 2 && e.pageNumber <= ctx.pageEnd + 2) {
      return e.expectedTitle;
    }
  }
  return null;
}
