import type {
  GeoPlaceKind,
  LuxuryLevel,
  TripBudgetTier,
  TripClimatePreference,
  TripExclusivity,
  TripGeoPlaceRole,
  TripPace,
  TravelStyleAxis,
} from '@prisma/client';
/** Fila mínima del catálogo para puntuar (sin Prisma client en front). */
export type TripGeoPlaceLinkRow = {
  geoPlaceId: string;
  normalizedKey: string;
  kind: GeoPlaceKind;
  role: TripGeoPlaceRole;
  ancestorIds: string[];
};

/** Contexto opcional para bonus/penalización geográfica (capa TripGeoPlace / jerarquía). */
export type DestinationPointsGeoOpts = {
  expandedIntentGeoPlaceIds: ReadonlySet<string>;
  intentRootGeoPlaceIds: ReadonlySet<string>;
};

export type TravelTripSearchRow = {
  id: string;
  provider: string | null;
  title: string;
  mainDestination: string | null;
  durationDays: number | null;
  indicativePrice: string | null;
  currency: string | null;
  season: string | null;
  description: string | null;
  tripDestinations: { destination: { name: string; normalizedName: string } }[];
  departures: { startDate: Date | null; endDate: Date | null; departureText: string }[];
  highlights: { text: string }[];
  services: { type: string; text: string }[];
  hotels: { hotelName: string | null; city: string | null; category: string | null }[];
  itineraryDays: { dayNumber: number; title: string | null; description: string | null }[];
  luxuryLevel?: LuxuryLevel | null;
  budgetTier?: TripBudgetTier | null;
  pace?: TripPace | null;
  climatePreference?: TripClimatePreference | null;
  exclusivity?: TripExclusivity | null;
  styleAxes?: TravelStyleAxis[];
  /** Enlaces geo por viaje (ancestros precalculados para scoring). */
  tripGeoPlaces?: TripGeoPlaceLinkRow[];
};

export function normalizeKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function tokenize(s: string): string[] {
  return normalizeKey(s)
    .split('-')
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

/** Jaccard sobre tokens únicos. */
export function tokenJaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

const DESTINATION_LEXICAL_MAX = 30;

/** Solo texto / fichas legacy (sin grafo GeoPlace). */
export function lexicalDestinationPoints(intentDest: string | undefined, trip: TravelTripSearchRow): number {
  const max = DESTINATION_LEXICAL_MAX;
  if (!intentDest?.trim()) {
    return 0;
  }
  const qKey = normalizeKey(intentDest);
  const qTokens = tokenize(intentDest);
  const fields: string[] = [];
  if (trip.mainDestination) fields.push(trip.mainDestination);
  for (const d of trip.tripDestinations) {
    fields.push(d.destination.name, d.destination.normalizedName);
  }
  const keys = fields.map(normalizeKey).filter(Boolean);
  let best = 0;
  if (qKey.length >= 3) {
    for (const k of keys) {
      if (k.includes(qKey) || qKey.includes(k)) {
        best = max;
        break;
      }
    }
  }
  if (best === 0 && qTokens.length) {
    const tripTokens = tokenize(fields.join(' '));
    best = Math.round(tokenJaccard(qTokens, tripTokens) * max);
  }
  return best;
}

export function destinationLexicalMax(): number {
  return DESTINATION_LEXICAL_MAX;
}
