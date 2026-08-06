import { config } from '../../../common/config';
import { logger } from '../../../common/logger';
import { guardedEmbeddingCreate } from '../../openai/openai-guarded.executor';

const embeddingCache = new Map<string, number[]>();
const MAX_CACHE = 2000;

function cacheGet(key: string): number[] | undefined {
  return embeddingCache.get(key);
}

function cacheSet(key: string, vec: number[]): void {
  if (embeddingCache.size >= MAX_CACHE && !embeddingCache.has(key)) {
    const first = embeddingCache.keys().next().value;
    if (first) embeddingCache.delete(first);
  }
  embeddingCache.set(key, vec);
}

/**
 * OpenAI embeddings con caché por hash. Toda llamada remota pasa por OpenAIUsageGuard.
 */
export class EmbeddingService {
  async embedText(
    content: string,
    contentHash: string,
    context: { companyId: string; userId?: string | null },
  ): Promise<{ vector: number[]; dims: number; model: string }> {
    const cached = cacheGet(contentHash);
    if (cached) {
      return { vector: cached, dims: cached.length, model: config.TRAVEL_EMBEDDING_MODEL };
    }

    const res = await guardedEmbeddingCreate({
      companyId: context.companyId,
      userId: context.userId,
      model: config.TRAVEL_EMBEDDING_MODEL,
      input: content.slice(0, 30000),
      dimensions: config.TRAVEL_EMBEDDING_DIMS,
      timeoutMs: config.TRAVEL_EMBEDDING_TIMEOUT_MS,
      contentHash,
    });

    if (!res.ok) {
      throw new Error(`Embedding bloqueado o denegado: ${res.code} — ${res.reason}`);
    }

    const vec = res.embedding;
    const dims = vec.length;
    if (config.TRAVEL_EMBEDDING_DIMS != null && dims !== config.TRAVEL_EMBEDDING_DIMS) {
      logger.warn({ dims, expected: config.TRAVEL_EMBEDDING_DIMS }, 'dims embedding distinto al configurado');
    }

    cacheSet(contentHash, vec);
    return { vector: vec, dims, model: config.TRAVEL_EMBEDDING_MODEL };
  }
}

export const embeddingService = new EmbeddingService();
