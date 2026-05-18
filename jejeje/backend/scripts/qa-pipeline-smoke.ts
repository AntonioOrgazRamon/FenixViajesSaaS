/**
 * Smoke QA local: lead → intent IA → travel search → propuesta (HTML/PDF/BD).
 * Uso: npx ts-node --transpile-only scripts/qa-pipeline-smoke.ts
 */
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { LeadAgentTriggerType, Prisma } from '@prisma/client';
import prisma from '../src/infrastructure/db';
import { leadIntentExtractorAgent } from '../src/services/leads/lead-intent-extractor.agent';
import { TravelSearchService } from '../src/services/travel/travel-search.service';
import { buildTravelSearchIntentFromSnapshots } from '../src/services/travel/proposal-intent.mapper';
import { ProposalService } from '../src/modules/proposals/proposal.service';

const COMPANY_ID = 'ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3';

async function main() {
  const log = (m: string) => console.log(m);

  log('=== QA pipeline smoke ===');

  if (!process.env.OPENAI_API_KEY?.trim()) {
    log('FAIL: OPENAI_API_KEY vacío (.env)');
    process.exitCode = 1;
    return;
  }
  log('OK: OPENAI_API_KEY presente');

  const approved = await prisma.travelTrip.count({
    where: { companyId: COMPANY_ID, status: 'APPROVED' },
  });
  log(`INFO: viajes APPROVED en tenant: ${approved}`);
  if (approved < 2) {
    log('WARN: hacen falta ≥2 viajes APPROVED. Ejecuta: npx ts-node --transpile-only scripts/seed-e2e-travel-and-lead.ts fenixviajes');
  }

  const admin = await prisma.user.findFirst({
    where: { companyId: COMPANY_ID, role: 'COMPANY_ADMIN', status: 'ACTIVE' },
    select: { id: true, email: true },
  });
  if (!admin) {
    log('FAIL: no hay COMPANY_ADMIN para el tenant');
    process.exitCode = 1;
    return;
  }
  log(`OK: actor admin ${admin.email} (${admin.id})`);

  const leadId = uuidv4();
  const detailId = uuidv4();
  const message = `QA ${Date.now()}: Vietnam en marzo 2026, 12 días, pareja, presupuesto ~2800€/persona. Preferencias: vuelos directos, hoteles boutique, ritmo tranquilo.`;

  await prisma.lead.create({
    data: {
      id: leadId,
      companyId: COMPANY_ID,
      source: 'MANUAL',
      sourceDetail: 'qa-pipeline-smoke',
      status: 'NEW',
      firstName: 'QA',
      lastName: 'Pipeline',
      fullName: 'QA Pipeline',
      email: `qa-pipeline-${Date.now()}@example.test`,
      phone: '+34 600 000 001',
      message,
      normalizedPayload: {
        travel: {
          destination: 'Vietnam',
          durationDays: 12,
          month: 3,
          budgetPerPerson: 2800,
          travelers: 2,
          preferences: ['vuelos directos', 'hoteles boutique'],
        },
      } as Prisma.InputJsonValue,
    },
  });

  await prisma.leadDetail.create({
    data: {
      id: detailId,
      leadId,
      companyId: COMPANY_ID,
      currentContext: {
        destination: 'Vietnam',
        durationDays: 12,
        seats: 2,
      } as Prisma.InputJsonValue,
    },
  });
  log(`OK: lead creado ${leadId}`);

  const intentRun = await leadIntentExtractorAgent.execute({
    companyId: COMPANY_ID,
    leadId,
    triggerType: LeadAgentTriggerType.MANUAL,
    actorUserId: admin.id,
  });
  log(`Intent agent: status=${intentRun.status} runId=${intentRun.runId}`);

  if (intentRun.status !== 'SUCCESS') {
    const runRow = await prisma.leadAgentRun.findUnique({ where: { id: intentRun.runId } });
    log(`FAIL: agente intento: ${runRow?.errorMessage ?? 'sin mensaje'}`);
    process.exitCode = 1;
  }

  const detail = await prisma.leadDetail.findUnique({ where: { leadId } });
  const tc = detail?.travelContext as Record<string, unknown> | null;
  const extracted = tc?.extractedIntent;
  if (!extracted || typeof extracted !== 'object') {
    log('FAIL: travelContext.extractedIntent ausente tras agente');
    process.exitCode = 1;
  } else {
    log(`OK: extractedIntent JSON keys: ${Object.keys(extracted as object).join(', ')}`);
    log(`Sample: ${JSON.stringify(extracted).slice(0, 400)}…`);
  }

  const leadRow = await prisma.lead.findUnique({ where: { id: leadId } });
  const snapshots: unknown[] = [tc, detail?.currentContext, leadRow?.normalizedPayload].filter(Boolean);
  const searchIntent = buildTravelSearchIntentFromSnapshots(snapshots);
  log(`OK: intent búsqueda: ${JSON.stringify(searchIntent)}`);

  const travelSearch = new TravelSearchService();
  const search = await travelSearch.searchByIntent(COMPANY_ID, searchIntent);
  log(
    `OK: search schemaVersion=${search.schemaVersion} totalCandidates=${search.totalCandidates} ranked=${search.ranked.length}`,
  );
  if (search.ranked.length < 2 && approved >= 2) {
    log('WARN: ranked < 2 a pesar de catálogo; revisar scoring o intención.');
  }

  const proposalSvc = new ProposalService();
  let proposalResult: Awaited<ReturnType<ProposalService['generateForLead']>> | null = null;
  try {
    proposalResult = await proposalSvc.generateForLead(COMPANY_ID, leadId, admin.id, {
      useAiCopy: false,
    });
    log('OK: ProposalService.generateForLead ejecutado');
  } catch (e) {
    log(`FAIL: generateForLead: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  }

  if (proposalResult) {
    const v0 = proposalResult.versions[0];
    const htmlLen = v0?.generatedHtml?.length ?? 0;
    log(`OK: última versión #${v0?.versionNumber} html chars=${htmlLen}`);
    log(`OK: pdfStoragePath=${v0?.pdfStoragePath ?? 'null'}`);
    if (htmlLen < 100) log('WARN: HTML muy corto');
    if (!v0?.pdfStoragePath) log('WARN: PDF no generado (puppeteer/Chromium o error htmlToPdfBuffer)');
  }

  const props = await prisma.proposal.count({ where: { leadId, companyId: COMPANY_ID } });
  const vers = await prisma.proposalVersion.count({
    where: { proposal: { leadId }, companyId: COMPANY_ID },
  });
  log(`OK: Proposal count=${props} ProposalVersion count=${vers}`);

  const acts = await prisma.leadActivity.findMany({
    where: { leadId, companyId: COMPANY_ID },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { activityType: true, title: true },
  });
  log(`OK: actividades recientes: ${JSON.stringify(acts)}`);

  if (process.exitCode !== 1) log('\n=== Smoke PASS (revisar WARNs) ===');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
