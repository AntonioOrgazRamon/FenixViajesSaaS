/**
 * Ejecutado como subproceso con env específico (ver qa-openai-guard-matrix.ts).
 */
import 'dotenv/config';
import { OpenAIOperationType } from '@prisma/client';
import prisma from '../src/infrastructure/db';
import { config } from '../src/common/config';
import { openAIUsageGuard } from '../src/services/openai/openai-usage-guard.service';

const caseId = process.argv[2];
if (!caseId) {
  console.error('Missing caseId');
  process.exit(2);
}

async function main() {
  const company = await prisma.company.findFirst({
    where: { deletedAt: null, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!company) {
    console.error('NO_COMPANY');
    process.exit(3);
  }

  const baseFixed = {
    companyId: company.id,
    userId: null as string | null,
    leadId: null as string | null,
    model: config.TRAVEL_OPENAI_MODEL,
    estimatedInputTokens: 100,
    estimatedOutputTokens: 50,
    idempotencyKey: `qa-${caseId}-${Date.now()}`,
  };

  let op: OpenAIOperationType = OpenAIOperationType.INTENT_EXTRACTION;
  if (caseId === 'copy_disabled') op = OpenAIOperationType.PROPOSAL_COPY;
  if (caseId === 'embed_disabled') op = OpenAIOperationType.EMBEDDING;

  const pre = await openAIUsageGuard.preFlight({
    ...baseFixed,
    operationType: op,
    estimatedOutputTokens: op === OpenAIOperationType.EMBEDDING ? 0 : 50,
  });

  const expected: Record<string, { allow?: boolean; code?: string }> = {
    kill_switch: { allow: false, code: 'KILL_SWITCH' },
    intent_disabled: { allow: false, code: 'OPERATION_DISABLED' },
    copy_disabled: { allow: false, code: 'OPERATION_DISABLED' },
    embed_disabled: { allow: false, code: 'OPERATION_DISABLED' },
    daily_cap: { allow: false, code: 'COMPANY_DAILY_CAP' },
    monthly_cap: { allow: false, code: 'COMPANY_MONTHLY_CAP' },
    allowed: { allow: true },
  };

  const exp = expected[caseId];
  if (!exp) {
    console.error('UNKNOWN_CASE', caseId);
    process.exit(4);
  }

  if (exp.allow === true) {
    if (!pre.allowed) {
      console.log(
        JSON.stringify({
          caseId,
          fail: true,
          reason: 'expected allow got block',
          pre,
          configSnapshot: {
            NODE_ENV: config.NODE_ENV,
            kill: config.OPENAI_GLOBAL_KILL_SWITCH,
            openai: config.OPENAI_ENABLED,
          },
        }),
      );
      process.exit(10);
    }
  } else {
    if (pre.allowed || !('code' in pre) || pre.code !== exp.code) {
      console.log(
        JSON.stringify({
          caseId,
          fail: true,
          expectedCode: exp.code,
          pre,
        }),
      );
      process.exit(11);
    }
  }

  console.log(JSON.stringify({ caseId, ok: true, pre: pre.allowed ? { allowed: true } : pre }));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
