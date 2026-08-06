import { config } from '../../common/config';
import { logger } from '../../common/logger';

/** Precios referencia USD por 1M tokens (entrada / salida / embedding). */
export type ModelPricingUsd = {
  inputPer1M: number;
  outputPer1M: number;
  embeddingPer1M: number;
};

/** Modelo no listado: conservador (sobreestima coste). */
export const CONSERVATIVE_UNKNOWN_MODEL_USD: ModelPricingUsd = {
  inputPer1M: 30,
  outputPer1M: 90,
  embeddingPer1M: 0.5,
};

const BASE_TABLE: Record<string, ModelPricingUsd> = {
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6, embeddingPer1M: 0 },
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10, embeddingPer1M: 0 },
  'gpt-4-turbo': { inputPer1M: 10, outputPer1M: 30, embeddingPer1M: 0 },
  'text-embedding-3-small': { inputPer1M: 0, outputPer1M: 0, embeddingPer1M: 0.02 },
  'text-embedding-3-large': { inputPer1M: 0, outputPer1M: 0, embeddingPer1M: 0.13 },
  'text-embedding-ada-002': { inputPer1M: 0, outputPer1M: 0, embeddingPer1M: 0.1 },
};

let mergedTable: Record<string, ModelPricingUsd> | null = null;

function loadMergedTable(): Record<string, ModelPricingUsd> {
  if (mergedTable) return mergedTable;
  mergedTable = { ...BASE_TABLE };
  const raw = config.OPENAI_MODEL_PRICING_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<
        string,
        { inputPer1MUsd?: number; outputPer1MUsd?: number; embeddingPer1MUsd?: number }
      >;
      for (const [k, v] of Object.entries(parsed)) {
        if (!v || typeof v !== 'object') continue;
        mergedTable[k] = {
          inputPer1M: typeof v.inputPer1MUsd === 'number' ? v.inputPer1MUsd : 0,
          outputPer1M: typeof v.outputPer1MUsd === 'number' ? v.outputPer1MUsd : 0,
          embeddingPer1M: typeof v.embeddingPer1MUsd === 'number' ? v.embeddingPer1MUsd : 0,
        };
      }
    } catch (e) {
      logger.error(e, 'OPENAI_MODEL_PRICING_JSON inválido; se usa tabla base');
    }
  }
  return mergedTable;
}

export function getPricingForModel(model: string): { pricing: ModelPricingUsd; known: boolean } {
  const t = loadMergedTable();
  const hit = t[model];
  if (hit) return { pricing: hit, known: true };
  logger.warn({ model }, 'openai-pricing: modelo sin tabla; precio conservador');
  return { pricing: CONSERVATIVE_UNKNOWN_MODEL_USD, known: false };
}

export function estimateChatCostEuros(model: string, inputTokens: number, outputTokens: number): number {
  const { pricing } = getPricingForModel(model);
  const usd =
    (inputTokens / 1_000_000) * pricing.inputPer1M + (outputTokens / 1_000_000) * pricing.outputPer1M;
  return usd * config.OPENAI_USD_TO_EUR_RATE;
}

export function estimateEmbeddingCostEuros(model: string, inputTokens: number): number {
  const { pricing } = getPricingForModel(model);
  const usd = (inputTokens / 1_000_000) * pricing.embeddingPer1M;
  return usd * config.OPENAI_USD_TO_EUR_RATE;
}

/** Heurística rápida ~4 chars/token para textos latinos. */
export function estimateTokensFromText(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateTokensFromChatMessages(messages: { content?: string | null }[]): number {
  let n = 0;
  for (const m of messages) {
    if (typeof m.content === 'string') n += estimateTokensFromText(m.content);
  }
  return Math.max(1, n);
}
