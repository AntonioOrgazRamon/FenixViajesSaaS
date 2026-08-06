import { z } from 'zod';

export const LEAD_INTENT_EXTRACTOR_AGENT_KEY = 'lead-intent-extractor';

const nullableIsoDate = z.string().max(32).nullable();

export const leadIntentDateRangeZ = z
  .object({
    start: nullableIsoDate,
    end: nullableIsoDate,
  })
  .nullable();

/**
 * Intención de viaje normalizada (extracción + validación Zod).
 * Se persiste en `LeadDetail.travelContext.extractedIntent.intent`.
 */
export const normalizedIntentZ = z.object({
  destination: z.string().max(500).nullable(),
  origin: z.string().max(500).nullable(),
  durationDays: z.number().int().min(0).max(3660).nullable(),
  dateRange: leadIntentDateRangeZ,
  month: z.string().max(80).nullable(),
  budgetTotal: z.number().min(0).nullable(),
  budgetPerPerson: z.number().min(0).max(1_000_000_000).nullable(),
  travelers: z.number().int().min(0).max(500).nullable(),
  adults: z.number().int().min(0).max(500).nullable(),
  children: z.number().int().min(0).max(500).nullable(),
  /** Etiquetas explícitas en texto (ej. crucero, luna de miel). Sin inventar: [] si no hay indicios. Acepta string único del modelo legacy. */
  travelType: z.preprocess((raw) => {
    if (raw === null || raw === undefined) return [];
    if (typeof raw === 'string') return raw.trim() ? [raw.trim()] : [];
    return raw;
  }, z.array(z.string().max(120))),
  preferences: z
    .array(z.string().max(500))
    .nullable()
    .transform((v) => v ?? []),
  restrictions: z
    .array(z.string().max(500))
    .nullable()
    .transform((v) => v ?? []),
  confidence: z.number().min(0).max(1),
  missingInfo: z
    .array(z.string().max(240))
    .nullable()
    .transform((v) => v ?? []),
});

/** @deprecated usar normalizedIntentZ */
export const leadIntentExtractionZ = normalizedIntentZ;

export type NormalizedIntent = z.infer<typeof normalizedIntentZ>;
export type LeadIntentExtraction = NormalizedIntent;

/** Metadatos de almacenamiento en LeadDetail.travelContext.extractedIntent */
export const leadIntentStoredZ = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  triggerType: z.string(),
  usedOpenAI: z.boolean(),
  model: z.string().nullable(),
  intent: normalizedIntentZ,
});

export type LeadIntentStored = z.infer<typeof leadIntentStoredZ>;
