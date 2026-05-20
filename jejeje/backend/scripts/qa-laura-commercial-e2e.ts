/**
 * QA comercial: lead Laura Martínez + intent + ranking + propuesta (HTML/PDF).
 * Uso (desde backend/):
 *   npx ts-node --transpile-only scripts/qa-laura-commercial-e2e.ts --companyId=UUID
 *
 * Sin IA por defecto (useAiCopy: false en generateForLead).
 */
import 'dotenv/config';
import { LeadStatus, Prisma } from '@prisma/client';
import prisma from '../src/infrastructure/db';
import { ProposalService } from '../src/modules/proposals/proposal.service';
import { buildLeadIntentSnapshots } from '../src/services/travel/lead-intent-snapshots';
import { buildTravelSearchIntentFromSnapshots } from '../src/services/travel/proposal-intent.mapper';
import { TravelSearchService } from '../src/services/travel/travel-search.service';

function companyIdFromArgs(): string | undefined {
  const raw = process.argv.find((a) => a.startsWith('--companyId='));
  return raw?.split('=')[1]?.trim();
}

const COMPANY_ID =
  companyIdFromArgs() || process.env.QA_COMPANY_ID?.trim() || 'ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3';

const LAURA = {
  fullName: 'Laura Martínez',
  email: 'laura.qa@example.com',
  phone: '+34 600 000 123',
  message:
    'Queremos una luna de miel especial, cultural y gastronómica, con algo de naturaleza, sin que sea un viaje demasiado acelerado.',
  travelProfile: {
    destinationText: 'Tailandia o Japón',
    preferredDestinations: ['Tailandia', 'Japón'],
    activitiesText: 'cultura, gastronomía, naturaleza, templos, mercados locales',
    activityTags: ['Cultura', 'Gastronomía', 'Naturaleza'],
    travelDateText: 'octubre 2026',
    budgetAmount: 4000,
    budgetCurrency: 'EUR',
    budgetType: 'PER_PERSON' as const,
    tripType: 'HONEYMOON' as const,
    departureAirportText: 'Madrid',
  },
};

async function firstCompanyAdminUserId(companyId: string): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { companyId, role: 'COMPANY_ADMIN', status: 'ACTIVE' },
    select: { id: true },
  });
  if (!admin) throw new Error(`No COMPANY_ADMIN activo para company ${companyId}`);
  return admin.id;
}

