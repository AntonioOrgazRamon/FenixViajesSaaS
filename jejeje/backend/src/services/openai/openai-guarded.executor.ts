/**
 * ÚNICO módulo que importa el SDK de OpenAI. El resto del código debe usar estas funciones.
 */
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { OpenAIOperationType, Prisma } from '@prisma/client';
import { config } from '../../common/config';
import { openAIUsageGuard, type GuardPreFlightInput } from './openai-usage-guard.service';
import { estimateTokensFromChatMessages, estimateTokensFromText } from './openai-pricing';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function guardedChatCompletion(params: {
  companyId: string;
  userId?: string | null;
  leadId?: string | null;
  operationType: OpenAIOperationType;
  model: string;
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  responseFormat?: { type: 'json_object' };
  /** Tokens de salida esperados (estimación pre-flight). */
  estimatedOutputTokens?: number;
  idempotencyKey?: string;
}): Promise<
  | { ok: true; content: string | null; requestId: string | null }
  | { ok: false; blocked: true; code: string; reason: string }
> {
  const estIn = estimateTokensFromChatMessages(params.messages as { content?: string }[]);
  const estOut = params.estimatedOutputTokens ?? 768;
  const preIn: GuardPreFlightInput = {
    companyId: params.companyId,
    userId: params.userId,
    leadId: params.leadId,
    operationType: params.operationType,
    model: params.model,
    estimatedInputTokens: estIn,
    estimatedOutputTokens: estOut,
    idempotencyKey: params.idempotencyKey,
  };

  const pre = await openAIUsageGuard.preFlight(preIn);
  if (!pre.allowed) {
    await openAIUsageGuard.logBlocked(preIn, pre.code, pre.reason);
    return { ok: false, blocked: true, code: pre.code, reason: pre.reason };
  }

  const client = new OpenAI({
    apiKey: config.OPENAI_API_KEY!,
    timeout: 120_000,
    maxRetries: 0,
  });

  const started = Date.now();
  let lastErr: unknown;
  const maxAttempts = 1 + config.OPENAI_GUARD_SDK_MAX_RETRIES;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const raw = await client.chat.completions.create({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature,
        response_format: params.responseFormat,
      });
      const usage = raw.usage;
      const durationMs = Date.now() - started;
      await openAIUsageGuard.logSuccess({
        companyId: params.companyId,
        userId: params.userId,
        operationType: params.operationType,
        model: params.model,
        inputTokens: usage?.prompt_tokens ?? estIn,
        outputTokens: usage?.completion_tokens ?? estOut,
        requestId: raw.id,
        durationMs,
      });
      const content = raw.choices[0]?.message?.content ?? null;
      return { ok: true, content, requestId: raw.id };
    } catch (e) {
      lastErr = e;
      if (attempt + 1 < maxAttempts) await sleep(350 * (attempt + 1));
    }
  }

  const durationMs = Date.now() - started;
  const code =
    lastErr && typeof lastErr === 'object' && 'code' in lastErr
      ? String((lastErr as { code?: string }).code ?? 'OPENAI_ERROR')
      : 'OPENAI_ERROR';
  await openAIUsageGuard.logError({
    companyId: params.companyId,
    userId: params.userId,
    operationType: params.operationType,
    model: params.model,
    inputTokens: estIn,
    outputTokens: 0,
    errorCode: code.slice(0, 64),
    durationMs,
    metadata: { message: lastErr instanceof Error ? lastErr.message : String(lastErr) } as Prisma.InputJsonValue,
  });
  throw lastErr;
}

export async function guardedEmbeddingCreate(params: {
  companyId: string;
  userId?: string | null;
  model: string;
  input: string | string[];
  dimensions?: number;
  timeoutMs?: number;
  contentHash?: string;
}): Promise<
  | { ok: true; embedding: number[]; requestId: string | null }
  | { ok: false; blocked: true; code: string; reason: string }
> {
  const inputs = Array.isArray(params.input) ? params.input : [params.input];
  const estIn = inputs.reduce((acc, s) => acc + estimateTokensFromText(s), 0);
  const preIn: GuardPreFlightInput = {
    companyId: params.companyId,
    userId: params.userId,
    operationType: OpenAIOperationType.EMBEDDING,
    model: params.model,
    estimatedInputTokens: Math.max(1, estIn),
    estimatedOutputTokens: 0,
    idempotencyKey: params.contentHash,
    embeddingBatchSize: inputs.length,
  };

  const pre = await openAIUsageGuard.preFlight(preIn);
  if (!pre.allowed) {
    await openAIUsageGuard.logBlocked(preIn, pre.code, pre.reason);
    return { ok: false, blocked: true, code: pre.code, reason: pre.reason };
  }

  const client = new OpenAI({
    apiKey: config.OPENAI_API_KEY!,
    timeout: params.timeoutMs ?? config.TRAVEL_EMBEDDING_TIMEOUT_MS,
    maxRetries: 0,
  });

  const body: OpenAI.Embeddings.EmbeddingCreateParams = {
    model: params.model,
    input: inputs.length === 1 ? inputs[0]!.slice(0, 30000) : inputs.map((s) => s.slice(0, 30000)),
  };
  if (params.dimensions != null) {
    body.dimensions = params.dimensions;
  }

  const started = Date.now();
  let lastErr: unknown;
  const maxAttempts = 1 + config.OPENAI_GUARD_SDK_MAX_RETRIES;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const raw = await client.embeddings.create(body);
      const vec = raw.data[0]?.embedding;
      if (!vec?.length) throw new Error('empty_embedding');
      const usage = raw.usage;
      const durationMs = Date.now() - started;
      await openAIUsageGuard.logSuccess({
        companyId: params.companyId,
        userId: params.userId,
        operationType: OpenAIOperationType.EMBEDDING,
        model: params.model,
        inputTokens: usage?.prompt_tokens ?? estIn,
        outputTokens: 0,
        requestId: undefined,
        durationMs,
      });
      return { ok: true, embedding: vec, requestId: null };
    } catch (e) {
      lastErr = e;
      if (attempt + 1 < maxAttempts) await sleep(400 * (attempt + 1));
    }
  }

  const durationMs = Date.now() - started;
  await openAIUsageGuard.logError({
    companyId: params.companyId,
    userId: params.userId,
    operationType: OpenAIOperationType.EMBEDDING,
    model: params.model,
    inputTokens: estIn,
    outputTokens: 0,
    errorCode: 'EMBEDDING_FAILED',
    durationMs,
    metadata: { message: lastErr instanceof Error ? lastErr.message : String(lastErr) } as Prisma.InputJsonValue,
  });
  throw lastErr;
}
