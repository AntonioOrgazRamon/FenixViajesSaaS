import { z } from 'zod';

/** Breaking: premiumUx — narrativa humana determinista + panel de confianza (sin LLM). */
export const TRAVEL_SEARCH_SCHEMA_VERSION = '2.3.0' as const;

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
  /** Presupuesto total (p. ej. perfil de lead con budgetType TOTAL). */
  totalBudget: z.number().positive().max(1_000_000_000).optional(),
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
  /**
   * Destinos o países que el cliente nombra explícitamente (además de `destination` regional).
   * Entran al scoring como bonus acotado y a la lógica de slot ALTERNATIVE.
   */
  preferredDestinations: z.array(z.string().max(120)).max(16).optional(),
  /** Aeropuerto o ciudad de salida indicados por el cliente. */
  departureAirport: z.string().max(120).optional(),
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
export type RecommendationMatchState = z.infer<typeof recommendationMatchStateZ>;
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
  /** Score antes del ajuste de honestidad (solo si difiere de `score`). */
  rawScore: z.number().min(0).max(100).optional(),
  matchState: recommendationMatchStateZ,
  /** 0–1 confianza sobre factores activos (tras ajuste de honestidad). */
  confidence: z.number().min(0).max(1).nullable(),
  /** Factores de scoring con peso > 0 para este viaje. */
  matchCoverageDimensions: z.number().int().min(0).max(24).optional(),
  /** Réplica de la amplitud de intención del cliente (útil en telemetría/PDF). */
  intentSignalBreadth: z.number().int().min(0).max(24).optional(),
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

export const travelTrustSummaryZ = z.object({
  intentSignalBreadth: z.number().int().min(0).max(24),
  /** 0–1: criterios explícitos del cliente frente al máximo modelado (8 flags en `criteriaApplied`). */
  intentCompleteness: z.number().min(0).max(1),
  catalogTripCount: z.number().int().min(0),
  /** 0–1: proporción de catálogo que entró en el ranking final (sin sustituir métricas de negocio). */
  catalogEligibleRatio: z.number().min(0).max(1),
  topMatchCoverageDimensions: z.number().int().min(0).max(24).nullable(),
  /** Score bruto top-1 si hubo cap por cobertura fina de criterios. */
  topRawScoreIfAdjusted: z.number().min(0).max(100).nullable(),
});

export type TravelTrustSummary = z.infer<typeof travelTrustSummaryZ>;

export const travelPremiumConfidencePanelZ = z.object({
  matchQualityHeadline: z.string(),
  matchQualityBody: z.string(),
  catalogCoverageHeadline: z.string(),
  catalogCoverageBody: z.string(),
  confidenceHeadline: z.string(),
  confidenceBody: z.string(),
  missingInformation: z.array(z.string()).max(16),
  partialRecommendationRisk: z.string(),
});

export type TravelPremiumConfidencePanel = z.infer<typeof travelPremiumConfidencePanelZ>;

export const travelPremiumUxZ = z.object({
  /** Párrafo único: lectura humana del resultado (honesto). */
  humanReadableReasoning: z.string(),
  /** Bullets “por qué miramos este circuito” (derivados de contribuciones positivas). */
  whyRecommendedBullets: z.array(z.string()).max(12),
  topStrengths: z.array(z.string()).max(14),
  mainTradeoffs: z.array(z.string()).max(14),
  /** Líneas comerciales cuando un slot encaja con un destino nombrado por el cliente. */
  commercialPreferenceNotes: z.array(z.string()).max(8).optional(),
  geoContextLine: z.string().nullable(),
  confidencePanel: travelPremiumConfidencePanelZ,
  similarAlternativesSummary: z.string(),
});

export type TravelPremiumUx = z.infer<typeof travelPremiumUxZ>;

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

export function intentEffectiveBudgetPerPerson(intent: TravelSearchIntent): number | undefined {
  if (intent.budgetPerPerson != null && Number.isFinite(intent.budgetPerPerson)) {
    return intent.budgetPerPerson;
  }
  if (
    intent.totalBudget != null &&
    Number.isFinite(intent.totalBudget) &&
    intent.travelers != null &&
    intent.travelers >= 1
  ) {
    return intent.totalBudget / intent.travelers;
  }
  if (intent.totalBudget != null && Number.isFinite(intent.totalBudget)) {
    return intent.totalBudget;
  }
  return undefined;
}

export function criteriaAppliedFromIntent(intent: TravelSearchIntent): TravelSearchCriteriaApplied {
  return {
    destination: Boolean(intent.destination?.trim()),
    durationDays: intent.durationDays != null,
    budgetPerPerson: intent.budgetPerPerson != null || intent.totalBudget != null,
    calendar: intent.month != null || Boolean(intent.approximateStartDate?.trim()),
    travelers: intent.travelers != null,
    travelType: Boolean(intent.travelType?.trim()),
    tagsOrPreferences:
      Boolean(intent.tags?.length) ||
      Boolean(intent.preferences?.length) ||
      Boolean(intent.preferredDestinations?.length),
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
  trustSummary: travelTrustSummaryZ,
  /** Narrativa premium + panel de confianza (determinista). */
  premiumUx: travelPremiumUxZ,
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
