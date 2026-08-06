import {
  LeadActorType,
  LeadActivityType,
  OpenAIOperationType,
  OpenAIUsageLogStatus,
  Prisma,
} from '@prisma/client';
import prisma from '../../infrastructure/db';
import { config } from '../../common/config';
import { logger } from '../../common/logger';
import { estimateChatCostEuros, estimateEmbeddingCostEuros } from './openai-pricing';
import { openAiRateLimiter } from './openai-usage-rate-limit';

export type GuardPreFlightInput = {
  companyId: string;
  userId?: string | null;
  leadId?: string | null;
  operationType: OpenAIOperationType;
  model: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  idempotencyKey?: string;
  /** Para embeddings con varios inputs en una petición. */
  embeddingBatchSize?: number;
};

export type GuardPreFlightResult =
  | { allowed: true; estimatedCostEuros: number }
  | { allowed: false; code: string; reason: string };

const idempotencyHits = new Map<string, number>();
const leadCooldownUntil = new Map<string, number>();
const budgetRowCache = new Map<string, { at: number; row: Awaited<ReturnType<typeof fetchBudgetRow>> }>();
const alertLevelByCompanyDay = new Map<string, number>();

const BUDGET_CACHE_MS = 60_000;

export function invalidateOpenAiBudgetCache(companyId: string): void {
  budgetRowCache.delete(companyId);
}

async function fetchBudgetRow(companyId: string) {
  return prisma.openAIUsageBudget.findUnique({ where: { companyId } });
}

async function getDbKillSwitch(): Promise<boolean> {
  try {
    const row = await prisma.openAISystemState.findUnique({ where: { id: 'default' } });
    return row?.globalKillSwitch === true;
  } catch (e) {
    logger.warn(e, 'openai-guard: no se pudo leer openai_system_state');
    return false;
  }
}

function opFeatureEnabled(operationType: OpenAIOperationType): boolean {
  if (!config.OPENAI_ENABLED) return false;
  switch (operationType) {
    case OpenAIOperationType.INTENT_EXTRACTION:
      return config.OPENAI_INTENT_ENABLED;
    case OpenAIOperationType.PROPOSAL_COPY:
      return config.OPENAI_COPY_ENABLED;
    case OpenAIOperationType.EMBEDDING:
      return config.OPENAI_EMBEDDINGS_ENABLED;
    case OpenAIOperationType.TRIP_PDF_EXTRACTION:
      return config.OPENAI_PDF_EXTRACTION_ENABLED;
    default:
      return true;
  }
}

function effectiveOpDailyCapEuros(operationType: OpenAIOperationType, companyDefault: number): number {
  const v =
    operationType === OpenAIOperationType.INTENT_EXTRACTION
      ? config.OPENAI_OP_INTENT_MAX_DAILY_EUROS
      : operationType === OpenAIOperationType.PROPOSAL_COPY
        ? config.OPENAI_OP_COPY_MAX_DAILY_EUROS
        : operationType === OpenAIOperationType.EMBEDDING
          ? config.OPENAI_OP_EMBEDDING_MAX_DAILY_EUROS
          : operationType === OpenAIOperationType.TRIP_PDF_EXTRACTION
            ? config.OPENAI_OP_PDF_AI_MAX_DAILY_EUROS
            : undefined;
  return v ?? companyDefault;
}

function utcDayStart(d = new Date()): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  return x;
}

function utcMonthStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

async function sumCostEuros(where: Prisma.OpenAIUsageLogWhereInput): Promise<number> {
  const agg = await prisma.openAIUsageLog.aggregate({
    where: { ...where, status: OpenAIUsageLogStatus.SUCCESS },
    _sum: { estimatedCost: true },
  });
  const v = agg._sum.estimatedCost;
  return v != null ? Number(v) : 0;
}

async function countSuccess(where: Prisma.OpenAIUsageLogWhereInput): Promise<number> {
  return prisma.openAIUsageLog.count({
    where: { ...where, status: OpenAIUsageLogStatus.SUCCESS },
  });
}

function projectionCostEuros(input: GuardPreFlightInput): number {
  if (input.operationType === OpenAIOperationType.EMBEDDING) {
    return estimateEmbeddingCostEuros(input.model, input.estimatedInputTokens);
  }
  return estimateChatCostEuros(input.model, input.estimatedInputTokens, input.estimatedOutputTokens);
}

