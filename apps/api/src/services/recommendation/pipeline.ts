import { config } from '../../common/config';
import { logger } from '../../common/logger';
import type {
  TravelSearchIntent,
  TravelSearchResponse,
  TravelSearchResultItem,
  RecommendationMatchState,
} from '../travel/travel-search.schema';
import {
  TRAVEL_SEARCH_SCHEMA_VERSION,
  criteriaAppliedFromIntent,
} from '../travel/travel-search.schema';
import type { TravelTripSearchRow, DestinationPointsGeoOpts } from '../travel/travel-search.scoring';
import { mergePolicy } from './policy.util';
import type {
  ConstraintViolation,
  HybridRetrievalTelemetry,
  RecommendationPolicy,
  RecommendationTelemetry,
} from './types';
import { evaluateConstraints, type ConstraintContext } from './constraints.engine';
import { computeCatalogStats, validateIntentAndCatalog } from './validation.engine';
import {
  applySoftConstraintPenalty,
  destinationPoints,
  scoreTripBreakdown,
} from './scoring.engine';
import { reorderWithDiversity } from './diversity.engine';
import { pickCommercialSlots } from './slots.engine';
import { buildFallbackHints } from './fallback.engine';
import { DESTINATION_STRONG_POINTS, SCORING_MODEL_VERSION, SEMANTIC_SIMILARITY_MAX_POINTS, COMMERCIAL_SCORE_TOLERANCE } from './constants';
import {
  adjustScoreAndConfidenceForHonesty,
  deriveHonestItemMatchState,
  intentSignalBreadth,
} from './match-honesty.engine';
import { persistRecommendationRun } from './recommendation-persistence.service';
import { buildTravelPremiumUx } from './recommendation-premium-ux';
import { hybridRetrieve } from './retrieval/hybrid-retrieval.service';
import type { HybridCandidate } from './retrieval/hybrid-retrieval.service';

const RANKED_CAP = 48;

function buildCommercialAngle(
  matches: string[],
  misses: string[],
  violations: ConstraintViolation[],
  relaxed: boolean,
): string {
  const softMsgs = violations.filter((v) => v.kind === 'SOFT').map((v) => v.message);
  const head = matches.length
    ? matches.slice(0, 2).join('; ')
    : relaxed
      ? 'Sin encaje estricto de destino; priorizamos presupuesto, duración y preferencias publicadas.'
      : 'Opción evaluada contra criterios estructurados del cliente.';
  const miss = misses[0] ?? softMsgs[0];
  const tail = miss ? ` Ajustar: ${miss}.` : '';
  return `${head}.${tail}`.replace(/\.\./g, '.').trim();
}

