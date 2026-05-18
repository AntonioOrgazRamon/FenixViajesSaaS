import type { TravelTripSearchRow } from '../travel/travel-search.scoring';
import type { TravelSearchResultItem } from '../travel/travel-search.schema';
import type { TripMetaForDiversity } from './types';
import { buildTripMeta, tripCorpus, tripRegionKey } from './scoring.engine';
import { tokenJaccard, tokenize } from '../travel/travel-search.scoring';
import { DEFAULT_DIVERSITY_LAMBDA } from './constants';

function textSimilarity(a: TravelTripSearchRow, b: TravelTripSearchRow): number {
  const ta = tokenize(tripCorpus(a));
  const tb = tokenize(tripCorpus(b));
  return tokenJaccard(ta, tb);
}

function metaSimilarity(m1: TripMetaForDiversity, m2: TripMetaForDiversity): number {
  let s = 0;
  if (m1.regionKey && m1.regionKey === m2.regionKey) s += 0.55;
  else if (
    m1.regionKey &&
    m2.regionKey &&
    (m1.regionKey.includes(m2.regionKey) || m2.regionKey.includes(m1.regionKey))
  ) {
    s += 0.35;
  }
  if (m1.priceBucket >= 0 && m1.priceBucket === m2.priceBucket) s += 0.25;
  const stylesA = new Set(m1.stylesKey.split('|').filter(Boolean));
  const stylesB = new Set(m2.stylesKey.split('|').filter(Boolean));
  if (stylesA.size && stylesB.size) {
    let inter = 0;
    for (const x of stylesA) if (stylesB.has(x)) inter++;
    const union = stylesA.size + stylesB.size - inter;
    s += union ? (inter / union) * 0.35 : 0;
  }
  if (Math.abs((m1.luxuryRank ?? 0) - (m2.luxuryRank ?? 0)) <= 1) s += 0.1;
  return Math.min(1, s);
}

/** Similaridad 0–1 entre dos viajes (determinista, explicable). */
export function tripSimilarity(
  tripA: TravelTripSearchRow,
  tripB: TravelTripSearchRow,
  metaA?: TripMetaForDiversity,
  metaB?: TripMetaForDiversity,
): number {
  const ma = metaA ?? buildTripMeta(tripA);
  const mb = metaB ?? buildTripMeta(tripB);
  const structural = metaSimilarity(ma, mb);
  const textual = textSimilarity(tripA, tripB);
  return Math.min(1, structural * 0.72 + textual * 0.28);
}

/**
 * Reordenación MMR sobre ítems ya puntuados: penaliza clonar misma región/estilo/precio.
 */
export function reorderWithDiversity(
  rowsById: Map<string, TravelTripSearchRow>,
  items: TravelSearchResultItem[],
  lambda: number = DEFAULT_DIVERSITY_LAMBDA,
): TravelSearchResultItem[] {
  if (items.length <= 1) return items;
  const remaining = new Set(items.map((i) => i.tripId));
  const metaCache = new Map<string, TripMetaForDiversity>();
  for (const id of remaining) {
    const r = rowsById.get(id);
    if (r) metaCache.set(id, buildTripMeta(r));
  }
  const out: TravelSearchResultItem[] = [];
  while (remaining.size) {
    let bestId: string | null = null;
    let bestScore = -Infinity;
    for (const id of remaining) {
      const item = items.find((i) => i.tripId === id)!;
      let maxSim = 0;
      for (const picked of out) {
        const ta = rowsById.get(id)!;
        const tb = rowsById.get(picked.tripId)!;
        maxSim = Math.max(
          maxSim,
          tripSimilarity(ta, tb, metaCache.get(id), metaCache.get(picked.tripId)),
        );
      }
      const adjusted = item.score - lambda * maxSim;
      if (adjusted > bestScore) {
        bestScore = adjusted;
        bestId = id;
      }
    }
    const chosen = items.find((i) => i.tripId === bestId)!;
    out.push(chosen);
    remaining.delete(bestId!);
  }
  return out;
}

export function diversityDiagnostics(
  selectedIds: string[],
  rowsById: Map<string, TravelTripSearchRow>,
): string[] {
  const notes: string[] = [];
  const keys = selectedIds.map((id) => tripRegionKey(rowsById.get(id)!));
  const uniqRegions = new Set(keys.filter((k) => k && k !== 'unknown'));
  if (uniqRegions.size === 1 && selectedIds.length > 1) {
    notes.push('Varias opciones comparten la misma región; se diversificó por precio y estilo publicado.');
  }
  return notes;
}
