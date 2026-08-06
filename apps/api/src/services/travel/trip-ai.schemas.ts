import { z } from 'zod';

/**
 * FASE 5 — Salida estructurada para la IA. Si un dato no consta, debe ir null, no inventado.
 */
const destinationZ = z.object({
  name: z.string().min(1),
  type: z.enum(['COUNTRY', 'REGION', 'CITY', 'AREA', 'ATTRACTION']),
});

const itineraryDayZ = z.object({
  dayNumber: z.number().int().positive(),
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  meals: z.string().optional().nullable(),
  accommodation: z.string().optional().nullable(),
  order: z.number().int().min(0).default(0),
});

const serviceZ = z.object({
  type: z.enum(['INCLUDED', 'NOT_INCLUDED', 'OPTIONAL']),
  text: z.string().min(1),
  order: z.number().int().min(0).default(0),
});

const departureZ = z.object({
  departureText: z.string().min(1),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  weekdays: z.string().optional().nullable(),
  order: z.number().int().min(0).default(0),
});

const hotelZ = z.object({
  category: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  hotelName: z.string().optional().nullable(),
  order: z.number().int().min(0).default(0),
});

const highlightZ = z.object({
  text: z.string().min(1),
  order: z.number().int().min(0).default(0),
});

const observationZ = z.object({
  text: z.string().min(1),
  order: z.number().int().min(0).default(0),
});

export const tripAiExtractZ = z.object({
  title: z.string().min(1),
  provider: z.string().optional().nullable(),
  season: z.string().optional().nullable(),
  mainDestination: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  durationDays: z.number().int().positive().optional().nullable(),
  durationNights: z.number().int().nonnegative().optional().nullable(),
  /** Precio informativo tal como aparece o en número parseado. */
  indicativePrice: z.number().nonnegative().optional().nullable(),
  currency: z.string().max(3).optional().nullable(),
  /** Nivel de confianza 0-1 (manual, IA, etc.). */
  confidence: z.number().min(0).max(1).optional().nullable(),
  destinations: z.array(destinationZ).default([]),
  itineraryDays: z.array(itineraryDayZ).default([]),
  services: z.array(serviceZ).default([]),
  departures: z.array(departureZ).default([]),
  hotels: z.array(hotelZ).default([]),
  highlights: z.array(highlightZ).default([]),
  observations: z.array(observationZ).default([]),
});

export type TripAiExtract = z.infer<typeof tripAiExtractZ>;