function buildScoredTrip(
  trip: TravelTripSearchRow,
  intent: TravelSearchIntent,
  relaxed: boolean,
  policy: RecommendationPolicy,
  hybrid?: HybridCandidate,
  geoOpts?: DestinationPointsGeoOpts,
): TravelSearchResultItem | null {
  const scoringIntent: TravelSearchIntent = relaxed
    ? { ...intent, destination: undefined }
    : intent;
  const bd = scoreTripBreakdown(scoringIntent, trip, {
    semanticSimilarity01: hybrid?.vectorNorm,
    semanticMaxPoints: SEMANTIC_SIMILARITY_MAX_POINTS,
    geoOpts: relaxed ? undefined : geoOpts,
  });
  const destPts = destinationPoints(intent.destination, trip, geoOpts);
  let priceNum: number | null = null;
  if (trip.indicativePrice != null) {
    const n = parseFloat(trip.indicativePrice);
    priceNum = Number.isFinite(n) ? n : null;
  }
  const destMin = policy.destinationMainPoolMin ?? 6;
  const cctx: ConstraintContext = {
    destinationPoints: destPts,
    numericPrice: priceNum,
    explicitDestination: Boolean(intent.destination?.trim()) && !relaxed,
    mainPoolDestMin: destMin,
  };
  const ce = evaluateConstraints(intent, trip, policy, cctx);
  if (!ce.eligible) return null;

  let score = bd.baseScore100 ?? 0;
  score = applySoftConstraintPenalty(score, ce.softPenaltyTotal);

  const confidenceRaw =
    bd.sumMax > 0
      ? Math.min(1, Math.max(0, bd.sumPts / bd.sumMax))
      : bd.baseScore100 != null
        ? bd.baseScore100 / 100
        : null;

  const criteriaApplied = criteriaAppliedFromIntent(intent);
  const honesty = adjustScoreAndConfidenceForHonesty({
    score,
    confidence: confidenceRaw,
    relaxed,
    criteriaApplied,
    bd,
  });

  score = honesty.score;
  const confidence = honesty.confidence;

  const matchState = deriveHonestItemMatchState(score, confidence, relaxed, honesty);
  const commercialAngle = buildCommercialAngle(bd.matches, bd.misses, ce.violations, relaxed);

  const reasons = [...bd.reasons, ...ce.violations.filter((v) => v.kind === 'SOFT').map((v) => v.message)].slice(
    0,
    22,
  );

  return {
    tripId: trip.id,
    score,
    rawScore: honesty.rawScore !== score ? honesty.rawScore : undefined,
    matchState,
    confidence,
    matchCoverageDimensions: honesty.matchCoverageDimensions,
    intentSignalBreadth: honesty.intentSignalBreadth,
    contributions: bd.contributions,
    matches: bd.matches,
    misses: bd.misses,
    reasons,
    commercialAngle,
    relaxedAlternative: relaxed || undefined,
    constraintViolations: ce.violations.map((v) => ({
      code: v.code,
      kind: v.kind,
      message: v.message,
    })),
    retrievalProvenance: hybrid
      ? {
          hybridScore: hybrid.hybridScore,
          lexicalScore: hybrid.lexicalScore,
          vectorScore: hybrid.vectorScore,
          structuredScore: hybrid.structuredScore,
          lexicalNorm: hybrid.lexicalNorm,
          vectorNorm: hybrid.vectorNorm,
          structuredNorm: hybrid.structuredNorm,
          retrievalReasons: hybrid.retrievalReasons,
        }
      : undefined,
  };
}

function rejectionReasons(
  trip: TravelTripSearchRow,
  intent: TravelSearchIntent,
  relaxed: boolean,
  policy: RecommendationPolicy,
  geoOpts?: DestinationPointsGeoOpts,
): string[] {
  const destPts = destinationPoints(intent.destination, trip, geoOpts);
  let priceNum: number | null = null;
  if (trip.indicativePrice != null) {
    const n = parseFloat(trip.indicativePrice);
    priceNum = Number.isFinite(n) ? n : null;
  }
  const cctx: ConstraintContext = {
    destinationPoints: destPts,
    numericPrice: priceNum,
    explicitDestination: Boolean(intent.destination?.trim()) && !relaxed,
    mainPoolDestMin: policy.destinationMainPoolMin ?? 6,
  };
  const ce = evaluateConstraints(intent, trip, policy, cctx);
  return ce.violations.map((v) => `${v.code}: ${v.message}`);
}

function globalStateFrom(
  top: TravelSearchResultItem | undefined,
  validationIssues: { severity: string }[],
  noEligible: boolean,
): RecommendationMatchState {
  if (validationIssues.some((i) => i.severity === 'BLOCK')) return 'NO_MATCH';
  if (validationIssues.some((i) => i.severity === 'CLARIFICATION')) return 'NEEDS_CLARIFICATION';
  if (noEligible || !top) return 'NO_MATCH';
  if (top.matchState === 'STRONG_MATCH') return 'STRONG_MATCH';
  if (top.matchState === 'WEAK_MATCH') return 'WEAK_MATCH';
  return 'NO_MATCH';
}

export type RunTravelRecommendationOptions = {
  companyPolicyJson?: unknown;
  policyOverride?: Partial<RecommendationPolicy>;
  persist?: { leadId?: string; userId?: string };
  telemetryVerbose?: boolean;
  /** Desactiva pool híbrido (evalúa catálogo APPROVED completo como Fase 1). */
  skipHybridRetrieval?: boolean;
  /** Grafo geo desde TripGeoRetrievalService (dual-read / fallback si ausente). */
  geoScoringContext?: DestinationPointsGeoOpts;
  /** Pool nominal antes del modo relajado; si no se envía, se usa el catálogo completo. */
  nonRelaxedCandidateRows?: TravelTripSearchRow[];
};

/**
 * Pipeline: intención → validación → (retrieval híbrido opcional) → constraints → scoring → diversidad → slots → respuesta.
 */
