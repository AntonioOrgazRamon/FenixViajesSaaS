import { v4 as uuidv4 } from 'uuid';
import {
  OpenAIUsageLogStatus,
  type OpenAIOperationType,
  type Prisma,
} from '@prisma/client';
import prisma from '../../infrastructure/db';
import { config } from '../../common/config';

export type OpenAiUsageQuery = {
  companyId?: string;
  operationType?: OpenAIOperationType;
  status?: OpenAIUsageLogStatus;
  take: number;
  skip: number;
  since?: Date;
};

export async function listUsageLogs(q: OpenAiUsageQuery) {
  return prisma.openAIUsageLog.findMany({
    where: {
      ...(q.companyId ? { companyId: q.companyId } : {}),
      ...(q.operationType ? { operationType: q.operationType } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.since ? { createdAt: { gte: q.since } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: q.take,
    skip: q.skip,
  });
}

export async function getBudgetForCompany(companyId: string) {
  return prisma.openAIUsageBudget.findUnique({ where: { companyId } });
}

export async function upsertCompanyBudget(
  companyId: string,
  patch: {
    dailyLimitEuros?: number | null;
    monthlyLimitEuros?: number | null;
    maxCallsPerHour?: number | null;
    maxTokensPerRequest?: number | null;
    userDailyLimitEuros?: number | null;
    isEnabled?: boolean;
    hardBlocked?: boolean;
  },
) {
  const data: Prisma.OpenAIUsageBudgetUncheckedUpdateInput = {};

  if ('dailyLimitEuros' in patch) {
    data.dailyLimitEuros = patch.dailyLimitEuros ?? null;
  }
  if ('monthlyLimitEuros' in patch) {
    data.monthlyLimitEuros = patch.monthlyLimitEuros ?? null;
  }
  if ('maxCallsPerHour' in patch) {
    data.maxCallsPerHour = patch.maxCallsPerHour ?? null;
  }
  if ('maxTokensPerRequest' in patch) {
    data.maxTokensPerRequest = patch.maxTokensPerRequest ?? null;
  }
  if ('userDailyLimitEuros' in patch) {
    data.userDailyLimitEuros = patch.userDailyLimitEuros ?? null;
  }
  if (patch.isEnabled !== undefined) data.isEnabled = patch.isEnabled;
  if (patch.hardBlocked !== undefined) data.hardBlocked = patch.hardBlocked;

  const existing = await prisma.openAIUsageBudget.findUnique({ where: { companyId } });
  if (!existing) {
    return prisma.openAIUsageBudget.create({
      data: {
        id: uuidv4(),
        companyId,
        dailyLimitEuros: patch.dailyLimitEuros ?? null,
        monthlyLimitEuros: patch.monthlyLimitEuros ?? null,
        maxCallsPerHour: patch.maxCallsPerHour ?? null,
        maxTokensPerRequest: patch.maxTokensPerRequest ?? null,
        userDailyLimitEuros: patch.userDailyLimitEuros ?? null,
        isEnabled: patch.isEnabled ?? true,
        hardBlocked: patch.hardBlocked ?? false,
      },
    });
  }

  return prisma.openAIUsageBudget.update({
    where: { companyId },
    data,
  });
}

export async function setDbKillSwitch(active: boolean) {
  return prisma.openAISystemState.update({
    where: { id: 'default' },
    data: { globalKillSwitch: active },
  });
}

export async function getOpenAiSystemState() {
  return prisma.openAISystemState.findUnique({ where: { id: 'default' } });
}

export async function listRecentAlerts(take: number) {
  return prisma.openAIUsageLog.findMany({
    where: {
      OR: [{ status: OpenAIUsageLogStatus.BLOCKED }, { status: OpenAIUsageLogStatus.ERROR }],
    },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export function summarizeEnvKillSwitch() {
  return {
    envKillSwitch: config.OPENAI_GLOBAL_KILL_SWITCH,
    openaiEnabled: config.OPENAI_ENABLED,
    intent: config.OPENAI_INTENT_ENABLED,
    copy: config.OPENAI_COPY_ENABLED,
    embeddings: config.OPENAI_EMBEDDINGS_ENABLED,
    pdfExtraction: config.OPENAI_PDF_EXTRACTION_ENABLED,
    globalDailyEurosCap: config.OPENAI_GLOBAL_MAX_DAILY_EUROS,
    globalMonthlyEurosCap: config.OPENAI_GLOBAL_MAX_MONTHLY_EUROS,
    defaultCompanyDailyEurosCap: config.OPENAI_MAX_DAILY_EUROS_PER_COMPANY,
  };
}
