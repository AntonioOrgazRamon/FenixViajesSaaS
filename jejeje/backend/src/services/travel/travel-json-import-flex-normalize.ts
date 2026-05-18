import type { TravelStyleAxis, TripPace } from '@prisma/client';

export type NormalizedItineraryDay = {
  dayNumber: number;
  title: string | null;
  description: string | null;
  meals: string | null;
  accommodation: string | null;
  locations: string[];
};

function trimStr(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

function foldKey(s: string): string {
  return trimStr(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * ChatGPT puede mandar `day` o `dayNumber`. Salida siempre con `dayNumber` (sin `day`).
 */
export function normalizeItineraryDay(item: unknown): NormalizedItineraryDay | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const o = item as Record<string, unknown>;
  const dn = o.dayNumber ?? o.day;
  let dayNumber: number;
  if (typeof dn === 'number' && Number.isFinite(dn) && Number.isInteger(dn) && dn > 0) {
    dayNumber = dn;
  } else if (typeof dn === 'string' && /^\d+$/.test(dn.trim())) {
    dayNumber = parseInt(dn.trim(), 10);
  } else {
    return null;
  }

  const locRaw = o.locations;
  const locations = Array.isArray(locRaw)
    ? locRaw.map((x) => (typeof x === 'string' ? trimStr(x) : '')).filter(Boolean)
    : [];

  return {
    dayNumber,
    title: o.title != null ? trimStr(String(o.title)) || null : null,
    description: o.description != null ? trimStr(String(o.description)) || null : null,
    meals: o.meals != null ? trimStr(String(o.meals)) || null : null,
    accommodation: o.accommodation != null ? trimStr(String(o.accommodation)) || null : null,
    locations,
  };
}

const PACE_ALIASES: Record<string, TripPace> = {
  moderate: 'BALANCED',
  balanced: 'BALANCED',
  medio: 'BALANCED',
  moderado: 'BALANCED',
  equilibrado: 'BALANCED',
  relaxed: 'RELAXED',
  relax: 'RELAXED',
  tranquilo: 'RELAXED',
  lento: 'RELAXED',
  intensive: 'INTENSIVE',
  intense: 'INTENSIVE',
  fast: 'INTENSIVE',
  rapido: 'INTENSIVE',
  rápido: 'INTENSIVE',
  exigente: 'INTENSIVE',
};

/** `TripPace` canónico para JSON normalizado y BD, o null si no se reconoce. */
export function normalizePaceCanonical(raw: string | null | undefined): TripPace | null {
  if (raw == null) return null;
  const t = trimStr(String(raw));
  if (!t) return null;
  const k = foldKey(t);
  if (PACE_ALIASES[k]) return PACE_ALIASES[k];
  const up = t.toUpperCase().replace(/\s+/g, '_');
  if (up === 'UNKNOWN' || up === 'RELAXED' || up === 'BALANCED' || up === 'INTENSIVE') {
    return up as TripPace;
  }
  return null;
}

function inferTravelStyleAxis(label: string): TravelStyleAxis | null {
  const compact = foldKey(label).replace(/\s+/g, '');
  const synonyms: Record<string, TravelStyleAxis> = {
    gastronomia: 'GASTRONOMY',
    gastronomy: 'GASTRONOMY',
    vino: 'GASTRONOMY',
    wine: 'GASTRONOMY',
    enoturismo: 'GASTRONOMY',
    cultura: 'CULTURE',
    culture: 'CULTURE',
    ciudad: 'CITY_BREAK',
    citybreak: 'CITY_BREAK',
    naturaleza: 'NATURE',
    nature: 'NATURE',
    glaciares: 'NATURE',
    glaciar: 'NATURE',
    cataratas: 'NATURE',
    cascadas: 'NATURE',
    aventura: 'ADVENTURE',
    adventure: 'ADVENTURE',
    playa: 'BEACH',
    beach: 'BEACH',
    fotografia: 'PHOTOGRAPHY',
    photography: 'PHOTOGRAPHY',
    fauna: 'WILDLIFE',
    wildlife: 'WILDLIFE',
    familia: 'FAMILY',
    family: 'FAMILY',
    lunademiel: 'HONEYMOON',
    honeymoon: 'HONEYMOON',
    bienestar: 'WELLNESS',
    wellness: 'WELLNESS',
  };

  if (synonyms[compact]) return synonyms[compact];
  if (compact.includes('tradicion')) return 'CULTURE';
  if (compact.includes('glaciar') || compact.includes('catarat') || compact.includes('catarata')) return 'NATURE';
  if (compact.includes('gastro') || compact.includes('vino')) return 'GASTRONOMY';
  if (compact.includes('ciudad') || compact.includes('urban')) return 'CITY_BREAK';
  if (compact.includes('natur')) return 'NATURE';
  if (compact.includes('cultur')) return 'CULTURE';

  return null;
}

/** Conserva etiquetas libres y deduce ejes internos cuando hay mapping. */
export function normalizeTravelStylesWithAxes(styles: string[]): {
  travelStyles: string[];
  travelStyleAxes: TravelStyleAxis[];
} {
  const travelStyles = [...new Set(styles.map((s) => trimStr(s)).filter(Boolean))];
  const axesSet = new Set<TravelStyleAxis>();
  for (const s of travelStyles) {
    const ax = inferTravelStyleAxis(s);
    if (ax) axesSet.add(ax);
  }
  return { travelStyles, travelStyleAxes: [...axesSet] };
}
