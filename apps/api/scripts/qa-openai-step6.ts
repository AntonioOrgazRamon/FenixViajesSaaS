/**
 * PASO 6 smoke: lead con perfil parcial + mensaje libre, propuesta con useAiCopy si hay clave.
 * No imprime secretos. Requiere misma DB que el resto de QA.
 *
 * Uso (PowerShell):
 *   $env:OPENAI_ENABLED="true"; $env:OPENAI_INTENT_ENABLED="true"; $env:OPENAI_COPY_ENABLED="true";
 *   $env:TRAVEL_HYBRID_RETRIEVAL_ENABLED="false";
 *   npx ts-node --transpile-only scripts/qa-openai-step6.ts --companyId=UUID
 */
import 'dotenv/config';
import { LeadStatus, OpenAIUsageLogStatus, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import prisma from '../src/infrastructure/db';
import { config } from '../src/common/config';
import { ProposalService } from '../src/modules/proposals/proposal.service';

function companyIdFromArgs(): string | undefined {
  const raw = process.argv.find((a) => a.startsWith('--companyId='));
  return raw?.split('=')[1]?.trim();
}

const COMPANY_ID =
  companyIdFromArgs() || process.env.QA_COMPANY_ID?.trim() || 'ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3';

async function main() {
  const hasKey = Boolean(config.OPENAI_API_KEY?.trim());
  console.log('=== qa-openai-step6 ===');
  console.log('OPENAI_ENABLED:', config.OPENAI_ENABLED);
  console.log('OPENAI_INTENT_ENABLED:', config.OPENAI_INTENT_ENABLED);
  console.log('OPENAI_COPY_ENABLED:', config.OPENAI_COPY_ENABLED);
  console.log('TRAVEL_HYBRID_RETRIEVAL_ENABLED:', config.TRAVEL_HYBRID_RETRIEVAL_ENABLED);
  console.log('OPENAI_API_KEY configurada:', hasKey);

  if (!hasKey || !config.OPENAI_ENABLED) {
    console.log('SKIP: falta OPENAI_API_KEY o OPENAI_ENABLED es false.');
    await prisma.$disconnect();
    return;
  }

  const admin = await prisma.user.findFirst({
    where: { companyId: COMPANY_ID, role: 'COMPANY_ADMIN', status: 'ACTIVE' },
    select: { id: true },
  });
  if (!admin) {
    console.error('No COMPANY_ADMIN');
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  const email = `qa-openai-${Date.now()}@example.com`;
  const since = new Date();

  await prisma.lead.deleteMany({ where: { companyId: COMPANY_ID, email } });

  const lead = await prisma.lead.create({
    data: {
      id: uuidv4(),
      companyId: COMPANY_ID,
      assignedUserId: admin.id,
      fullName: 'QA OpenAI Parcial',
      email,
      phone: '+34 600 999 888',
      status: LeadStatus.NEW,
      source: 'MANUAL',
      sourceDetail: 'qa-openai-step6',
      message:
        'Somos dos, nos gusta Asia pero no tenemos claro si playa o ciudad; el presupuesto es flexible y salimos de Barcelona si hace falta.',
    },
  });

  await prisma.leadDetail.create({
    data: {
      leadId: lead.id,
      companyId: COMPANY_ID,
      currentContext: { qa: 'openai-partial' } as Prisma.InputJsonValue,
    },
  });

  await prisma.leadTravelProfile.create({
    data: {
      leadId: lead.id,
      companyId: COMPANY_ID,
      destinationText: 'Sudeste asiático',
      budgetAmount: 3500,
      budgetCurrency: 'EUR',
      budgetType: 'PER_PERSON',
      tripType: 'UNKNOWN',
      // sin activityTags, sin travelDateText — mensaje debe aportar señal
    },
  });

  const proposalSvc = new ProposalService();
  try {
    await proposalSvc.generateForLead(COMPANY_ID, lead.id, admin.id, {
      useAiCopy: config.OPENAI_COPY_ENABLED,
    });
    console.log('OK: generateForLead completado (revisar logs si hubo fallback de copy).');
  } catch (e) {
    console.error('ERROR generateForLead:', (e as Error).message);
  }

  const logs = await prisma.openAIUsageLog.findMany({
    where: {
      companyId: COMPANY_ID,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      status: true,
      operationType: true,
      model: true,
      estimatedCost: true,
      totalTokens: true,
      createdAt: true,
    },
  });

  console.log('\nOpenAIUsageLog (desde inicio del script):', logs.length, 'filas');
  for (const row of logs) {
    console.log(
      row.status,
      row.operationType,
      row.model,
      '€' + (row.estimatedCost?.toString() ?? '?'),
      'tokens=' + (row.totalTokens?.toString() ?? '?'),
    );
  }

  const successCost = logs
    .filter((l) => l.status === OpenAIUsageLogStatus.SUCCESS)
    .reduce((acc, l) => acc + Number(l.estimatedCost ?? 0), 0);
  console.log('\nCoste estimado acumulado (SUCCESS en ventana):', successCost.toFixed(6), 'EUR');

  /** Finalización/notificación corre en background; esperar evita FK al borrar el lead antes. */
  await new Promise((r) => setTimeout(r, 6000));

  await prisma.leadTravelProfile.deleteMany({ where: { leadId: lead.id } });
  await prisma.leadDetail.deleteMany({ where: { leadId: lead.id } });
  await prisma.lead.deleteMany({ where: { id: lead.id } });

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
