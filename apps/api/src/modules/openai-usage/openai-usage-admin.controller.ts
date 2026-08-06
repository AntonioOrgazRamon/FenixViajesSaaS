import { Request, Response } from 'express';
import { z } from 'zod';
import {
  OpenAIOperationType,
  OpenAIUsageLogStatus,
} from '@prisma/client';
import prisma from '../../infrastructure/db';
import { ValidationError } from '../../common/errors/AppError';
import {
  getBudgetForCompany,
  getOpenAiSystemState,
  listRecentAlerts,
  listUsageLogs,
  setDbKillSwitch,
  summarizeEnvKillSwitch,
  upsertCompanyBudget,
} from './openai-usage-admin.service';
import { invalidateOpenAiBudgetCache } from '../../services/openai/openai-usage-guard.service';

const usageQueryZ = z.object({
  companyId: z.string().uuid().optional(),
  operationType: z.nativeEnum(OpenAIOperationType).optional(),
  status: z.nativeEnum(OpenAIUsageLogStatus).optional(),
  take: z.coerce.number().min(1).max(500).default(50),
  skip: z.coerce.number().min(0).max(10_000).default(0),
  since: z.coerce.date().optional(),
});

const budgetPatchZ = z.object({
  companyId: z.string().uuid(),
  dailyLimitEuros: z.number().min(0).nullable().optional(),
  monthlyLimitEuros: z.number().min(0).nullable().optional(),
  maxCallsPerHour: z.number().int().min(1).nullable().optional(),
  maxTokensPerRequest: z.number().int().min(256).nullable().optional(),
  userDailyLimitEuros: z.number().min(0).nullable().optional(),
  isEnabled: z.boolean().optional(),
  hardBlocked: z.boolean().optional(),
});

const killSwitchZ = z.object({
  active: z.boolean(),
});

export class OpenAiUsageAdminController {
  getUsage = async (req: Request, res: Response) => {
    const parsed = usageQueryZ.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Query inválida');
    }
    const since = parsed.data.since;
    const rows = await listUsageLogs({
      companyId: parsed.data.companyId,
      operationType: parsed.data.operationType,
      status: parsed.data.status,
      take: parsed.data.take,
      skip: parsed.data.skip,
      since,
    });
    return res.json({ success: true, data: rows });
  };

  getBudget = async (req: Request, res: Response) => {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : '';
    if (!z.string().uuid().safeParse(companyId).success) {
      throw new ValidationError('companyId UUID requerido');
    }
    const row = await getBudgetForCompany(companyId);
    return res.json({
      success: true,
      data: {
        budget: row,
        envDefaults: summarizeEnvKillSwitch(),
      },
    });
  };

  patchBudget = async (req: Request, res: Response) => {
    const parsed = budgetPatchZ.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Body inválido');
    }
    const company = await prisma.company.findFirst({
      where: { id: parsed.data.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!company) throw new ValidationError('Empresa no encontrada');
    const updated = await upsertCompanyBudget(parsed.data.companyId, {
      dailyLimitEuros: parsed.data.dailyLimitEuros,
      monthlyLimitEuros: parsed.data.monthlyLimitEuros,
      maxCallsPerHour: parsed.data.maxCallsPerHour,
      maxTokensPerRequest: parsed.data.maxTokensPerRequest,
      userDailyLimitEuros: parsed.data.userDailyLimitEuros,
      isEnabled: parsed.data.isEnabled,
      hardBlocked: parsed.data.hardBlocked,
    });

    invalidateOpenAiBudgetCache(parsed.data.companyId);

    const actor = req.user!;
    await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorRole: actor.role,
        action: 'OPENAI_BUDGET_PATCH',
        targetType: 'COMPANY',
        targetId: parsed.data.companyId,
        companyId: parsed.data.companyId,
        result: 'SUCCESS',
        metadata: parsed.data as object,
      },
    });

    return res.json({ success: true, data: updated });
  };

  postKillSwitch = async (req: Request, res: Response) => {
    const parsed = killSwitchZ.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Body inválido');
    }
    const state = await setDbKillSwitch(parsed.data.active);
    const actor = req.user!;
    await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorRole: actor.role,
        action: 'OPENAI_KILL_SWITCH',
        targetType: 'PLATFORM',
        targetId: 'openai',
        result: parsed.data.active ? 'BLOCKED' : 'ENABLED',
        reason: 'openai_system_state.global_kill_switch',
        metadata: { active: parsed.data.active },
      },
    });
    return res.json({
      success: true,
      data: {
        db: state,
        envKillSwitch: summarizeEnvKillSwitch().envKillSwitch,
        effectiveBlocked:
          summarizeEnvKillSwitch().envKillSwitch || state.globalKillSwitch === true,
      },
    });
  };

  getAlerts = async (req: Request, res: Response) => {
    const take = z.coerce.number().min(1).max(200).default(50).parse(req.query.take ?? 50);
    const rows = await listRecentAlerts(take);
    const state = await getOpenAiSystemState();
    return res.json({
      success: true,
      data: {
        recentBlockedOrError: rows,
        systemState: state,
        env: summarizeEnvKillSwitch(),
      },
    });
  };
}
