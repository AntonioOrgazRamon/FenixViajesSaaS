/**
 * Diagnóstico local del flujo propuesta + intención (sin levantar HTTP).
 * Uso: npx ts-node --transpile-only scripts/e2e-diagnose-proposal-flow.ts [leadId]
 */
import 'dotenv/config';
import { LeadAgentTriggerType } from '@prisma/client';
import prisma from '../src/infrastructure/db';
import { config } from '../src/common/config';
import { LeadIntentExtractorAgent } from '../src/services/leads/lead-intent-extractor.agent';
import { TravelSearchService } from '../src/services/travel/travel-search.service';
import { buildTravelSearchIntentFromSnapshots } from '../src/services/travel/proposal-intent.mapper';
import { ProposalGenerationService } from '../src/services/proposals/proposal-generation.service';

async function main() {
  const leadIdArg = process.argv[2];

  console.log('=== Entorno ===');
  console.log('NODE_ENV:', config.NODE_ENV);
  console.log('TRAVEL_HYBRID_RETRIEVAL_ENABLED:', config.TRAVEL_HYBRID_RETRIEVAL_ENABLED);
  console.log('OPENAI_GLOBAL_KILL_SWITCH:', config.OPENAI_GLOBAL_KILL_SWITCH);
  console.log('OPENAI_MAX_DAILY_EUROS_PER_COMPANY:', config.OPENAI_MAX_DAILY_EUROS_PER_COMPANY);
  console.log('OPENAI_INTENT_ENABLED / COPY / EMBEDDINGS:', config.OPENAI_INTENT_ENABLED, config.OPENAI_COPY_ENABLED, config.OPENAI_EMBEDDINGS_ENABLED);
  console.log('OPENAI_API_KEY:', config.OPENAI_API_KEY?.trim() ? 'configurada' : 'no configurada');
  console.log('PUBLIC_URL:', config.PUBLIC_URL);
  console.log('SMTP_HOST:', config.SMTP_HOST || 'no');
  console.log('EMAIL_FROM:', config.EMAIL_FROM || 'no');

  const companies = await prisma.company.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    take: 5,
    select: { id: true, name: true, slug: true },
  });
  console.log('\n=== Empresas activas (máx 5) ===');
  console.log(JSON.stringify(companies, null, 2));
  if (!companies.length) {
    console.error('No hay empresas. Ejecuta seed o crea tenant en superadmin.');
    process.exit(1);
  }

  const companyId = companies[0].id;

  const tripsApproved = await prisma.travelTrip.count({ where: { companyId, status: 'APPROVED' } });
  const users = await prisma.user.count({ where: { companyId, status: 'ACTIVE' } });
  console.log(`\n=== Tenant ${companyId.slice(0, 8)}… ===`);
  console.log('Usuarios activos:', users);
  console.log('TravelTrip APPROVED:', tripsApproved);

  let leadId = leadIdArg;
  if (!leadId) {
    const lead = await prisma.lead.findFirst({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, message: true },
    });
    leadId = lead?.id;
    console.log('\n=== Lead más reciente ===');
    console.log(lead ?? '(ninguno)');
  }

  if (!leadId) {
    console.log('\nSin lead: crea uno (intake o UI).');
    await prisma.$disconnect();
    return;
  }

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId, deletedAt: null },
    include: { details: true },
  });
  if (!lead) {
    console.error('Lead no encontrado en primer tenant.');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('\n=== Extractor de intención (agente) ===');
  const agent = new LeadIntentExtractorAgent();
  const run = await agent.execute({
    companyId,
    leadId,
    triggerType: LeadAgentTriggerType.MANUAL,
    actorUserId: null,
  });
  console.log('Run:', run);

  const fresh = await prisma.lead.findFirst({
    where: { id: leadId, companyId },
    include: { details: true },
  });
  const extracted = fresh?.details?.travelContext as Record<string, unknown> | null;
  const intentBlob = extracted?.extractedIntent as Record<string, unknown> | undefined;
  console.log('extractedIntent presente:', !!intentBlob);
  if (intentBlob?.intent && typeof intentBlob.intent === 'object') {
    console.log('intent keys:', Object.keys(intentBlob.intent as object));
  }

  const snapshots: unknown[] = [
    fresh?.details?.travelContext,
    fresh?.details?.currentContext,
    typeof fresh?.normalizedPayload === 'object' && fresh.normalizedPayload
      ? (fresh.normalizedPayload as Record<string, unknown>).travel
      : null,
  ].filter((x) => x != null);

  const intent = buildTravelSearchIntentFromSnapshots(snapshots);
  console.log('\n=== TravelSearchIntent ===');
  console.log(JSON.stringify(intent, null, 2));

  if (tripsApproved > 0) {
    // Un solo `runTravelRecommendation`: sale del `resolveSearch` dentro de `generate`.
    // (Evita duplicar el log «travelRecommendation pipeline» que ocurría al llamar `searchByIntent` y luego `generate`.)
    console.log('\n=== ProposalGenerationService (useAiCopy:false; incluye búsqueda/recomendación) ===');
    const company = await prisma.company.findFirst({
      where: { id: companyId },
      select: { name: true, slug: true },
    });
    const gen = new ProposalGenerationService();
    try {
      const out = await gen.generate({
        lead: fresh!,
        company: { name: company!.name, slug: company!.slug ?? undefined },
        intentSnapshots: snapshots,
        useAiCopy: false,
      });
      const search = out.search;
      console.log('totalCandidates:', search.totalCandidates);
      console.log('picks:', {
        rec: search.picks.recommended?.tripId,
        eco: search.picks.budget?.tripId,
        prem: search.picks.luxury?.tripId,
      });
      console.log('top3 scores:', search.ranked.slice(0, 3).map((r) => ({ id: r.tripId, score: r.score })));
      console.log('HTML length:', out.html.length);
      console.log(
        'PDF buffer:',
        out.pdfBuffer ? `${out.pdfBuffer.length} bytes` : 'null (Puppeteer falló o entorno)',
      );
    } catch (e) {
      console.error('generate error:', e instanceof Error ? e.message : e);
    }
  } else {
    console.log('\n=== TravelSearchService (catálogo sin APPROVED; sin ProposalGenerationService) ===');
    const searchSvc = new TravelSearchService();
    const search = await searchSvc.searchByIntent(companyId, intent);
    console.log('totalCandidates:', search.totalCandidates);
    console.log('picks:', {
      rec: search.picks.recommended?.tripId,
      eco: search.picks.budget?.tripId,
      prem: search.picks.luxury?.tripId,
    });
    console.log('top3 scores:', search.ranked.slice(0, 3).map((r) => ({ id: r.tripId, score: r.score })));
  }

  const acts = await prisma.leadActivity.findMany({
    where: { leadId, companyId },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { activityType: true, title: true, createdAt: true },
  });
  console.log('\n=== Últimas LeadActivity ===');
  console.log(JSON.stringify(acts, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