export async function runTravelRecommendation(params: {
  companyId: string;
  intent: TravelSearchIntent;
  rows: TravelTripSearchRow[];
  options?: RunTravelRecommendationOptions;
}): Promise<{
  response: TravelSearchResponse;
  telemetry: RecommendationTelemetry;
}> {
  const t0 = Date.now();
  const { companyId, intent, rows } = params;
  const policy = mergePolicy(params.options?.companyPolicyJson, params.options?.policyOverride);
  const geoOpts = params.options?.geoScoringContext;

  const stats = computeCatalogStats(rows);
  const validationIssues = validateIntentAndCatalog(intent, stats);
  const timings: RecommendationTelemetry['timingsMs'] = {
    retrieval: 0,
    constraints: 0,
    scoring: 0,
    diversity: 0,
    slots: 0,
    persistence: 0,
    total: 0,
  };

  const explicitDest = Boolean(intent.destination?.trim());
  let bestDestInCatalog = 0;
  if (explicitDest) {
    for (const r of rows) {
      bestDestInCatalog = Math.max(
        bestDestInCatalog,
        destinationPoints(intent.destination, r, geoOpts),
      );
    }
  }
  const noDestinationMatch =
    explicitDest && bestDestInCatalog < (policy.destinationStrongPoints ?? DESTINATION_STRONG_POINTS);

  let workingRows = params.options?.nonRelaxedCandidateRows ?? rows;
  let hybridByTripId = new Map<string, HybridCandidate>();
  let retrievalTelemetry: HybridRetrievalTelemetry | undefined;

  if (
    config.TRAVEL_HYBRID_RETRIEVAL_ENABLED &&
    !params.options?.skipHybridRetrieval &&
    rows.length > 0
  ) {
    const tRet = Date.now();
    try {
      const h = await hybridRetrieve(companyId, intent, workingRows, { geoOpts });
      timings.retrieval = Date.now() - tRet;
      hybridByTripId = h.byTripId;
      workingRows = h.candidateRows.length > 0 ? h.candidateRows : workingRows;
      retrievalTelemetry = {
        profileVersion: h.stats.profileVersion,
        poolSize: h.stats.poolSize,
        catalogSize: h.stats.catalogSize,
        missingEmbeddings: h.stats.missingEmbeddings,
        queryEmbeddingOk: h.stats.queryEmbeddingOk,
        weights: h.stats.weights,
        lexicalMs: h.stats.lexicalMs,
        structuredMs: h.stats.structuredMs,
        vectorMs: h.stats.vectorMs,
        embedQueryMs: h.stats.embedQueryMs,
        warnings: h.warnings,
      };
    } catch (e) {
      logger.warn({ err: e, companyId }, 'Hybrid retrieval error; usando catálogo completo');
      timings.retrieval = Date.now() - tRet;
      const geoPool = params.options?.nonRelaxedCandidateRows ?? rows;
      workingRows = geoPool;
      retrievalTelemetry = {
        profileVersion: 'fallback',
        poolSize: geoPool.length,
        catalogSize: geoPool.length,
        missingEmbeddings: 0,
        queryEmbeddingOk: false,
        weights: { lexical: 0, vector: 0, structured: 0 },
        lexicalMs: 0,
        structuredMs: 0,
        vectorMs: 0,
        embedQueryMs: 0,
        warnings: ['Error interno en hybrid retrieval; se evaluó el catálogo completo.'],
      };
    }
  }

  let relaxedAlternatives = false;

  const tScoreStart = Date.now();

  let eligibleItems: TravelSearchResultItem[] = [];
  const rejectedSample: { tripId: string; reasons: string[] }[] = [];

  const tryScore = (relaxed: boolean) => {
    const sourceRows = relaxed ? rows : workingRows;
    const list: TravelSearchResultItem[] = [];
    for (const trip of sourceRows) {
      const hybrid = hybridByTripId.get(trip.id);
      const item = buildScoredTrip(trip, intent, relaxed, policy, hybrid, geoOpts);
      if (!item) {
        if (rejectedSample.length < 12) {
          rejectedSample.push({
            tripId: trip.id,
            reasons: rejectionReasons(trip, intent, relaxed, policy, geoOpts),
          });
        }
        continue;
      }
      list.push(item);
    }
    list.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.tripId.localeCompare(b.tripId);
    });
    return list;
  };

  eligibleItems = tryScore(false);

  if (!eligibleItems.length && noDestinationMatch && policy.allowRelaxedAlternatives !== false) {
    relaxedAlternatives = true;
    eligibleItems = tryScore(true);
  }

  timings.scoring = Date.now() - tScoreStart;

  const rowsById = new Map(rows.map((r) => [r.id, r]));
  const tDivStart = Date.now();
  const diversified = reorderWithDiversity(rowsById, eligibleItems);
  const capped = diversified.slice(0, RANKED_CAP);
  timings.diversity = Date.now() - tDivStart;

  const tSlot = Date.now();
  const picks = pickCommercialSlots(capped, rowsById, COMMERCIAL_SCORE_TOLERANCE, intent, geoOpts);
  timings.slots = Date.now() - tSlot;

  const vague = validationIssues.some((i) => i.code === 'INTENT_TOO_VAGUE');
  const fallbackHints = buildFallbackHints(intent, stats, {
    noDestinationMatch,
    intentVague: vague,
  });

  const top = capped[0];
  const globalConfidence = top?.confidence ?? null;
  const matchState = globalStateFrom(
    top,
    validationIssues,
    capped.length === 0 || validationIssues.some((v) => v.severity === 'BLOCK'),
  );

  let recommendationRunId: string | null = null;

  const telemetryMid: RecommendationTelemetry = {
    timingsMs: { ...timings, total: Date.now() - t0 },
    counts: {
      catalogApproved: rows.length,
      retrievalPool: workingRows.length,
      afterHardFilters: eligibleItems.length,
      rankedCap: capped.length,
      geoPrefilterActive:
        params.options?.nonRelaxedCandidateRows != null &&
        params.options.nonRelaxedCandidateRows.length < rows.length,
    },
    retrieval: retrievalTelemetry,
    whyNotSample: rejectedSample,
  };

  const criteriaApplied = criteriaAppliedFromIntent(intent);
  const ib = intentSignalBreadth(criteriaApplied);
  const maxCriteriaSignals = 8;
  const intentCompleteness =
    Math.round((Math.min(ib, maxCriteriaSignals) / maxCriteriaSignals) * 1000) / 1000;
  const catalogEligibleRatio =
    rows.length > 0
      ? Math.round((Math.min(capped.length, rows.length) / rows.length) * 1000) / 1000
      : 0;

  const trustSummaryBlock = {
    intentSignalBreadth: ib,
    intentCompleteness,
    catalogTripCount: rows.length,
    catalogEligibleRatio,
    topMatchCoverageDimensions: top?.matchCoverageDimensions ?? null,
    topRawScoreIfAdjusted: top?.rawScore ?? null,
  };

  const premiumUx = buildTravelPremiumUx(intent, {
    criteriaApplied,
    matchState,
    globalConfidence,
    trustSummary: trustSummaryBlock,
    validationIssues,
    fallbackHints,
    relaxedAlternatives,
    ranked: capped,
    picks,
  });

  const responseBase: TravelSearchResponse = {
    schemaVersion: TRAVEL_SEARCH_SCHEMA_VERSION,
    criteriaApplied,
    matchState,
    globalConfidence,
    trustSummary: trustSummaryBlock,
    premiumUx,
    validationIssues,
    fallbackHints,
    relaxedAlternatives,
    ranked: capped,
    picks,
    totalCandidates: rows.length,
    scoringModelVersion: SCORING_MODEL_VERSION,
    recommendationRunId: null,
    debug: params.options?.telemetryVerbose
      ? {
          telemetry: telemetryMid as unknown as Record<string, unknown>,
          rejectedSample,
        }
      : undefined,
  };

  if (params.options?.persist) {
    const tp = Date.now();
    try {
      recommendationRunId = await persistRecommendationRun({
        companyId,
        intent,
        response: { ...responseBase, recommendationRunId: null },
        telemetry: telemetryMid,
        leadId: params.options.persist.leadId,
        userId: params.options.persist.userId,
      });
    } catch (e) {
      logger.warn({ err: e, companyId }, 'No se pudo persistir RecommendationRun');
    }
    timings.persistence = Date.now() - tp;
  }

  timings.total = Date.now() - t0;
  telemetryMid.timingsMs = { ...timings, total: timings.total };

  logger.info(
    {
      companyId,
      matchState,
      catalog: rows.length,
      eligible: eligibleItems.length,
      relaxedAlternatives,
      ms: timings.total,
      scoringModelVersion: SCORING_MODEL_VERSION,
    },
    'travelRecommendation pipeline',
  );

  return {
    response: { ...responseBase, recommendationRunId },
    telemetry: telemetryMid,
  };
}
