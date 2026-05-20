/**
 * Demo QA: lead Marta García (Asia / Tailandia–Japón) + recomendación + propuesta sin copy IA.
 *
 *   npm run qa:marta-asia-demo
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../src/infrastructure/db';
import { ProposalService } from '../src/modules/proposals/proposal.service';
import { TravelSearchService } from '../src/services/travel/travel-search.service';
import { buildTravelSearchIntentFromSnapshots } from '../src/services/travel/proposal-intent.mapper';

const COMPANY_ID = 'ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3';

const CLIENT_MESSAGE = `Hola, somos una pareja y queremos hacer un viaje de unos 12 a 15 días por Asia. Nos gustaría algo cultural, con buena gastronomía, algo de naturaleza y que no sea demasiado acelerado. Presupuesto aproximado 3.000-4.500 € por persona. Nos llama la atención Tailandia o Japón, pero estamos abiertos a recomendaciones.`;

/** Intent manual alineado con lo que consume proposal-intent.mapper + TravelSearchIntent */
function buildSnapshots() {
  const travelContext = {
    travel: {
      destination: 'Asia',
      durationDays: 14,
      budgetPerPerson: 4000,
      travelers: 2,
      travelStyleAxes: ['CULTURE', 'GASTRONOMY', 'NATURE'],
      preferences: [
        'Tailandia (interés)',
        'Japón (interés)',
        'Ritmo equilibrado; no acelerado',
        'Pareja',
      ],
    },
    message: CLIENT_MESSAGE,
    manualIntent: {
      secondaryDestinations: ['Tailandia', 'Japón'],
      budgetRangeEur: [3000, 4500],
      pace: 'BALANCED',
    },
  };

  const intentSnapshot = {
    travel: {
      destination: 'Asia',
      durationDays: 14,
      budgetPerPerson: 4000,
      travelers: 2,
      travelStyleAxes: ['CULTURE', 'GASTRONOMY', 'NATURE'],
      preferences: [
        'Tailandia o Japón',
        'Ritmo moderado',
        'gastronomía y cultura',
      ],
    },
    message: CLIENT_MESSAGE,
  };

  return { travelContext, intentSnapshot };
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { companyId: COMPANY_ID, role: 'COMPANY_ADMIN', status: 'ACTIVE' },
    select: { id: true, email: true },
  });
  if (!admin) {
    console.error('No hay COMPANY_ADMIN activo para el tenant.');
    process.exit(1);
  }

  const email = 'marta.qa@example.com';
  let lead = await prisma.lead.findFirst({
    where: { companyId: COMPANY_ID, email, deletedAt: null },
    include: { details: true },
  });

  const { travelContext, intentSnapshot } = buildSnapshots();

  if (!lead) {
    const id = uuidv4();
    lead = await prisma.lead.create({
      data: {
        id,
        companyId: COMPANY_ID,
        source: 'MANUAL',
        status: 'NEW',
        fullName: 'Marta García',
        email,
        phone: '+34 600 000 001',
        message: CLIENT_MESSAGE,
        language: 'es',
        details: {
          create: {
            id: uuidv4(),
            companyId: COMPANY_ID,
            travelContext: travelContext as object,
          },
        },
      },
      include: { details: true },
    });
    console.log('Lead creado:', lead.id);
  } else {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        fullName: 'Marta García',
        phone: '+34 600 000 001',
        message: CLIENT_MESSAGE,
      },
    });
    await prisma.leadDetail.upsert({
      where: { leadId: lead.id },
      create: {
        id: uuidv4(),
        leadId: lead.id,
        companyId: COMPANY_ID,
        travelContext: travelContext as object,
      },
      update: { travelContext: travelContext as object },
    });
    lead = (await prisma.lead.findFirst({
      where: { id: lead.id },
      include: { details: true },
    }))!;
    console.log('Lead actualizado (ya existía):', lead.id);
  }

  const resolvedIntent = buildTravelSearchIntentFromSnapshots([
    lead.details?.travelContext,
    intentSnapshot,
  ]);

  console.log('\n=== Intent resuelto (determinista) ===');
  console.log(JSON.stringify(resolvedIntent, null, 2));

  const searchSvc = new TravelSearchService();
  const search = await searchSvc.searchByIntent(COMPANY_ID, resolvedIntent, {
    telemetryVerbose: false,
    persistRecommendation: { leadId: lead.id, userId: admin.id },
  });

  console.log('\n=== Recommendation (previo a propuesta) ===');
  console.log(
    JSON.stringify(
      {
        matchState: search.matchState,
        globalConfidence: search.globalConfidence,
        trustSummary: search.trustSummary,
        humanReadableReasoning: search.premiumUx.humanReadableReasoning,
        mainTradeoffs: search.premiumUx.mainTradeoffs,
        relaxedAlternatives: search.relaxedAlternatives,
        totalCandidates: search.totalCandidates,
      },
      null,
      2,
    ),
  );

  const titles = new Map(
    (
      await prisma.travelTrip.findMany({
        where: { companyId: COMPANY_ID },
        select: { id: true, title: true, mainDestination: true, durationDays: true, indicativePrice: true, currency: true },
      })
    ).map((t) => [t.id, t]),
  );

  console.log('\n=== Picks (comercial) ===');
  console.log(
    JSON.stringify(
      {
        recommended: search.picks.recommended ? titles.get(search.picks.recommended.tripId)?.title : null,
        budget: search.picks.budget ? titles.get(search.picks.budget.tripId)?.title : null,
        luxury: search.picks.luxury ? titles.get(search.picks.luxury.tripId)?.title : null,
        alternative: search.picks.alternative ? titles.get(search.picks.alternative.tripId)?.title : null,
      },
      null,
      2,
    ),
  );
  console.log('\n=== premiumUx.commercialPreferenceNotes ===');
  console.log(JSON.stringify(search.premiumUx.commercialPreferenceNotes ?? [], null, 2));

  console.log('\n=== Top 5 ===');
  const top5 = search.ranked.slice(0, 5);
  for (const r of top5) {
    const t = titles.get(r.tripId);
    console.log({
      title: t?.title,
      mainDestination: t?.mainDestination,
      durationDays: t?.durationDays,
      price: t?.indicativePrice?.toString(),
      currency: t?.currency,
      score: r.score,
      matchState: r.matchState,
      reasons: r.reasons.slice(0, 6),
    });
  }

  const proposalSvc = new ProposalService();
  const proposal = await proposalSvc.generateForLead(COMPANY_ID, lead.id, admin.id, {
    useAiCopy: false,
    intentSnapshot,
  });

  const v = proposal.versions[0];
  const htmlLen = v?.generatedHtml?.length ?? 0;
  const pdfRel = v?.pdfStoragePath ?? null;
  let pdfAbs: string | null = null;
  let pdfExists = false;
  let pdfBytes = 0;
  if (pdfRel) {
    const abs = path.join(process.cwd(), 'uploads', pdfRel);
    try {
      pdfBytes = fs.statSync(abs).size;
      pdfExists = true;
      pdfAbs = abs;
    } catch {
      pdfAbs = null;
    }
  }

  const activities = await prisma.leadActivity.findMany({
    where: { companyId: COMPANY_ID, leadId: lead.id },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: { activityType: true, title: true, description: true },
  });

  console.log('\n========================================');
  console.log('# ENTREGA RESUMEN (copiar al informe)');
  console.log('========================================');
  console.log('\n## Lead');
  console.log('- id:', lead.id);
  console.log('- email:', email);

  console.log('\n## Recommendation');
  console.log('- matchState:', search.matchState);
  console.log('- globalConfidence:', search.globalConfidence);
  console.log('- trustSummary:', JSON.stringify(search.trustSummary, null, 2));
  console.log('- humanReadableReasoning:', search.premiumUx.humanReadableReasoning);

  console.log('\n## Proposal');
  console.log('- proposalId:', proposal.id);
  console.log('- versionNumber:', v?.versionNumber);
  console.log('- versionId (última):', v?.id);
  console.log('- HTML length:', htmlLen);
  console.log('- PDF storage path (rel):', pdfRel);
  console.log('- PDF en disco:', pdfExists, pdfAbs ?? '', pdfBytes ? `${pdfBytes} bytes` : '');

  console.log('\n## Actividades (recientes)');
  console.log(activities.map((a) => `${a.activityType}: ${a.title}`).join('\n'));

  console.log('\n## UI (dev)');
  const fe = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
  console.log('- Lead:', `${fe}/leads/${lead.id}`);
  console.log('- API propuesta:', `GET /api/v1/proposals (o detalle lead incluye propuesta)`);
  console.log('- PDF público (si PUBLIC_URL):', pdfRel ? `${process.env.PUBLIC_URL || 'http://localhost:3000'}/uploads/${pdfRel}` : 'N/A');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
