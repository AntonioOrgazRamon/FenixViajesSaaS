import { v4 as uuidv4 } from 'uuid';
import type { CommercialSlotKind, Prisma } from '@prisma/client';
import prisma from '../../infrastructure/db';
import type { TravelSearchIntent, TravelSearchResponse } from '../travel/travel-search.schema';
import type { RecommendationTelemetry } from './types';

function slotForTripId(
  tripId: string,
  picks: TravelSearchResponse['picks'],
): CommercialSlotKind | null {
  if (picks.recommended?.tripId === tripId) return 'RECOMMENDED';
  if (picks.budget?.tripId === tripId) return 'BUDGET';
  if (picks.luxury?.tripId === tripId) return 'LUXURY';
  if (picks.alternative?.tripId === tripId) return 'ALTERNATIVE';
  return null;
}

export async function persistRecommendationRun(params: {
  companyId: string;
  intent: TravelSearchIntent;
  response: TravelSearchResponse;
  telemetry: RecommendationTelemetry;
  leadId?: string;
  userId?: string;
}): Promise<string> {
  const runId = uuidv4();
  const { response } = params;
  const items = response.ranked.slice(0, 50).map((r, idx) => ({
    id: uuidv4(),
    companyId: params.companyId,
    runId,
    travelTripId: r.tripId,
    rankIndex: idx,
    commercialSlot: slotForTripId(r.tripId, response.picks),
    finalScore: r.score,
    matchState: r.matchState,
    contributions: r.contributions as unknown as Prisma.InputJsonValue,
    diversityPenalty: null,
    explainability: {
      commercialAngle: r.commercialAngle,
      matches: r.matches,
      misses: r.misses,
      confidence: r.confidence,
      relaxedAlternative: r.relaxedAlternative ?? false,
      retrievalProvenance: r.retrievalProvenance ?? null,
    } as Prisma.InputJsonValue,
  }));

  await prisma.$transaction([
    prisma.recommendationRun.create({
      data: {
        id: runId,
        companyId: params.companyId,
        leadId: params.leadId,
        createdByUserId: params.userId,
        intentSnapshot: params.intent as Prisma.InputJsonValue,
        scoringModelVersion: response.scoringModelVersion,
        matchState: response.matchState,
        globalConfidence: response.globalConfidence,
        validationSummary: response.validationIssues as unknown as Prisma.InputJsonValue,
        fallbackHints: response.fallbackHints as unknown as Prisma.InputJsonValue,
        telemetry: params.telemetry as unknown as Prisma.InputJsonValue,
        catalogCandidateCount: response.totalCandidates,
        retrievalSummary: params.telemetry.retrieval
          ? (params.telemetry.retrieval as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    }),
    prisma.recommendationItem.createMany({ data: items }),
  ]);

  return runId;
}

export async function getRecommendationRunForTenant(runId: string, companyId: string) {
  return prisma.recommendationRun.findFirst({
    where: { id: runId, companyId },
    include: {
      items: { orderBy: { rankIndex: 'asc' }, take: 80 },
    },
  });
}
