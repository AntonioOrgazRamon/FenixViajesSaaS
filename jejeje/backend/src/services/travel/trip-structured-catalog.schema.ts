import { z } from 'zod';

/** Salida FASE 3 — estructura canónica (no es el esquema de persistencia Prisma; se mapea a TripAiExtract). */
const itineraryItemZ = z.object({
  dayNumber: z.number().int().positive(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  order: z.number().int().min(0).default(0),
});

export const structuredTripCatalogZ = z.object({
  title: z.string(),
  mainDestination: z.string().nullable().optional(),
  shortDescription: z.string().nullable().optional(),
  semanticDescription: z.string().nullable().optional(),
  durationDays: z.number().int().nullable().optional(),
  durationNights: z.number().int().nullable().optional(),
  itineraryDays: z.array(itineraryItemZ).default([]),
  services: z.array(z.object({ text: z.string(), order: z.number().int().min(0).default(0) })).default([]),
  departures: z.array(z.object({ text: z.string(), order: z.number().int().min(0).default(0) })).default([]),
  hotels: z
    .array(
      z.object({
        city: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        hotelName: z.string().nullable().optional(),
        order: z.number().int().min(0).default(0),
      }),
    )
    .default([]),
  observations: z.array(z.object({ text: z.string(), order: z.number().int().min(0).default(0) })).default([]),
  confidenceScore: z.number().min(0).max(1).default(0),
});

export type StructuredTripCatalog = z.infer<typeof structuredTripCatalogZ>;
