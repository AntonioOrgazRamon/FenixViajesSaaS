import type { TravelJsonImportItemValidationStatus } from '@prisma/client';
import type { z } from 'zod';
import type { TripAiExtract } from './trip-ai.schemas';
import {
  travelJsonEnrichedItemZ,
  travelJsonTripLegacyRootZ,
  type TravelJsonEnrichedRecord,
  type TravelJsonImportMetadata,
  type TravelJsonSource,
  type TravelJsonTripInner,
} from './travel-json-import.schema';
import {
  normalizeItineraryDay,
  normalizePaceCanonical,
  normalizeTravelStylesWithAxes,
  type NormalizedItineraryDay,
} from './travel-json-import-flex-normalize';

export { normalizeItineraryDay, normalizePaceCanonical } from './travel-json-import-flex-normalize';

export function normalizeImportSlug(slug: string): string {
  return slug
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

function trimStr(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

function defaultSource(): TravelJsonSource {
  return {
    documentName: null,
    pageStart: null,
    pageEnd: null,
    rawReference: null,
    confidence: null,
  };
}

function defaultMetadata(overrides?: Partial<TravelJsonImportMetadata>): TravelJsonImportMetadata {
  return {
    extractionConfidence: overrides?.extractionConfidence ?? 1,
    needsManualReview: overrides?.needsManualReview ?? false,
    missingImportantFields: [...(overrides?.missingImportantFields ?? [])],
    possibleProblems: [...(overrides?.possibleProblems ?? [])],
  };
}

function normalizeSource(raw: TravelJsonSource): TravelJsonSource {
  return {
    ...raw,
    documentName: raw.documentName != null ? trimStr(raw.documentName) || null : null,
    rawReference: raw.rawReference != null ? trimStr(raw.rawReference) || null : null,
    pageStart: raw.pageStart ?? null,
    pageEnd: raw.pageEnd ?? null,
    confidence: raw.confidence ?? null,
  };
}

/** Normaliza strings y listas del bloque `trip` sin perder claves extra (passthrough). */
export function normalizeTripInner(raw: TravelJsonTripInner): TravelJsonTripInner {
  return {
    ...raw,
    title: trimStr(raw.title),
    slug: trimStr(raw.slug),
    mainDestination: trimStr(raw.mainDestination),
    currency: trimStr(raw.currency).slice(0, 8).toUpperCase() || 'EUR',
    secondaryDestinations: (raw.secondaryDestinations ?? []).map((c) => trimStr(c)).filter(Boolean),
    continents: (raw.continents ?? []).map((c) => trimStr(c)).filter(Boolean),
    countries: (raw.countries ?? []).map((c) => trimStr(c)).filter(Boolean),
    regions: (raw.regions ?? []).map((c) => trimStr(c)).filter(Boolean),
    cities: (raw.cities ?? []).map((c) => trimStr(c)).filter(Boolean),
    islands: (raw.islands ?? []).map((c) => trimStr(c)).filter(Boolean),
    seasonality: (raw.seasonality ?? []).map((c) => trimStr(c)).filter(Boolean),
    ...normalizeTravelStylesWithAxes(raw.travelStyles ?? []),
    idealFor: (raw.idealFor ?? []).map((c) => trimStr(c)).filter(Boolean),
    luxuryLevel: raw.luxuryLevel != null ? trimStr(raw.luxuryLevel) || null : null,
    budgetTier: raw.budgetTier != null ? trimStr(raw.budgetTier) || null : null,
    pace: (() => {
      const canon = normalizePaceCanonical(raw.pace != null ? String(raw.pace) : null);
      if (canon != null) return canon;
      return raw.pace != null ? trimStr(String(raw.pace)) || null : null;
    })(),
    shortDescription: trimStr(raw.shortDescription ?? ''),
    longDescription: trimStr(raw.longDescription ?? ''),
    itinerary: (raw.itinerary ?? [])
      .map((d) => normalizeItineraryDay(d))
      .filter((x): x is NonNullable<typeof x> => x != null),
    highlights: (raw.highlights ?? []).map((h) =>
      typeof h === 'string' ? trimStr(h) : { text: trimStr(h.text) },
    ),
    includedServices: (raw.includedServices ?? []).map((s) => trimStr(s)).filter(Boolean),
    excludedServices: (raw.excludedServices ?? []).map((s) => trimStr(s)).filter(Boolean),
    hotels: (raw.hotels ?? []).map((h) => ({
      ...h,
      hotelName: h.hotelName != null ? trimStr(h.hotelName) : null,
      city: h.city != null ? trimStr(h.city) : null,
      category: h.category != null ? trimStr(h.category) : null,
    })),
    transport: (raw.transport ?? []).map((s) => trimStr(s)).filter(Boolean),
    mealPlan: (raw.mealPlan ?? []).map((s) => trimStr(s)).filter(Boolean),
    importantNotes: (raw.importantNotes ?? []).map((s) => trimStr(s)).filter(Boolean),
    availabilityNotes: (raw.availabilityNotes ?? []).map((s) => trimStr(s)).filter(Boolean),
    requirements: (raw.requirements ?? []).map((s) => trimStr(s)).filter(Boolean),
    rawSnippets: (raw.rawSnippets ?? []).map((s) => trimStr(s)).filter(Boolean),
    durationDays: raw.durationDays,
    durationNights: raw.durationNights ?? null,
    priceFrom: raw.priceFrom ?? null,
    familyFriendly: raw.familyFriendly ?? null,
    honeymoon: raw.honeymoon ?? null,
  };
}

function normalizeMetadata(raw: TravelJsonImportMetadata): TravelJsonImportMetadata {
  return {
    ...raw,
    extractionConfidence: raw.extractionConfidence ?? 1,
    needsManualReview: raw.needsManualReview ?? false,
    missingImportantFields: (raw.missingImportantFields ?? []).map((s) => trimStr(s)).filter(Boolean),
    possibleProblems: (raw.possibleProblems ?? []).map((s) => trimStr(s)).filter(Boolean),
  };
}

/**
 * Valida y normaliza un ítem enriquecido ya parseado por Zod (source/trip/metadata).
 * Conserva extensiones passthrough en cada bloque.
 */
export function normalizeEnrichedTravelJsonItem(item: z.infer<typeof travelJsonEnrichedItemZ>): TravelJsonEnrichedRecord {
  return {
    ...item,
    source: normalizeSource(item.source as TravelJsonSource),
    trip: normalizeTripInner(item.trip as TravelJsonTripInner),
    metadata: normalizeMetadata(item.metadata as TravelJsonImportMetadata),
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Formato plano legado → contrato enriquecido (compatibilidad).
 * Si ya viene `trip`, rellena `source`/`metadata` por defecto si faltan.
 */
export function coerceTravelImportRootToEnriched(raw: unknown): unknown {
  if (!isPlainObject(raw)) return raw;

  if (raw.trip != null && isPlainObject(raw.trip)) {
    const source = isPlainObject(raw.source) ? raw.source : defaultSource();
    const metadata = isPlainObject(raw.metadata) ? raw.metadata : defaultMetadata();
    return { ...raw, source, trip: raw.trip, metadata };
  }

  const legacy = travelJsonTripLegacyRootZ.safeParse(raw);
  if (!legacy.success) {
    return raw;
  }

  const { metadata: legacyNested, ...tripFields } = legacy.data;
  const meta = defaultMetadata({
    extractionConfidence: legacyNested?.confidence ?? 1,
    needsManualReview: legacyNested?.needsManualReview ?? false,
  });

  return {
    source: defaultSource(),
    trip: tripFields,
    metadata: meta,
  };
}

/** Fusiona PATCH (`trip`, `source`, `metadata` o claves planas del viaje) sobre `normalizedJson` enriquecido. */
export function mergeEnrichedNormalizedPatch(
  base: TravelJsonEnrichedRecord,
  patch: Record<string, unknown>,
): TravelJsonEnrichedRecord {
  const tripPatch: Record<string, unknown> = {};
  if (patch.trip && typeof patch.trip === 'object' && !Array.isArray(patch.trip)) {
    Object.assign(tripPatch, patch.trip as Record<string, unknown>);
  }
  const baseTrip = base.trip as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || k === 'trip' || k === 'source' || k === 'metadata') continue;
    if (Object.prototype.hasOwnProperty.call(baseTrip, k)) {
      tripPatch[k] = v;
    }
  }

  const mergedTrip = { ...baseTrip, ...tripPatch } as TravelJsonTripInner;

  let meta = base.metadata;
  if (patch.metadata && typeof patch.metadata === 'object' && !Array.isArray(patch.metadata)) {
    meta = { ...meta, ...(patch.metadata as Record<string, unknown>) } as TravelJsonImportMetadata;
  }

  let source = base.source;
  if (patch.source && typeof patch.source === 'object' && !Array.isArray(patch.source)) {
    source = { ...source, ...(patch.source as Record<string, unknown>) } as TravelJsonSource;
  }

  return {
    source,
    metadata: meta,
    trip: mergedTrip,
  };
}

function emptyInvalidSkeleton(): TravelJsonEnrichedRecord {
  return {
    source: defaultSource(),
    trip: normalizeTripInner({
      title: '',
      slug: '',
      mainDestination: '',
      durationDays: 1,
      currency: 'EUR',
      secondaryDestinations: [],
      continents: [],
      countries: [],
      regions: [],
      cities: [],
      islands: [],
      durationNights: null,
      priceFrom: null,
      seasonality: [],
      travelStyles: [],
      travelStyleAxes: [],
      idealFor: [],
      luxuryLevel: null,
      budgetTier: null,
      pace: null,
      familyFriendly: null,
      honeymoon: null,
      shortDescription: '',
      longDescription: '',
      highlights: [],
      includedServices: [],
      excludedServices: [],
      hotels: [],
      transport: [],
      mealPlan: [],
      itinerary: [],
      importantNotes: [],
      availabilityNotes: [],
      requirements: [],
      rawSnippets: [],
    }),
    metadata: defaultMetadata(),
  };
}

export type TravelJsonItemClassification = {
  status: TravelJsonImportItemValidationStatus;
  errors: string[];
  warnings: string[];
  normalized: TravelJsonEnrichedRecord;
};

export function classifyTravelJsonTrip(rawUnknown: unknown): TravelJsonItemClassification {
  const coerced = coerceTravelImportRootToEnriched(rawUnknown);
  const parsed = travelJsonEnrichedItemZ.safeParse(coerced);

  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ');
    return {
      status: 'INVALID',
      errors: [msg || 'Elemento inválido (formato enriquecido source/trip/metadata o plano legado)'],
      warnings: [],
      normalized: emptyInvalidSkeleton(),
    };
  }

  if (!parsed.data.trip) {
    return {
      status: 'INVALID',
      errors: ['Falta trip'],
      warnings: [],
      normalized: emptyInvalidSkeleton(),
    };
  }

  const normalized = normalizeEnrichedTravelJsonItem(parsed.data);
  const t = normalized.trip;
  const md = normalized.metadata;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!t.title) errors.push('Falta trip.title');
  if (!t.slug) errors.push('Falta trip.slug');
  if (!t.mainDestination) errors.push('Falta trip.mainDestination');
  if (!Number.isFinite(t.durationDays) || !Number.isInteger(t.durationDays) || t.durationDays < 1) {
    errors.push('trip.durationDays inválido (entero ≥ 1)');
  }
  if (t.priceFrom != null && (typeof t.priceFrom !== 'number' || t.priceFrom < 0)) {
    errors.push('trip.priceFrom negativo o inválido');
  }

  const rawIt = parsed.data.trip.itinerary ?? [];
  const normIt = normalized.trip.itinerary ?? [];
  if (rawIt.length > 0 && normIt.length !== rawIt.length) {
    errors.push('trip.itinerary: cada día debe tener day o dayNumber válido');
  }

  if (md.needsManualReview === true) warnings.push('needsManualReview=true');
  if (md.extractionConfidence < 0.75) warnings.push('extractionConfidence baja (< 0.75)');
  if (t.priceFrom == null) warnings.push('Falta trip.priceFrom');
  if (!t.countries?.length) warnings.push('Falta trip.countries');
  if (!t.cities?.length) warnings.push('Falta trip.cities');
  if (!t.itinerary?.length) warnings.push('Falta trip.itinerary');
  if (!t.highlights?.length) warnings.push('Falta trip.highlights');
  if ((md.possibleProblems ?? []).length > 0) warnings.push('metadata.possibleProblems no vacío');

  let status: TravelJsonImportItemValidationStatus;
  if (errors.length) status = 'INVALID';
  else if (warnings.length) status = 'WARNING';
  else status = 'VALID';

  return { status, errors, warnings, normalized };
}

