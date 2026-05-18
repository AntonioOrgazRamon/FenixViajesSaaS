import type { DestinationPointsGeoOpts, TravelTripSearchRow, TripGeoPlaceLinkRow } from '../travel/travel-search.scoring';
import { destinationLexicalMax } from '../travel/travel-search.scoring';

function geoDeltaFromLinks(
  geoOpts: DestinationPointsGeoOpts,
  links: TripGeoPlaceLinkRow[] | undefined,
): { delta: number; note: string } {
  const roots = geoOpts.intentRootGeoPlaceIds;
  const exp = geoOpts.expandedIntentGeoPlaceIds;
  if (!roots.size || !exp.size) {
    return { delta: 0, note: '' };
  }
  if (!links?.length) {
    return { delta: 0, note: '' };
  }

  let best = 0;
  let hitExactRoot = false;
  let hitExpanded = false;
  let hitViaAncestor = false;

  for (const link of links) {
    const primaryBoost = link.role === 'PRIMARY' ? 2 : 0;

    if (roots.has(link.geoPlaceId)) {
      hitExactRoot = true;
      best = Math.max(best, 11 + primaryBoost);
      continue;
    }
    if (exp.has(link.geoPlaceId)) {
      hitExpanded = true;
      best = Math.max(best, 9 + primaryBoost);
      continue;
    }
    for (const ancId of link.ancestorIds) {
      if (roots.has(ancId)) {
        hitViaAncestor = true;
        best = Math.max(best, 8 + primaryBoost);
        break;
      }
      if (exp.has(ancId)) {
        hitViaAncestor = true;
        best = Math.max(best, 6 + primaryBoost);
        break;
      }
    }
  }

  if (best > 0) {
    const parts: string[] = [];
    if (hitExactRoot) parts.push('coincidencia geográfica directa');
    else if (hitExpanded) parts.push('jerarquía geo (descendiente/ascendente)');
    else if (hitViaAncestor) parts.push('relación geo por ancestros');
    return {
      delta: Math.min(14, best),
      note: parts.length ? `geo: ${parts.join('; ')}` : '',
    };
  }

  return {
    delta: -11,
    note: 'geo: sin relación con la intención (TripGeoPlace)',
  };
}

export type MergedDestinationScore = {
  lexical: number;
  geoDelta: number;
  points: number;
  customerHintSuffix: string;
};

/** Combina puntuación léxica (0–30) con bonus/penalización geo y recorta a [0,30]. */
export function mergeLexicalAndGeoDestinationPoints(
  lexicalPoints: number,
  trip: TravelTripSearchRow,
  geoOpts?: DestinationPointsGeoOpts,
): MergedDestinationScore {
  const max = destinationLexicalMax();
  const clampLex = Math.max(0, Math.min(max, lexicalPoints));

  if (!geoOpts?.expandedIntentGeoPlaceIds?.size || !geoOpts.intentRootGeoPlaceIds?.size) {
    return {
      lexical: clampLex,
      geoDelta: 0,
      points: clampLex,
      customerHintSuffix: '',
    };
  }

  const { delta, note } = geoDeltaFromLinks(geoOpts, trip.tripGeoPlaces);
  const combined = Math.max(0, Math.min(max, clampLex + delta));
  return {
    lexical: clampLex,
    geoDelta: delta,
    points: combined,
    customerHintSuffix: note ? ` ${note}` : '',
  };
}