async function maybeLeadActivityBlock(
  companyId: string,
  leadId: string | null | undefined,
  reason: string,
  code: string,
  operationType: OpenAIOperationType,
) {
  if (!leadId) return;
  try {
    await prisma.leadActivity.create({
      data: {
        companyId,
        leadId,
        actorType: LeadActorType.SYSTEM,
        activityType: LeadActivityType.EXTERNAL_EVENT,
        title: 'Uso de OpenAI bloqueado (presupuesto / política)',
        description: `${code}: ${reason}`.slice(0, 2000),
        metadata: { openaiGuard: true, code, operationType } as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    logger.warn(e, 'openai-guard: no se pudo crear LeadActivity de bloqueo');
  }
}

function maybeThresholdAlert(companyId: string, spent: number, cap: number, context: string) {
  if (cap <= 0 || !Number.isFinite(spent)) return;
  const pct = (spent / cap) * 100;
  const day = utcDayStart().toISOString().slice(0, 10);
  const key = `${companyId}:${day}`;
  let level = alertLevelByCompanyDay.get(key) ?? 0;
  const thresholds = [50, 80, 100] as const;
  for (const t of thresholds) {
    if (pct >= t && level < t) {
      alertLevelByCompanyDay.set(key, t);
      level = t;
      const payload = { companyId, context, spentEur: spent, capEur: cap, pct: Math.round(pct), threshold: t };
      if (t === 100) logger.error(payload, 'OPENAI_ALERT: presupuesto diario tenant alcanzado');
      else if (t >= 80) logger.warn(payload, 'OPENAI_ALERT: presupuesto diario tenant ≥80%');
      else logger.warn(payload, 'OPENAI_ALERT: presupuesto diario tenant ≥50%');
    }
  }
}

export class OpenAIUsageGuard {
  async preFlight(input: GuardPreFlightInput): Promise<GuardPreFlightResult> {
    const estCost = projectionCostEuros(input);

    if (config.OPENAI_GLOBAL_KILL_SWITCH || (await getDbKillSwitch())) {
      return { allowed: false, code: 'KILL_SWITCH', reason: 'Kill switch global activo (env o BD).' };
    }

    if (!config.OPENAI_ENABLED) {
      return { allowed: false, code: 'OPENAI_DISABLED', reason: 'OPENAI_ENABLED=false.' };
    }

    if (!opFeatureEnabled(input.operationType)) {
      return {
        allowed: false,
        code: 'OPERATION_DISABLED',
        reason: `Operación ${input.operationType} desactivada por feature flag.`,
      };
    }

    const apiKey = config.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return { allowed: false, code: 'NO_API_KEY', reason: 'OPENAI_API_KEY no configurada.' };
    }

    const now = Date.now();

    if (input.leadId) {
      const lk = `${input.leadId}:${input.operationType}`;
      const until = leadCooldownUntil.get(lk) ?? 0;
      if (until > now) {
        return { allowed: false, code: 'LEAD_COOLDOWN', reason: 'Cooldown activo para este lead y operación.' };
      }
    }

    let budgetRow: Awaited<ReturnType<typeof fetchBudgetRow>> = null;
    const c = budgetRowCache.get(input.companyId);
    if (c && now - c.at < BUDGET_CACHE_MS) {
      budgetRow = c.row;
    } else {
      budgetRow = await fetchBudgetRow(input.companyId);
      budgetRowCache.set(input.companyId, { at: now, row: budgetRow });
    }

    if (budgetRow?.hardBlocked) {
      return { allowed: false, code: 'TENANT_HARDBLOCK', reason: 'Empresa bloqueada para OpenAI (BD).' };
    }
    if (budgetRow && !budgetRow.isEnabled) {
      return { allowed: false, code: 'TENANT_DISABLED', reason: 'Presupuesto OpenAI deshabilitado para la empresa.' };
    }

    const maxTokEnv = config.OPENAI_MAX_TOKENS_PER_REQUEST;
    const maxTok = Math.min(maxTokEnv, budgetRow?.maxTokensPerRequest ?? maxTokEnv);
    const totalTokEst = input.estimatedInputTokens + input.estimatedOutputTokens;
    if (totalTokEst > maxTok) {
      return {
        allowed: false,
        code: 'MAX_TOKENS_ESTIMATE',
        reason: `Estimación ${totalTokEst} tokens supera límite ${maxTok}.`,
      };
    }

    if (
      input.operationType === OpenAIOperationType.EMBEDDING &&
      (input.embeddingBatchSize ?? 1) > config.OPENAI_MAX_EMBEDDING_BATCH_ITEMS
    ) {
      return {
        allowed: false,
        code: 'EMBEDDING_BATCH',
        reason: `Lote embeddings > ${config.OPENAI_MAX_EMBEDDING_BATCH_ITEMS}.`,
      };
    }

    const companyDailyCap =
      budgetRow?.dailyLimitEuros != null
        ? Number(budgetRow.dailyLimitEuros)
        : config.OPENAI_MAX_DAILY_EUROS_PER_COMPANY;
    const companyMonthlyCap =
      budgetRow?.monthlyLimitEuros != null
        ? Number(budgetRow.monthlyLimitEuros)
        : config.OPENAI_MAX_MONTHLY_EUROS_PER_COMPANY;

    const opDailyCap = effectiveOpDailyCapEuros(input.operationType, companyDailyCap);

    const dayStart = utcDayStart();
    const monthStart = utcMonthStart();

    const [globalDay, globalMonth, companyDay, companyMonth, opDay, userDay] = await Promise.all([
      sumCostEuros({ createdAt: { gte: dayStart } }),
      sumCostEuros({ createdAt: { gte: monthStart } }),
      sumCostEuros({ companyId: input.companyId, createdAt: { gte: dayStart } }),
      sumCostEuros({ companyId: input.companyId, createdAt: { gte: monthStart } }),
      sumCostEuros({
        companyId: input.companyId,
        operationType: input.operationType,
        createdAt: { gte: dayStart },
      }),
      input.userId
        ? sumCostEuros({
            companyId: input.companyId,
            userId: input.userId,
            createdAt: { gte: dayStart },
          })
        : Promise.resolve(0),
    ]);

    const userDailyCap =
      budgetRow?.userDailyLimitEuros != null
        ? Number(budgetRow.userDailyLimitEuros)
        : config.OPENAI_USER_MAX_DAILY_EUROS;

    if (globalDay + estCost > config.OPENAI_GLOBAL_MAX_DAILY_EUROS) {
      return { allowed: false, code: 'GLOBAL_DAILY_CAP', reason: 'Tope diario global OpenAI (€).' };
    }
    if (globalMonth + estCost > config.OPENAI_GLOBAL_MAX_MONTHLY_EUROS) {
      return { allowed: false, code: 'GLOBAL_MONTHLY_CAP', reason: 'Tope mensual global OpenAI (€).' };
    }
    if (companyDay + estCost > companyDailyCap) {
      return { allowed: false, code: 'COMPANY_DAILY_CAP', reason: 'Tope diario de empresa alcanzado.' };
    }
    if (companyMonth + estCost > companyMonthlyCap) {
      return { allowed: false, code: 'COMPANY_MONTHLY_CAP', reason: 'Tope mensual de empresa alcanzado.' };
    }
    if (opDay + estCost > opDailyCap) {
      return { allowed: false, code: 'OPERATION_DAILY_CAP', reason: 'Tope diario para este tipo de operación.' };
    }
    if (input.userId && userDay + estCost > userDailyCap) {
      return { allowed: false, code: 'USER_DAILY_CAP', reason: 'Tope diario de usuario alcanzado.' };
    }

    if (input.operationType === OpenAIOperationType.TRIP_PDF_EXTRACTION && config.OPENAI_MAX_PDF_AI_CALLS_PER_DAY_PER_COMPANY > 0) {
      const pdfToday = await countSuccess({
        companyId: input.companyId,
        operationType: OpenAIOperationType.TRIP_PDF_EXTRACTION,
        createdAt: { gte: dayStart },
      });
      if (pdfToday >= config.OPENAI_MAX_PDF_AI_CALLS_PER_DAY_PER_COMPANY) {
        return {
          allowed: false,
          code: 'PDF_AI_DAILY_COUNT',
          reason: 'Máximo de extracciones IA por PDF/día para la empresa.',
        };
      }
    }

    if (input.operationType === OpenAIOperationType.PROPOSAL_COPY) {
      const hourAgo = new Date(Date.now() - 3_600_000);
      const copyHour = await countSuccess({
        companyId: input.companyId,
        operationType: OpenAIOperationType.PROPOSAL_COPY,
        createdAt: { gte: hourAgo },
      });
      const proposalCap = Math.min(
        config.OPENAI_MAX_PROPOSAL_COPY_CALLS_PER_HOUR_PER_COMPANY,
        budgetRow?.maxCallsPerHour ?? Number.MAX_SAFE_INTEGER,
      );
      if (copyHour >= proposalCap) {
        return { allowed: false, code: 'PROPOSAL_COPY_HOURLY', reason: 'Límite horario de copy IA (propuestas).' };
      }
    }

    const perMinCompany = `c:${input.companyId}:min`;
    const perHourCompany = `c:${input.companyId}:hour`;
    const perMinUser = input.userId ? `u:${input.userId}:min` : null;

    const maxPerMin = config.OPENAI_MAX_CALLS_PER_MINUTE_PER_COMPANY;
    const maxPerHour = budgetRow?.maxCallsPerHour ?? config.OPENAI_MAX_CALLS_PER_HOUR_PER_COMPANY;

    if (!openAiRateLimiter.tryConsume(perMinCompany, 60_000, maxPerMin, now)) {
      return { allowed: false, code: 'RATE_COMPANY_MINUTE', reason: 'Demasiadas llamadas OpenAI / min (empresa).' };
    }
    if (!openAiRateLimiter.tryConsume(perHourCompany, 3_600_000, maxPerHour, now)) {
      return { allowed: false, code: 'RATE_COMPANY_HOUR', reason: 'Demasiadas llamadas OpenAI / hora (empresa).' };
    }
    if (perMinUser && !openAiRateLimiter.tryConsume(perMinUser, 60_000, config.OPENAI_MAX_CALLS_PER_MINUTE_PER_USER, now)) {
      return { allowed: false, code: 'RATE_USER_MINUTE', reason: 'Demasiadas llamadas OpenAI / min (usuario).' };
    }

    maybeThresholdAlert(input.companyId, companyDay + estCost, companyDailyCap, 'tenant_daily');
    maybeThresholdAlert('__global__', globalDay + estCost, config.OPENAI_GLOBAL_MAX_DAILY_EUROS, 'global_daily');

    if (input.idempotencyKey) {
      const ik = `${input.companyId}:${input.operationType}:${input.idempotencyKey}`;
      const prev = idempotencyHits.get(ik);
      if (prev != null && now - prev < config.OPENAI_IDEMPOTENCY_TTL_MS) {
        return { allowed: false, code: 'IDEMPOTENCY', reason: 'Petición equivalente reciente (debounce).' };
      }
      idempotencyHits.set(ik, now);
    }

    if (input.leadId && config.OPENAI_LEAD_OP_COOLDOWN_MS > 0) {
      leadCooldownUntil.set(
        `${input.leadId}:${input.operationType}`,
        now + config.OPENAI_LEAD_OP_COOLDOWN_MS,
      );
    }

    return { allowed: true, estimatedCostEuros: estCost };
  }

  async logBlocked(
    input: GuardPreFlightInput,
    code: string,
    reason: string,
  ): Promise<void> {
    await prisma.openAIUsageLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId ?? undefined,
        operationType: input.operationType,
        model: input.model,
        inputTokens: input.estimatedInputTokens,
        outputTokens: input.estimatedOutputTokens,
        totalTokens: input.estimatedInputTokens + input.estimatedOutputTokens,
        estimatedCost: null,
        status: OpenAIUsageLogStatus.BLOCKED,
        errorCode: code,
        metadata: { reason, guard: true } as Prisma.InputJsonValue,
      },
    });
    logger.warn(
      { companyId: input.companyId, operationType: input.operationType, code, reason },
      'openai-guard: bloqueado',
    );
    await maybeLeadActivityBlock(input.companyId, input.leadId, reason, code, input.operationType);
  }

  async logSuccess(params: {
    companyId: string;
    userId?: string | null;
    leadId?: string | null;
    operationType: OpenAIOperationType;
    model: string;
    inputTokens: number;
    outputTokens: number;
    requestId?: string | null;
    durationMs: number;
  }): Promise<void> {
    const estimatedCost =
      params.operationType === OpenAIOperationType.EMBEDDING
        ? estimateEmbeddingCostEuros(params.model, params.inputTokens)
        : estimateChatCostEuros(params.model, params.inputTokens, params.outputTokens);

    await prisma.openAIUsageLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId ?? undefined,
        operationType: params.operationType,
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        totalTokens: params.inputTokens + params.outputTokens,
        estimatedCost,
        requestId: params.requestId ?? undefined,
        status: OpenAIUsageLogStatus.SUCCESS,
        durationMs: params.durationMs,
      },
    });
  }

  async logError(params: {
    companyId: string;
    userId?: string | null;
    operationType: OpenAIOperationType;
    model: string;
    inputTokens: number;
    outputTokens: number;
    errorCode: string;
    durationMs: number;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await prisma.openAIUsageLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId ?? undefined,
        operationType: params.operationType,
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        totalTokens: params.inputTokens + params.outputTokens,
        status: OpenAIUsageLogStatus.ERROR,
        errorCode: params.errorCode,
        durationMs: params.durationMs,
        metadata: params.metadata,
      },
    });
  }
}

export const openAIUsageGuard = new OpenAIUsageGuard();