async function main() {
  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company) {
    console.error(`Company not found: ${COMPANY_ID}`);
    process.exitCode = 1;
    return;
  }

  const userId = await firstCompanyAdminUserId(COMPANY_ID);

  await prisma.lead.deleteMany({ where: { companyId: COMPANY_ID, email: LAURA.email } });

  const lead = await prisma.lead.create({
    data: {
      companyId: COMPANY_ID,
      assignedUserId: userId,
      fullName: LAURA.fullName,
      email: LAURA.email,
      phone: LAURA.phone,
      status: LeadStatus.NEW,
      source: 'MANUAL',
      sourceDetail: 'QA_COMMERCIAL',
      message: LAURA.message,
    },
  });

  await prisma.leadDetail.create({
    data: {
      leadId: lead.id,
      companyId: COMPANY_ID,
      currentContext: { note: 'QA Laura — detalle mínimo' } as Prisma.InputJsonValue,
    },
  });

  await prisma.leadTravelProfile.create({
    data: {
      leadId: lead.id,
      companyId: COMPANY_ID,
      ...LAURA.travelProfile,
    },
  });

  const fresh = await prisma.lead.findFirstOrThrow({
    where: { id: lead.id },
    include: { details: true, travelProfile: true },
  });

  const snapshots = buildLeadIntentSnapshots(fresh);
  const intent = buildTravelSearchIntentFromSnapshots(snapshots);

  console.log('\n=== INTENT PRE-PROPUESTA (LeadTravelProfile + mensaje, sin IA en servicio) ===');
  console.log(JSON.stringify(intent, null, 2));
  console.log('señal honeymoon en ejes:', intent.travelStyleAxes?.includes('HONEYMOON'));
  console.log('budgetPerPerson:', intent.budgetPerPerson);
  console.log('preferredDestinations:', intent.preferredDestinations);
  console.log('departureAirport (texto):', intent.departureAirport);
  console.log('durationDays:', intent.durationDays ?? '(no inferido)');

  const searchResp = await new TravelSearchService().searchByIntent(COMPANY_ID, intent, {
    persistRecommendation: { leadId: lead.id, userId },
  });

  const rankedIds = searchResp.ranked.map((r) => r.tripId);
  const pickIds = [
    searchResp.picks.recommended?.tripId,
    searchResp.picks.budget?.tripId,
    searchResp.picks.luxury?.tripId,
    searchResp.picks.alternative?.tripId,
  ].filter((x): x is string => Boolean(x));
  const allTripIds = [...new Set([...rankedIds, ...pickIds])];

  const tripRows =
    allTripIds.length === 0
      ? []
      : await prisma.travelTrip.findMany({
          where: { id: { in: allTripIds }, companyId: COMPANY_ID },
          select: { id: true, title: true, mainDestination: true },
        });
  const labelByTripId = new Map(
    tripRows.map((t) => [t.id, (t.title?.trim() || t.mainDestination?.trim() || t.id) as string]),
  );

  console.log('\n=== MATCH & TRUST (búsqueda explícita) ===');
  console.log('matchState:', searchResp.matchState);
  console.log('globalConfidence:', searchResp.globalConfidence);
  console.log('trustSummary:', searchResp.trustSummary);
  console.log('premiumUx:', searchResp.premiumUx);

  console.log('\n=== TOP 5 ===');
  searchResp.ranked.slice(0, 5).forEach((r, i) => {
    const label = labelByTripId.get(r.tripId) ?? r.tripId;
    console.log(`${i + 1}. ${label} | score=${r.score.toFixed(2)} | ${r.tripId}`);
  });

  console.log('\n=== PICKS ===');
  const pickLabel = (id: string | undefined) => (id ? labelByTripId.get(id) ?? id : '(n/a)');
  console.log('recommended:', pickLabel(searchResp.picks.recommended?.tripId), searchResp.picks.recommended?.tripId);
  console.log('budget:', pickLabel(searchResp.picks.budget?.tripId), searchResp.picks.budget?.tripId);
  console.log('luxury:', pickLabel(searchResp.picks.luxury?.tripId), searchResp.picks.luxury?.tripId);
  console.log('alternative:', pickLabel(searchResp.picks.alternative?.tripId), searchResp.picks.alternative?.tripId);

  const proposalSvc = new ProposalService();
  const proposalBundle = await proposalSvc.generateForLead(COMPANY_ID, lead.id, userId, {
    useAiCopy: false,
  });

  const version = proposalBundle.versions[0];
  const snap = version?.intentSnapshot as Record<string, unknown> | null;
  const snapSearch = snap?.search as Record<string, unknown> | undefined;

  const html = version?.generatedHtml ?? '';
  const titlesLower = searchResp.ranked.map((r) => (labelByTripId.get(r.tripId) ?? '').toLowerCase());
  const hasThailand = titlesLower.some((t) => t.includes('tailand'));
  const hasJapan = titlesLower.some((t) => t.includes('jap'));
  console.log('\n=== DESTINOS EN PREVIEW ===');
  console.log('Tailandia en ranking:', hasThailand);
  console.log('Japón en ranking:', hasJapan);
  console.log('\n=== PICKS (snapshot versión, IDs) ===');
  console.log(JSON.stringify(snapSearch?.picks ?? {}, null, 2));

  console.log('\n=== PROPUESTA ===');
  console.log('proposalId:', proposalBundle.id);
  console.log('versionNumber:', version?.versionNumber);
  console.log('pdfStoragePath:', version?.pdfStoragePath);
  console.log('pdfPublicUrl:', version?.pdfPublicUrl ?? null);

  console.log('HTML contiene "Datos clave del viaje":', html.includes('Datos clave del viaje'));
  const checks = [
    ['destino / preferencias', /tailand|jap|destino|preferid/i.test(html)],
    ['actividades', /cultur|gastron|natur|actividad|hobby/i.test(html)],
    ['fecha', /octubre|2026|fecha/i.test(html)],
    ['presupuesto', /4[.,]?000|eur|presupuesto/i.test(html)],
    ['tipo viaje', /luna de miel|honeymoon|tipo/i.test(html)],
    ['aeropuerto', /madrid|salida|aeropuerto/i.test(html)],
  ] as const;
  console.log('Heurísticas bloque datos clave en HTML:');
  for (const [label, ok] of checks) {
    console.log(`  ${label}:`, ok);
  }

  console.log('\n=== LEAD ===');
  console.log('id:', lead.id);
  console.log('email:', LAURA.email);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
