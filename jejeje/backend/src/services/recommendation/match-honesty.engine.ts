import type { RecommendationMatchState } from '@prisma/client';
import type { TravelSearchCriteriaApplied } from '../travel/travel-search.schema';
import type { ScoreBreakdown } from './scoring.engine';

/** Cuántas “señales” explícitas aportó el cliente (no confundir con dimensiones de scoring). */
export function intentSignalBreadth(criteria: TravelSearchCriteriaApplied): number {
  let n = 0;
  if (criteria.destination) n++;
  if (criteria.durationDays) n++;
  if (criteria.budgetPerPerson) n++;
  if (criteria.calendar) n++;
  if (criteria.travelers) n++;
  if (criteria.travelType) n++;
  if (criteria.tagsOrPreferences) n++;
  if (criteria.travelStyleAxes) n++;
  return n;
}

/** Factores con peso > 0 en el breakdown (p. ej. destino, duración, presupuesto…). */
export function scoringDimensionCount(bd: ScoreBreakdown): number {
  return bd.contributions.filter((c) => c.weight > 0).length;
}

export function isDossierOnlyBreakdown(bd: ScoreBreakdown): boolean {
  return bd.contributions.length === 1 && bd.contributions[0]?.factor === 'dossier_completeness';
}

export type HonestyAdjustment = {
  rawScore: number;
  score: number;
  confidence: number | null;
  intentSignalBreadth: number;
  matchCoverageDimensions: number;
  dossierOnly: boolean;
};

/**
 * Ajusta score/confidence cuando hay pocas dimensiones activas o la intención es muy fina,
 * para evitar STRONG_MATCH “artificial” con un solo factor (p. ej. solo ontología).
 */
export function adjustScoreAndConfidenceForHonesty(params: {
  score: number;
  confidence: number | null;
  relaxed: boolean;
  criteriaApplied: TravelSearchCriteriaApplied;
  bd: ScoreBreakdown;
}): HonestyAdjustment {
  const rawScore = params.score;
  const dossierOnly = isDossierOnlyBreakdown(params.bd);
  const breadth = intentSignalBreadth(params.criteriaApplied);
  const dims = scoringDimensionCount(params.bd);

  let score = rawScore;
  let confidence = params.confidence;

  if (params.relaxed || dossierOnly) {
    return {
      rawScore,
      score,
      confidence,
      intentSignalBreadth: breadth,
      matchCoverageDimensions: dims,
      dossierOnly,
    };
  }

  if (dims <= 1) {
    score = Math.min(score, 66);
    confidence = confidence != null ? Math.min(confidence, 0.52) : 0.42;
  } else if (dims === 2) {
    score = Math.min(score, 88);
    confidence = confidence != null ? Math.min(confidence, 0.88) : confidence;
  }

  if (breadth <= 1) {
    score = Math.min(score, 70);
    confidence = confidence != null ? confidence * 0.62 : 0.38;
  } else if (breadth === 2 && confidence != null) {
    confidence = Math.min(confidence, confidence * 0.92 + 0.02);
  }

  if (confidence != null) {
    confidence = Math.round(Math.min(1, Math.max(0, confidence)) * 1000) / 1000;
  }
  score = Math.round(Math.min(100, Math.max(0, score)));

  return {
    rawScore,
    score,
    confidence,
    intentSignalBreadth: breadth,
    matchCoverageDimensions: dims,
    dossierOnly,
  };
}

/** Estado por ítem coherente con la cobertura real de criterios (honestidad > marketing). */
export function deriveHonestItemMatchState(
  score: number,
  confidence: number | null,
  relaxed: boolean,
  adj: Pick<HonestyAdjustment, 'matchCoverageDimensions' | 'intentSignalBreadth' | 'dossierOnly'>,
): RecommendationMatchState {
  if (relaxed) return 'WEAK_MATCH';
  if (adj.dossierOnly) return 'WEAK_MATCH';

  const strongSignals = adj.intentSignalBreadth >= 2 && adj.matchCoverageDimensions >= 2;

  if (strongSignals && score >= 72 && (confidence ?? 0) >= 0.58) return 'STRONG_MATCH';
  if (score >= 44 || (confidence ?? 0) >= 0.42) return 'WEAK_MATCH';
  return 'NO_MATCH';
}
