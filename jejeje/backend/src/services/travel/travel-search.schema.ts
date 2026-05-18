import { z } from 'zod';

/** Breaking: picks renombrados, explainability y estados de match formales. */
export const TRAVEL_SEARCH_SCHEMA_VERSION = '2.0.0' as const;

export const travelStyleAxisZ = z.enum([
  'CULTURE',
  'BEACH',
  'NATURE',
  'ADVENTURE',
  'GASTRONOMY',
  'WELLNESS',
  'NIGHTLIFE',
  'CITY_BREAK',
  'CRUISE',
  'SAFARI',
  'SKI',
  'ROAD_TRIP',
  'SHOPPING',
  'FAMILY',
  'HONEYMOON',
  'SENIOR_FRIENDLY',
  'ACCESSIBILITY',
  'WILDLIFE',
  'PHOTOGRAPHY',
]);

/**
 * Entrada: intención del cliente (tenant resuelto en controller; no enviar companyId en body público).
 */
export const travelSearchIntentZ = z.object({
  destination: z.string().max(300).optional(),
  durationDays: z.number().int().min(1).max(365).optional(),
  budgetPerPerson: z.number().positive().max(1_000_000).optional(),
  month: z.number().int().min(1).max(12).optional(),
  approximateStartDate: z
    .string()
    .max(40)
    .optional()
    .refine((s) => !s || !Number.isNaN(Date.parse(s)), 'Fecha inválida'),
  travelers: z.number().int().min(1).max(500).optional(),
  travelType: z.string().max(120).optional(),
  tags: z.array(z.string().max(80)).max(40).optional(),
  preferences: z.array(z.string().max(200)).max(40).optional(),
  /** Ejes de experiencia estructurados (prioriza ontología sobre texto suelto). */
  travelStyleAxes: z.array(travelStyleAxisZ).max(24).optional(),
});

export type TravelStyleAxisIntent = z.infer<typeof travelStyleAxisZ>;
export type TravelSearchIntent = z.infer<typeof travelSearchIntentZ>;

export const travelSearchIntentRequestZ = travelSearchIntentZ.extend({
  persistRun: z.boolean().optional(),
  telemetryVerbose: z.boolean().optional(),
  leadId: z.string().uuid().optional(),
});

export type TravelSearchIntentRequest = z.infer<typeof travelSearchIntentRequestZ>;

export const recommendationMatchStateZ = z.enum([
  'STRONG_MATCH',
  'WEAK_MATCH',
  'NO_MATCH',
  'NEEDS_CLARIFICATION',
]);
export const scoreContributionZ = z.object({
  factor: z.string(),
  raw: z.number(),
  weight: z.number(),
  contribution: z.number(),
  explanation: z.string(),
  explanationCustomer: z.string(),
  explanationSeller: z.string(),
});

export type ScoreContribution = z.infer<typeof scoreContributionZ>;

export const travelSearchResultItemZ = z.object({
  tripId: z.string().uuid(),
  score: z.number().min(0).max(100),
  matchState: recommendationMatchStateZ,
  /** 0–1 confianza sobre factores activos. */
  confidence: z.number().min(0).max(1).nullable(),
  contributions: z.array(scoreContributionZ),
  matches: z.array(z.string()),
  misses: z.array(z.string()),
  reasons: z.array(z.string()),
  commercialAngle: z.string(),
  /** True si esta fila proviene de un ranking relajado (sin encaje duro de destino). */
  relaxedAlternative: z.boolean().optional(),
  constraintViolations: z
    .array(
      z.object({
        code: z.string(),
        kind: z.enum(['HARD', 'SOFT', 'POLICY']),
        message: z.string(),
      }),
    )
    .optional(),
  retrievalProvenance: z
    .object({
      hybridScore: z.number(),
      lexicalScore: z.number(),
      vectorScore: z.number(),
      structuredScore: z.number(),
      lexicalNorm: z.number(),
      vectorNorm: z.number(),
      structuredNorm: z.number(),
      retrievalReasons: z.array(z.string()),
    })
    .optional(),
});

export type TravelSearchResultItem = z.infer<typeof travelSearchResultItemZ>;

export const travelSearchCriteriaAppliedZ = z.object({
  destination: z.boolean(),
  durationDays: z.boolean(),
  budgetPerPerson: z.boolean(),
  calendar: z.boolean(),
  travelers: z.boolean(),
  travelType: z.boolean(),
  tagsOrPreferences: z.boolean(),
  travelStyleAxes: z.boolean(),
});

export type TravelSearchCriteriaApplied = z.infer<typeof travelSearchCriteriaAppliedZ>;

export function criteriaAppliedFromIntent(intent: TravelSearchIntent): TravelSearchCriteriaApplied {
  return {
    destination: Boolean(intent.destination?.trim()),
    durationDays: intent.durationDays != null,
    budgetPerPerson: intent.budgetPerPerson != null,
    calendar: intent.month != null || Boolean(intent.approximateStartDate?.trim()),
    travelers: intent.travelers != null,
    travelType: Boolean(intent.travelType?.trim()),
    tagsOrPreferences: Boolean(intent.tags?.length) || Boolean(intent.preferences?.length),
    travelStyleAxes: Boolean(intent.travelStyleAxes?.length),
  };
}

export const validationIssueZ = z.object({
  code: z.string(),
  severity: z.enum(['INFO', 'WARN', 'CLARIFICATION', 'BLOCK']),
  message: z.string(),
  messageCustomer: z.string().optional(),
});

export const travelSearchResponseZ = z.object({
  schemaVersion: z.literal(TRAVEL_SEARCH_SCHEMA_VERSION),
  criteriaApplied: travelSearchCriteriaAppliedZ,
  /** Estado global del run (peor caso / síntesis). */
  matchState: recommendationMatchStateZ,
  globalConfidence: z.number().min(0).max(1).nullable(),
  validationIssues: z.array(validationIssueZ),
  fallbackHints: z.array(z.string()),
  relaxedAlternatives: z.boolean(),
  ranked: z.array(travelSearchResultItemZ),
  picks: z.object({
    recommended: travelSearchResultItemZ.nullable(),
    budget: travelSearchResultItemZ.nullable(),
    luxury: travelSearchResultItemZ.nullable(),
    alternative: travelSearchResultItemZ.nullable(),
  }),
  totalCandidates: z.number().int().min(0),
  scoringModelVersion: z.string(),
  recommendationRunId: z.string().uuid().nullable().optional(),
  debug: z
    .object({
      telemetry: z.record(z.string(), z.unknown()).optional(),
      rejectedSample: z
        .array(z.object({ tripId: z.string(), reasons: z.array(z.string()) }))
        .optional(),
    })
    .optional(),
});

export type TravelSearchResponse = z.infer<typeof travelSearchResponseZ>;
