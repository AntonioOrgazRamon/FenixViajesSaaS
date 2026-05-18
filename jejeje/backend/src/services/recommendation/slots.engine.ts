import type { TravelTripSearchRow } from '../travel/travel-search.scoring';
import type { TravelSearchResultItem } from '../travel/travel-search.schema';
import { luxuryRank } from './policy.util';
import { tripRegionKey } from './scoring.engine';
import { LuxuryLevel } from '@prisma/client';
import { COMMERCIAL_SCORE_TOLERANCE } from './constants';

export type CommercialPicks = {
  recommended: TravelSearchResultItem | null;
  budget: TravelSearchResultItem | null;
  luxury: TravelSearchResultItem | null;
  alternative: TravelSearchResultItem | null;
};

function parsePrice(row: TravelTripSearchRow | undefined): number | null {
  if (!row?.indicativePrice) return null;
  const n = parseFloat(row.indicativePrice);
  return Number.isFinite(n) ? n : null;
}

/**
 * Cuatro slots comerciales deterministas: recomendada (mejor encaje diversificado),
 * budget (mejor precio dentro de ventana), luxury (mayor nivel / precio),
 * alternative (siguiente diversificada).
 */
export function pickCommercialSlots(
  rankedDiverse: TravelSearchResultItem[],
  rowsById: Map<string, TravelTripSearchRow>,
  scoreTolerance: number = COMMERCIAL_SCORE_TOLERANCE,
): CommercialPicks {
  const empty: CommercialPicks = {
    recommended: null,
    budget: null,
    luxury: null,
    alternative: null,
  };
  if (!rankedDiverse.length) return empty;

  const recommended = rankedDiverse[0];
  const topScore = recommended.score;
  const pool = rankedDiverse.filter((r) => r.score >= topScore - scoreTolerance);
  const recRow = rowsById.get(recommended.tripId)!;
  const recRegion = tripRegionKey(recRow);

  const pricedPool = pool.filter((r) => parsePrice(rowsById.get(r.tripId)) != null);
  const budgetCandidates = pricedPool.length ? pricedPool : pool;
  const budgetSorted = [...budgetCandidates].sort((a, b) => {
    const pa = parsePrice(rowsById.get(a.tripId)) ?? Infinity;
    const pb = parsePrice(rowsById.get(b.tripId)) ?? Infinity;
    if (pa !== pb) return pa - pb;
    const sa = tripRegionKey(rowsById.get(a.tripId)!) === recRegion ? 1 : 0;
    const sb = tripRegionKey(rowsById.get(b.tripId)!) === recRegion ? 1 : 0;
    if (sa !== sb) return sa - sb;
    if (b.score !== a.score) return b.score - a.score;
    return a.tripId.localeCompare(b.tripId);
  });
  let budget =
    budgetSorted.find((r) => r.tripId !== recommended.tripId) ??
    budgetSorted.find((r) => r.tripId === recommended.tripId) ??
    null;

  const excludeLux = new Set<string>([recommended.tripId, budget?.tripId].filter(Boolean) as string[]);
  const luxurySorted = [...rankedDiverse].sort((a, b) => {
    const ra = rowsById.get(a.tripId)!;
    const rb = rowsById.get(b.tripId)!;
    const la = luxuryRank(ra.luxuryLevel ?? LuxuryLevel.UNKNOWN);
    const lb = luxuryRank(rb.luxuryLevel ?? LuxuryLevel.UNKNOWN);
    if (lb !== la) return lb - la;
    const pa = parsePrice(ra) ?? -1;
    const pb = parsePrice(rb) ?? -1;
    if (pb !== pa) return pb - pa;
    if (b.score !== a.score) return b.score - a.score;
    return a.tripId.localeCompare(b.tripId);
  });
  let luxury = luxurySorted.find((r) => !excludeLux.has(r.tripId)) ?? null;

  const used = new Set<string>(
    [recommended.tripId, budget?.tripId, luxury?.tripId].filter(Boolean) as string[],
  );
  let alternative = rankedDiverse.find((r) => !used.has(r.tripId)) ?? null;

  if (alternative && alternative.tripId === budget?.tripId) alternative = null;

  if (!luxury) {
    luxury = [...rankedDiverse].sort((a, b) => b.score - a.score).find((r) => !excludeLux.has(r.tripId)) ?? null;
  }

  return { recommended, budget, luxury, alternative };
}
