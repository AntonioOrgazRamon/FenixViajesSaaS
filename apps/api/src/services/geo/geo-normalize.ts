import type { DestinationKind, GeoPlaceKind } from '@prisma/client';
import { normalizeKey } from '../travel/travel-search.scoring';

/** Clave estable por tenant: nombre normalizado + tipo (evita colisiones cross-kind). */
export function buildGeoNormalizedKey(canonicalName: string, kind: GeoPlaceKind | DestinationKind): string {
  const k =
    typeof kind === 'string'
      ? normalizeKey(kind.replace(/_/g, '-'))
      : normalizeKey(String(kind));
  return `${normalizeKey(canonicalName)}:${k}`;
}

export function mapDestinationKindToGeoPlaceKind(type: DestinationKind): GeoPlaceKind {
  switch (type) {
    case 'COUNTRY':
      return 'COUNTRY';
    case 'REGION':
      return 'REGION';
    case 'CITY':
      return 'CITY';
    case 'AREA':
      return 'AREA';
    case 'ATTRACTION':
      return 'ATTRACTION';
    default:
      return 'AREA';
  }
}
