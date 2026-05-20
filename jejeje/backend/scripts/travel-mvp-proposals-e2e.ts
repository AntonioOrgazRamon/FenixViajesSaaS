/**
 * E2E propuestas comerciales (recomendación + persistencia + HTML/PDF + actividad).
 * useAiCopy=false → sin OpenAI para texto comercial.
 *
 * npm run travel:mvp-proposals-e2e -- --companyId=<uuid>
 * npm run travel:mvp-proposals-e2e -- --companyId=<uuid> --dry-run
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import { ProposalService } from '../src/modules/proposals/proposal.service';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1)?.trim();
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

type Scenario = {
  key: string;
  email: string;
  fullName: string;
  intentSnapshot: Record<string, unknown>;
  travelContext: Record<string, unknown>;
};

const SCENARIOS: Scenario[] = [
  {
    key: 'argentina-cultural-premium',
    email: 'mvp-qa-argentina-cultural-premium@invalid.local',
    fullName: 'QA MVP — Argentina cultural premium',
    intentSnapshot: {
      travel: { destination: 'Argentina', durationDays: 12, budgetPerPerson: 6500 },
      travelStyleAxes: ['CULTURE', 'GASTRONOMY'],
      preferences: ['lujo', 'premium'],
    },
    travelContext: { destination: 'Argentina', durationDays: 12, budgetPerPerson: 6500 },
  },
  {
    key: 'patagonia-naturaleza',
    email: 'mvp-qa-patagonia-naturaleza@invalid.local',
    fullName: 'QA MVP — Patagonia naturaleza',
    intentSnapshot: {
      travel: { destination: 'Patagonia', durationDays: 10, budgetPerPerson: 4000 },
      travelStyleAxes: ['NATURE', 'ADVENTURE'],
    },
    travelContext: { destination: 'Patagonia', durationDays: 10 },
  },
  {
    key: 'japon-lujo',
    email: 'mvp-qa-japon-lujo@invalid.local',
    fullName: 'QA MVP — Japón lujo',
    intentSnapshot: {
      travel: { destination: 'Japón', durationDays: 14, budgetPerPerson: 9000 },
      travelStyleAxes: ['CULTURE', 'CITY_BREAK'],
      preferences: ['lujo'],
    },
    travelContext: { destination: 'Japón', durationDays: 14, budgetPerPerson: 9000 },
  },
  {
    key: 'maldivas-honeymoon',
    email: 'mvp-qa-maldivas-honeymoon@invalid.local',
    fullName: 'QA MVP — Maldivas honeymoon',
    intentSnapshot: {
      travel: { destination: 'Maldivas', durationDays: 9, budgetPerPerson: 7000 },
      travelStyleAxes: ['HONEYMOON', 'BEACH'],
    },
    travelContext: { destination: 'Maldivas', durationDays: 9 },
  },
];

async function ensureLead(companyId: string, s: Scenario, dryRun: boolean) {
  const existing = await prisma.lead.findFirst({
    where: { companyId, email: s.email, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    if (!dryRun) {
      await prisma.leadDetail.upsert({
        where: { leadId: existing.id },
        create: {
          leadId: existing.id,
          companyId,
          travelContext: s.travelContext,
        },
        update: { travelContext: s.travelContext },
      });
    }
    return existing.id;
  }
  if (dryRun) {
    console.log(`[dry-run] crearía lead ${s.email}`);
    return null;
  }
  const lead = await prisma.lead.create({
    data: {
      companyId,
      source: 'MANUAL',
      status: 'NEW',
      fullName: s.fullName,
      email: s.email,
      language: 'es',
    },
    select: { id: true },
  });
  await prisma.leadDetail.create({
    data: {
      leadId: lead.id,
      companyId,
      travelContext: s.travelContext,
    },
  });
  return lead.id;
}

async function main() {
  const companyId = arg('--companyId');
  const dryRun = hasFlag('--dry-run');
  const only = arg('--only');
  if (!companyId) {
    console.error(
      'Uso: npm run travel:mvp-proposals-e2e -- --companyId=<uuid> [--dry-run] [--only=<scenario-key>]',
    );
    process.exit(1);
  }

  const scenarios = only ? SCENARIOS.filter((s) => s.key === only) : SCENARIOS;
  if (only && scenarios.length === 0) {
    console.error('No hay escenario con key:', only, 'opciones:', SCENARIOS.map((s) => s.key).join(', '));
    process.exit(1);
  }

  const approved = await prisma.travelTrip.count({ where: { companyId, status: 'APPROVED' } });
  if (!approved) {
    console.error('Sin viajes APPROVED. Ejecute travel:auto-approve primero.');
    process.exit(2);
  }

  const admin = await prisma.user.findFirst({
    where: { companyId, role: 'COMPANY_ADMIN', status: 'ACTIVE' },
    select: { id: true, email: true },
  });
  if (!admin) {
    console.error('Sin COMPANY_ADMIN activo en el tenant.');
    process.exit(3);
  }

  const svc = new ProposalService();

  for (const s of scenarios) {
    console.log('\n=== Escenario:', s.key, '===');
    const leadId = await ensureLead(companyId, s, dryRun);
    if (dryRun || !leadId) continue;

    const t0 = Date.now();
    const out = await svc.generateForLead(companyId, leadId, admin.id, {
      useAiCopy: false,
      intentSnapshot: s.intentSnapshot,
    });
    const ms = Date.now() - t0;

    const v = out.versions[0];
    const acts = await prisma.leadActivity.findMany({
      where: { companyId, leadId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { activityType: true, title: true },
    });

    console.log({
      tiempo_ms: ms,
      proposalId: out.id,
      status: out.status,
      versionNumber: v?.versionNumber,
      html_chars: v?.generatedHtml?.length ?? 0,
      pdfStoragePath: v?.pdfStoragePath ?? null,
      trips_in_version: v?.trips?.length ?? 0,
      activities_head: acts,
    });
  }

  if (dryRun) {
    console.log('\n[dry-run] no se generaron propuestas.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
