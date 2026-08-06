import type { TravelTripSearchRow } from '../travel/travel-search.scoring';
import type { DestinationPointsGeoOpts } from '../travel/travel-search.scoring';
import type { TravelSearchResultItem } from '../travel/travel-search.schema';
import type { TravelSearchIntent } from '../travel/travel-search.schema';
import { destinationPoints, tripRegionKey } from './scoring.engine';
import { luxuryRank } from './policy.util';
import { LuxuryLevel } from '@prisma/client';
import { COMMERCIAL_SCORE_TOLERANCE, PREFERRED_DESTINATION_SLOT_MAX_SCORE_GAP, PREFERRED_DESTINATION_SLOT_MIN_POINTS } from './constants';

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

function normPlaceKey(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Si el cliente nombró países concretos y ningún slot cubre bien uno de ellos,
 * sustituye la alternativa por la mejor opción rankeada que sí encaja (sin forzar TOP1).
 */
function maybePromoteExplicitPreferredAlternative(params: {
  intent?: TravelSearchIntent;
  rankedDiverse: TravelSearchResultItem[];
  rowsById: Map<string, TravelTripSearchRow>;
  geoOpts?: DestinationPointsGeoOpts;
  recommended: TravelSearchResultItem;
  budget: TravelSearchResultItem | null;
  luxury: TravelSearchResultItem | null;
  alternative: TravelSearchResultItem | null;
}): TravelSearchResultItem | null {
  const { intent, rankedDiverse, rowsById, geoOpts, recommended, budget, luxury, alternative } = params;
  const prefs = intent?.preferredDestinations?.map((s) => s.trim()).filter(Boolean) ?? [];
  if (!prefs.length) return alternative;

  const usedIds = new Set<string>(
    [recommended.tripId, budget?.tripId, luxury?.tripId].filter(Boolean) as string[],
  );

  const covered = new Set<string>();
  const registerCoverage = (tripId: string | undefined) => {
    if (!tripId) return;
    const row = rowsById.get(tripId);
    if (!row) return;
    for (const p of prefs) {
      const pts = destinationPoints(p, row, geoOpts);
      if (pts >= PREFERRED_DESTINATION_SLOT_MIN_POINTS) covered.add(normPlaceKey(p));
    }
  };
  registerCoverage(recommended.tripId);
  registerCoverage(budget?.tripId);
  registerCoverage(luxury?.tripId);
  registerCoverage(alternative?.tripId);

  const missing = prefs.filter((p) => !covered.has(normPlaceKey(p)));
  if (!missing.length) return alternative;

  const topScore = recommended.score;
  for (const item of rankedDiverse) {
    if (usedIds.has(item.tripId)) continue;
    if (item.matchState === 'NO_MATCH') continue;
    if (item.score < topScore - PREFERRED_DESTINATION_SLOT_MAX_SCORE_GAP) continue;
    const row = rowsById.get(item.tripId);
    if (!row) continue;
    let hit: string | null = null;
    for (const p of missing) {
      const pts = destinationPoints(p, row, geoOpts);
      if (pts >= PREFERRED_DESTINATION_SLOT_MIN_POINTS) {
        hit = p;
        break;
      }
    }
    if (hit) return item;
  }

  return alternative;
}

/**
 * Cuatro slots comerciales deterministas: recomendada (mejor encaje diversificado),
 * budget (mejor precio dentro de ventana), luxury (mayor nivel / precio),
 * alternative (siguiente diversificada; puede priorizar un destino nombrado por el cliente).
 */
export function pickCommercialSlots(
  rankedDiverse: TravelSearchResultItem[],
  rowsById: Map<string, TravelTripSearchRow>,
  scoreTolerance: number = COMMERCIAL_SCORE_TOLERANCE,
  intent?: TravelSearchIntent,
  geoOpts?: DestinationPointsGeoOpts,
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

  alternative = maybePromoteExplicitPreferredAlternative({
    intent,
    rankedDiverse,
    rowsById,
    geoOpts,
    recommended,
    budget,
    luxury,
    alternative,
  });

  return { recommended, budget, luxury, alternative };
}
