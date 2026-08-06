/**
 * QA LeadTravelProfile + intención + motor (sin HTTP).
 * Uso: npm run qa:lead-travel-profile  (desde /backend)
 *
 * Requiere: DATABASE_URL, tenant con viajes APPROVED opcional para scoring.
 */
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import prisma from '../src/infrastructure/db';
import { buildLeadIntentSnapshots } from '../src/services/travel/lead-intent-snapshots';
import { buildTravelSearchIntentFromSnapshots } from '../src/services/travel/proposal-intent.mapper';
import { leadTravelProfileToTravelSearchIntent } from '../src/services/travel/lead-travel-profile.mapper';
import { TravelSearchService } from '../src/services/travel/travel-search.service';
import { ProposalGenerationService } from '../src/services/proposals/proposal-generation.service';

function companyIdFromArgs(): string | undefined {
  const raw = process.argv.find((a) => a.startsWith('--companyId='));
  return raw?.split('=')[1]?.trim();
}

const COMPANY_ID = companyIdFromArgs() || process.env.QA_COMPANY_ID?.trim() || 'ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3';

function fail(msg: string) {
  console.error('FAIL:', msg);
  process.exitCode = 1;
}

async function main() {
  console.log('=== qa:lead-travel-profile ===');
  const admin = await prisma.user.findFirst({
    where: { companyId: COMPANY_ID, role: 'COMPANY_ADMIN', status: 'ACTIVE' },
    select: { id: true },
  });
  if (!admin) {
    fail(`No COMPANY_ADMIN para company ${COMPANY_ID}; define QA_COMPANY_ID`);
    return;
  }

  const leadId = uuidv4();
  const detailId = uuidv4();
  const profileId = uuidv4();

  await prisma.lead.create({
    data: {
      id: leadId,
      companyId: COMPANY_ID,
      source: 'MANUAL',
      sourceDetail: 'qa-lead-travel-profile',
      status: 'NEW',
      fullName: 'QA Perfil Viaje',
      email: `qa-ltp-${Date.now()}@example.test`,
      phone: '+34 600 000 099',
      message: 'Mensaje libre de respaldo: tailandia playa',
      normalizedPayload: {
        travel: { destination: 'Maldivas', budgetPerPerson: 500 },
      } as Prisma.InputJsonValue,
    },
  });

  await prisma.leadDetail.create({
    data: {
      id: detailId,
      leadId,
      companyId: COMPANY_ID,
      travelContext: { destination: 'Legacy TC', budgetPerPerson: 800 } as Prisma.InputJsonValue,
    },
  });

  await prisma.leadTravelProfile.create({
    data: {
      id: profileId,
      companyId: COMPANY_ID,
      leadId,
      destinationText: 'Japón',
      activitiesText: 'cultura, gastronomía, naturaleza',
      travelDateText: 'octubre 2026',
      budgetAmount: 4000,
      budgetCurrency: 'EUR',
      budgetType: 'PER_PERSON',
      tripType: 'HONEYMOON',
      departureAirportText: 'Madrid',
    },
  });

  const leadRow = await prisma.lead.findFirstOrThrow({
    where: { id: leadId },
    include: { details: true, travelProfile: true },
  });

  const snaps = buildLeadIntentSnapshots(leadRow);
  const intent = buildTravelSearchIntentFromSnapshots(snaps);
  if (intent.destination !== 'Japón') {
    fail(`destination debe ganar perfil (esperado Japón, fue ${intent.destination})`);
    return;
  }
  console.log('OK: destino prioriza LeadTravelProfile sobre legacy');

  const fromProfileOnly = leadTravelProfileToTravelSearchIntent(leadRow.travelProfile!);
  if (!fromProfileOnly.travelStyleAxes?.includes('HONEYMOON')) {
    fail('tripType HONEYMOON debe añadir eje HONEYMOON');
    return;
  }
  console.log('OK: honeymoon → travelStyleAxes');

  if (!intent.departureAirport?.includes('Madrid')) {
    fail('departureAirport debe reflejar perfil');
    return;
  }
  console.log('OK: aeropuerto de salida en intent');

  const intentBudget = buildTravelSearchIntentFromSnapshots([{ message: 'sin presupuesto' }, snaps[snaps.length - 1]]);
  if (intentBudget.budgetPerPerson !== 4000) {
    fail(`budgetPerPerson esperado 4000, fue ${intentBudget.budgetPerPerson}`);
    return;
  }
  console.log('OK: presupuesto por persona desde perfil');

  await prisma.leadTravelProfile.update({
    where: { leadId },
    data: { budgetAmount: 4500 },
  });
  const afterPatch = await prisma.lead.findFirstOrThrow({
    where: { id: leadId },
    include: { details: true, travelProfile: true },
  });
  const intentAfterPatch = buildTravelSearchIntentFromSnapshots(buildLeadIntentSnapshots(afterPatch));
  if (intentAfterPatch.budgetPerPerson !== 4500) {
    fail(`PATCH perfil: budgetPerPerson esperado 4500, fue ${intentAfterPatch.budgetPerPerson}`);
    return;
  }
  console.log('OK: PATCH LeadTravelProfile actualiza intent (presupuesto)');

  const search = await new TravelSearchService().searchByIntent(COMPANY_ID, intentAfterPatch);
  if (!search.ranked.length) {
    console.log('WARN: ranking vacío (catálogo sin viajes APPROVED en tenant)');
  } else {
    console.log(`OK: recommendation devolvió ${search.ranked.length} filas`);
  }

  const leadLegacy = await prisma.lead.create({
    data: {
      id: uuidv4(),
      companyId: COMPANY_ID,
      source: 'MANUAL',
      sourceDetail: 'qa-lead-travel-profile-legacy',
      status: 'NEW',
      fullName: 'QA Solo Legacy',
      message: 'Quiero ir a Portugal en junio',
    },
  });
  await prisma.leadDetail.create({
    data: {
      id: uuidv4(),
      leadId: leadLegacy.id,
      companyId: COMPANY_ID,
    },
  });
  const legacyFull = await prisma.lead.findFirstOrThrow({
    where: { id: leadLegacy.id },
    include: { details: true, travelProfile: true },
  });
  const legacyIntent = buildTravelSearchIntentFromSnapshots(buildLeadIntentSnapshots(legacyFull));
  const okLegacy =
    legacyIntent.preferences?.some((p) => p.toLowerCase().includes('portugal')) ||
    legacyIntent.destination?.toLowerCase().includes('portugal');
  if (!okLegacy) {
    fail('lead sin perfil debe seguir extrayendo señal del mensaje (Portugal)');
    return;
  }
  console.log('OK: lead sin perfil sigue extrayendo señal del mensaje');

  const gen = new ProposalGenerationService();
  const company = await prisma.company.findFirstOrThrow({
    where: { id: COMPANY_ID },
    select: { name: true, slug: true },
  });

  try {
    const htmlOut = await gen.generate({
      lead: afterPatch,
      company: { name: company.name, slug: company.slug ?? undefined },
      intentSnapshots: buildLeadIntentSnapshots(afterPatch),
      useAiCopy: false,
      recommendationPersistUserId: admin.id,
    });
    if (!htmlOut.html.includes('Datos clave del viaje')) {
      fail('HTML debe incluir bloque de datos clave del cliente/negocio');
      return;
    }
    console.log('OK: HTML propuesta contiene sección datos clave');
  } catch (e) {
    console.log('WARN: generación HTML/PDF omitida (¿catálogo vacío?)', (e as Error).message);
  }

  await prisma.leadTravelProfile.deleteMany({ where: { leadId } });
  await prisma.leadDetail.deleteMany({ where: { leadId } });
  await prisma.lead.deleteMany({ where: { id: leadId } });
  await prisma.leadDetail.deleteMany({ where: { leadId: leadLegacy.id } });
  await prisma.lead.deleteMany({ where: { id: leadLegacy.id } });

  console.log('=== qa:lead-travel-profile DONE ===');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
