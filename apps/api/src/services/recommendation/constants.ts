/** Auditoría: Fase 2 añade retrieval híbrido + factor semanticSimilarity; Fase 3 bonus por destinos nominales en intención. */
export const SCORING_MODEL_VERSION = 'rec-engine-v2.1.0';

/** Ratio precio/budget por defecto antes de HARD constraint. */
export const DEFAULT_MAX_BUDGET_HARD_RATIO = 1.55;

/** Penalización MMR por similitud entre viajes ya seleccionados. */
export const DEFAULT_DIVERSITY_LAMBDA = 12;

/** Ventana de score para pool comercial de la opción recomendada. */
export const COMMERCIAL_SCORE_TOLERANCE = 18;

/** Mínimo de puntos de destino (0–30) para considerar encaje “fuerte” en catálogo. */
export const DESTINATION_STRONG_POINTS = 12;

/** Por debajo: exclusión del ranking principal si hay destino explícito en intención. */
export const DESTINATION_MAIN_POOL_MIN = 6;

/** Máx. puntos del factor semanticSimilarity (sobre vector retrieval, no sustituye destino duro). */
export const SEMANTIC_SIMILARITY_MAX_POINTS = 15;

/** Bonus acotado por país/lugar citado explícitamente en `preferredDestinations` (no sustituye presupuesto/duración). */
export const PREFERRED_DESTINATION_BONUS_MAX = 8;

/** Mínimo `destinationPoints` (0–30) sobre ese nombre para conceder parte del bonus. */
export const PREFERRED_DESTINATION_LEXICAL_FLOOR = 7;

/** Match lexical para forzar slot ALTERNATIVE hacia un preferido nombrado. */
export const PREFERRED_DESTINATION_SLOT_MIN_POINTS = 10;

/** No sustituir la alternativa por un encaje muy flojo respecto al top del ranking. */
export const PREFERRED_DESTINATION_SLOT_MAX_SCORE_GAP = 38;

/** Tope de candidatos tras fusión híbrida antes de constraints/scoring. */
export const HYBRID_RETRIEVAL_POOL_CAP = 100;

export const HYBRID_RETRIEVAL_PROFILE_VERSION = 'hybrid-v1';

export const DEFAULT_LEXICAL_WEIGHT = 0.25;
export const DEFAULT_VECTOR_WEIGHT = 0.45;
export const DEFAULT_STRUCTURED_WEIGHT = 0.3;
