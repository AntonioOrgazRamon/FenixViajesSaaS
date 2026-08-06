import type { RecommendationMatchState } from '@prisma/client';

export type ConstraintKind = 'HARD' | 'SOFT' | 'POLICY';

export type ConstraintViolation = {
  code: string;
  kind: ConstraintKind;
  message: string;
  messageCustomer?: string;
  /** Penalización 0–100 aplicable al score global (SOFT). */
  penaltyPoints?: number;
};

export type ConstraintEvaluation = {
  eligible: boolean;
  violations: ConstraintViolation[];
  /** Penalizaciones SOFT acumuladas (puntos a restar del score bruto). */
  softPenaltyTotal: number;
};

export type RecommendationPolicy = {
  blockedProviders?: string[];
  /** Ratio máximo precio/budget antes de excluir el viaje (HARD). */
  maxBudgetHardRatio?: number;
  /** Umbral destino para el pool principal (sobreescribe DEFAULT). */
  destinationMainPoolMin?: number;
  destinationStrongPoints?: number;
  /** Si true y no hay destino en catálogo, se rellena ranked con alternativas relajadas etiquetadas. */
  allowRelaxedAlternatives?: boolean;
};

export type ValidationSeverity = 'INFO' | 'WARN' | 'CLARIFICATION' | 'BLOCK';

export type ValidationIssue = {
  code: string;
  severity: ValidationSeverity;
  message: string;
  messageCustomer?: string;
};

export type TripMetaForDiversity = {
  tripId: string;
  regionKey: string;
  priceBucket: number;
  stylesKey: string;
  luxuryRank: number;
  numericPrice: number | null;
};

export type HybridRetrievalTelemetry = {
  profileVersion: string;
  poolSize: number;
  catalogSize: number;
  missingEmbeddings: number;
  queryEmbeddingOk: boolean;
  weights: { lexical: number; vector: number; structured: number };
  lexicalMs: number;
  structuredMs: number;
  vectorMs: number;
  embedQueryMs: number;
  warnings: string[];
};

export type RecommendationTelemetry = {
  timingsMs: {
    retrieval: number;
    constraints: number;
    scoring: number;
    diversity: number;
    slots: number;
    persistence: number;
    total: number;
  };
  counts: {
    catalogApproved: number;
    /** Tamaño del pool tras retrieval híbrido (si aplica); si no, igual a catalogApproved. */
    retrievalPool?: number;
    afterHardFilters: number;
    rankedCap: number;
    /** True si se aplicó nonRelaxedCandidateRows más pequeño que el catálogo (prefiltro geo). */
    geoPrefilterActive?: boolean;
  };
  retrieval?: HybridRetrievalTelemetry;
  whyNotSample?: { tripId: string; reasons: string[] }[];
};

export type { RecommendationMatchState } from '@prisma/client';
