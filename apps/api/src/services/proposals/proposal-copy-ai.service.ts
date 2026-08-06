import { createHash } from 'crypto';
import { OpenAIOperationType } from '@prisma/client';
import { config } from '../../common/config';
import { guardedChatCompletion } from '../openai/openai-guarded.executor';

export type ProposalAiCopy = {
  commercialIntro: string;
  recommendationBullets: string[];
  nextStep: string;
};

const SYSTEM = `Eres redactor comercial de una agencia de viajes B2C/B2B (español neutro).
Devuelves SOLO JSON válido con las claves: commercialIntro (string breve), recommendationBullets (array de 3-6 strings cortos), nextStep (string con llamada a la acción).
Sin markdown, sin comillas tipográficas, sin emojis.`;

export async function generateProposalCommercialCopy(params: {
  companyId: string;
  userId?: string | null;
  leadId?: string | null;
  companyName: string;
  clientSummary: string;
  intentSummary: string;
  tripTitles: { recommended: string; budget: string; luxury: string; alternative: string };
  deterministicReasons: string[];
  alignmentMatches: string[];
  alignmentGaps: string[];
}): Promise<ProposalAiCopy | null> {
  const user = JSON.stringify({
    companyName: params.companyName,
    clientSummary: params.clientSummary,
    intentSummary: params.intentSummary,
    tripTitles: params.tripTitles,
    deterministicReasons: params.deterministicReasons,
    alignmentMatches: params.alignmentMatches,
    alignmentGaps: params.alignmentGaps,
  });

  const idempotencyKey = createHash('sha256').update(user).digest('hex').slice(0, 48);

  const completion = await guardedChatCompletion({
    companyId: params.companyId,
    userId: params.userId,
    leadId: params.leadId,
    operationType: OpenAIOperationType.PROPOSAL_COPY,
    model: config.TRAVEL_OPENAI_MODEL,
    temperature: 0.45,
    responseFormat: { type: 'json_object' },
    estimatedOutputTokens: 640,
    idempotencyKey,
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Genera copy para una propuesta HTML ya maquetada. Contexto JSON:\n${user}`,
      },
    ],
  });

  if (!completion.ok) {
    return null;
  }

  const raw = completion.content;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ProposalAiCopy>;
    if (
      typeof parsed.commercialIntro !== 'string' ||
      !Array.isArray(parsed.recommendationBullets) ||
      typeof parsed.nextStep !== 'string'
    ) {
      return null;
    }
    return {
      commercialIntro: parsed.commercialIntro.trim(),
      recommendationBullets: parsed.recommendationBullets
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 8),
      nextStep: parsed.nextStep.trim(),
    };
  } catch {
    return null;
  }
}
