import { z } from 'zod';

/**
 * Entrada flexible (ChatGPT): admite `day` o `dayNumber`; `locations` opcional.
 * La salida normalizada siempre usa `dayNumber` (ver `normalizeItineraryDay`).
 */
export const itineraryDayLooseZ = z
  .object({
    day: z.number().int().positive().optional(),
    dayNumber: z.number().int().positive().optional(),
    title: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    meals: z.string().optional().nullable(),
    accommodation: z.string().optional().nullable(),
    locations: z.array(z.string()).optional().default([]),
  })
  .passthrough();

/** Día de itinerario ya normalizado (contrato interno / BD). */
export const itineraryDayNormalizedZ = z.object({
  dayNumber: z.number().int().positive(),
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  meals: z.string().optional().nullable(),
  accommodation: z.string().optional().nullable(),
  locations: z.array(z.string()).optional().default([]),
});

export const highlightUnionZ = z.union([z.string(), z.object({ text: z.string() })]);



export const travelJsonHotelEntryZ = z

  .object({

    hotelName: z.string().optional().nullable(),

    city: z.string().optional().nullable(),

    category: z.string().optional().nullable(),

  })

  .passthrough();



/** Bloque `source` del contrato enriquecido oficial. */

export const travelJsonSourceZ = z

  .object({

    documentName: z.string().nullable().optional(),

    pageStart: z.number().nullable().optional(),

    pageEnd: z.number().nullable().optional(),

    rawReference: z.string().nullable().optional(),

    confidence: z.number().nullable().optional(),

  })

  .passthrough();



/** Payload `trip` (campos de catálogo). Formato oficial bajo `item.trip`. */

export const travelJsonTripInnerZ = z

  .object({

    title: z.string(),

    slug: z.string(),

    mainDestination: z.string(),

    secondaryDestinations: z.array(z.string()).optional().default([]),

    continents: z.array(z.string()).optional().default([]),

    countries: z.array(z.string()).optional().default([]),

    regions: z.array(z.string()).optional().default([]),

    cities: z.array(z.string()).optional().default([]),

    islands: z.array(z.string()).optional().default([]),

    durationDays: z.number().int().positive(),

    durationNights: z.number().int().nullable().optional(),

    priceFrom: z.number().nonnegative().nullable().optional(),

    currency: z.string().max(8).optional().default('EUR'),

    seasonality: z.array(z.string()).optional().default([]),

    travelStyles: z.array(z.string()).optional().default([]),

    /** Ejes internos inferidos desde `travelStyles` (es/en); no lo envía ChatGPT. */
    travelStyleAxes: z.array(z.string()).optional().default([]),

    idealFor: z.array(z.string()).optional().default([]),

    luxuryLevel: z.string().nullable().optional(),

    budgetTier: z.string().nullable().optional(),

    pace: z.string().nullable().optional(),

    familyFriendly: z.boolean().nullable().optional(),

    honeymoon: z.boolean().nullable().optional(),

    shortDescription: z.string().optional().default(''),

    longDescription: z.string().optional().default(''),

    highlights: z.array(highlightUnionZ).optional().default([]),

    includedServices: z.array(z.string()).optional().default([]),

    excludedServices: z.array(z.string()).optional().default([]),

    hotels: z.array(travelJsonHotelEntryZ).optional().default([]),

    transport: z.array(z.string()).optional().default([]),

    mealPlan: z.array(z.string()).optional().default([]),

    itinerary: z.array(itineraryDayLooseZ).optional().default([]),

    importantNotes: z.array(z.string()).optional().default([]),

    availabilityNotes: z.array(z.string()).optional().default([]),

    requirements: z.array(z.string()).optional().default([]),

    rawSnippets: z.array(z.string()).optional().default([]),

  })

  .passthrough();



/** `metadata` de extracción (contrato oficial). */

export const travelJsonImportMetadataZ = z

  .object({

    extractionConfidence: z.number().min(0).max(1).default(1),

    needsManualReview: z.boolean().default(false),

    missingImportantFields: z.array(z.string()).optional().default([]),

    possibleProblems: z.array(z.string()).optional().default([]),

  })

  .passthrough();



/** Ítem enriquecido oficial: source + trip + metadata. */

export const travelJsonEnrichedItemZ = z

  .object({

    source: travelJsonSourceZ,

    trip: travelJsonTripInnerZ,

    metadata: travelJsonImportMetadataZ,

  })

  .passthrough();



export const travelJsonEnrichedFileZ = z.array(travelJsonEnrichedItemZ);



export type TravelJsonTripInner = z.infer<typeof travelJsonTripInnerZ>;

export type TravelJsonSource = z.infer<typeof travelJsonSourceZ>;

export type TravelJsonImportMetadata = z.infer<typeof travelJsonImportMetadataZ>;

/** Ítem normalizado completo almacenado en `normalizedJson`. */

export type TravelJsonEnrichedRecord = {

  source: TravelJsonSource;

  trip: TravelJsonTripInner;

  metadata: TravelJsonImportMetadata;

};



/**

 * Formato plano legado (solo compatibilidad): mismos campos que `trip` en raíz,

 * opcionalmente `metadata` anidado estilo antiguo `{ needsManualReview, confidence }`.

 */

export const travelJsonTripLegacyRootZ = travelJsonTripInnerZ

  .extend({

    metadata: z

      .object({

        needsManualReview: z.boolean().optional(),

        confidence: z.number().min(0).max(1).optional(),

      })

      .optional(),

  })

  .passthrough();



export type TravelJsonTripLegacyRoot = z.infer<typeof travelJsonTripLegacyRootZ>;


