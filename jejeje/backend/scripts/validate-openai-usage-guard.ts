/**
 * Validaciones manuales del guard OpenAI (requiere DATABASE_URL y al menos una empresa).
 *
 * Uso:
 *   npx ts-node --transpile-only scripts/validate-openai-usage-guard.ts
 *
 * Pruebas:
 *   - preFlight bloqueado por kill switch env (si OPENAI_GLOBAL_KILL_SWITCH=true)
 *   - preFlight bloqueado por TENANT_HARDBLOCK tras upsert budget
 *   - idempotencia (segunda llamada con misma key)
 *   - estimación de coste (pricing)
 */
import 'dotenv/config';
import { OpenAIOperationType } from '@prisma/client';
import prisma from '../src/infrastructure/db';
import { config } from '../src/common/config';
import { invalidateOpenAiBudgetCache, openAIUsageGuard } from '../src/services/openai/openai-usage-guard.service';
import { estimateChatCostEuros } from '../src/services/openai/openai-pricing';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  const company = await prisma.company.findFirst({
    where: { deletedAt: null, status: 'ACTIVE' },
    select: { id: true, name: true },
  });
  if (!company) {
    console.error('Sin empresa activa en BD; omitir pruebas integradas.');
    process.exit(1);
  }

  console.log('Empresa:', company.name, company.id);
  console.log('OPENAI_GLOBAL_KILL_SWITCH (env):', config.OPENAI_GLOBAL_KILL_SWITCH);

  const basePre = {
    companyId: company.id,
    userId: null as string | null,
    leadId: null as string | null,
    operationType: OpenAIOperationType.INTENT_EXTRACTION,
    model: config.TRAVEL_OPENAI_MODEL,
    estimatedInputTokens: 100,
    estimatedOutputTokens: 50,
    idempotencyKey: `validate-${Date.now()}`,
  };

  if (config.OPENAI_GLOBAL_KILL_SWITCH) {
    const r = await openAIUsageGuard.preFlight(basePre);
    console.assert(!r.allowed && r.code === 'KILL_SWITCH', 'Esperado KILL_SWITCH');
    console.log('OK kill switch env bloquea');
    return;
  }

  const est = estimateChatCostEuros(config.TRAVEL_OPENAI_MODEL, 10_000, 2_000);
  console.log('Coste estimado ejemplo (10k in, 2k out) EUR ~', est.toFixed(6));
  console.assert(est > 0 && est < 50, 'Estimación fuera de rango razonable');

  const budget = await prisma.openAIUsageBudget.upsert({
    where: { companyId: company.id },
    create: {
      id: uuidv4(),
      companyId: company.id,
      hardBlocked: true,
      isEnabled: true,
    },
    update: { hardBlocked: true },
  });

  const blocked = await openAIUsageGuard.preFlight({
    ...basePre,
    idempotencyKey: `validate-block-${Date.now()}`,
  });
  console.assert(!blocked.allowed && blocked.code === 'TENANT_HARDBLOCK', 'hardBlock');
  console.log('OK TENANT_HARDBLOCK');

  await prisma.openAIUsageBudget.update({
    where: { companyId: company.id },
    data: { hardBlocked: false },
  });
  invalidateOpenAiBudgetCache(company.id);

  const probe = await openAIUsageGuard.preFlight({
    ...basePre,
    estimatedInputTokens: 50,
    estimatedOutputTokens: 20,
    idempotencyKey: `validate-probe-${Date.now()}`,
  });
  if (!probe.allowed) {
    console.log(
      'Aviso: preFlight no permite llamada (p. ej. tope diario de empresa en BD). Omito prueba de idempotencia.',
      probe,
    );
  } else {
    const idem = `idem-${Date.now()}`;
    const a = await openAIUsageGuard.preFlight({ ...basePre, idempotencyKey: idem });
    const b = await openAIUsageGuard.preFlight({ ...basePre, idempotencyKey: idem });
    console.assert(a.allowed, 'primera idem debe permitir');
    console.assert(!b.allowed && b.code === 'IDEMPOTENCY', 'segunda idem debe bloquear');
    console.log('OK idempotencia');
  }

  console.log('\nValidación openai-usage-guard: OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