export function travelJsonToTripAiExtract(enriched: TravelJsonEnrichedRecord): TripAiExtract {
  const t = enriched.trip;
  const destinations: TripAiExtract['destinations'] = [
    ...t.countries.map((name) => ({ name, type: 'COUNTRY' as const })),
    ...t.regions.map((name) => ({ name, type: 'REGION' as const })),
    ...t.cities.map((name) => ({ name, type: 'CITY' as const })),
    ...t.islands.map((name) => ({ name, type: 'AREA' as const })),
    ...(t.secondaryDestinations ?? []).map((name) => ({ name, type: 'AREA' as const })),
    ...(t.continents ?? []).map((name) => ({ name, type: 'REGION' as const })),
  ];

  const itineraryDays = (t.itinerary as NormalizedItineraryDay[]).map((d, i) => ({
    dayNumber: d.dayNumber,
    title: d.title ?? null,
    description: d.description ?? null,
    meals: d.meals ?? null,
    accommodation: d.accommodation ?? null,
    order: i,
  }));

  const services: TripAiExtract['services'] = [
    ...t.includedServices.map((text, order) => ({ type: 'INCLUDED' as const, text, order })),
    ...t.excludedServices.map((text, order) => ({
      type: 'NOT_INCLUDED' as const,
      text,
      order: t.includedServices.length + order,
    })),
  ];

  const highlights = t.highlights.map((h, order) => ({
    text: typeof h === 'string' ? h : h.text,
    order,
  }));

  const hotels = t.hotels.map((h, order) => ({
    hotelName: h.hotelName ?? null,
    city: h.city ?? null,
    category: h.category ?? null,
    order,
  }));

  const descriptionParts = [t.shortDescription, t.longDescription].filter(Boolean).join('\n\n');

  const nights =
    t.durationNights != null && Number.isFinite(t.durationNights)
      ? Math.max(0, t.durationNights)
      : t.durationDays != null && t.durationDays > 0
        ? Math.max(0, t.durationDays - 1)
        : null;

  const metaPayload = { source: enriched.source, metadata: enriched.metadata };
  const observations: TripAiExtract['observations'] = [
    { text: `[IMPORT_JSON_META] ${JSON.stringify(metaPayload).slice(0, 1500)}`, order: 0 },
  ];

  return {
    title: t.title,
    provider: null,
    season: (t.seasonality ?? []).length ? (t.seasonality ?? []).join(', ') : null,
    mainDestination: t.mainDestination,
    description: descriptionParts.length > 0 ? descriptionParts : null,
    durationDays: t.durationDays,
    durationNights: nights,
    indicativePrice: t.priceFrom ?? null,
    currency: (t.currency?.trim().slice(0, 3).toUpperCase() ?? '') || 'EUR',
    confidence: enriched.metadata.extractionConfidence,
    destinations,
    itineraryDays,
    services,
    departures: [],
    hotels,
    highlights,
    observations,
  };
}
