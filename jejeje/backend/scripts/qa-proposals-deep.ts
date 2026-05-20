/**
 * QA propuestas en profundidad: 8 escenarios (leads mock) + métricas HTML/PDF + actividades.
 * `useAiCopy: false` → sin copy IA (alineado con auditoría sin OpenAI en propuesta).
 *
 * npm run qa:proposals-deep -- --companyId=<uuid>
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../src/infrastructure/db';
import { ProposalService } from '../src/modules/proposals/proposal.service';

function uploadsAbs(...segments: string[]) {
  return path.join(process.cwd(), 'uploads', ...segments);
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1)?.trim();
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
    email: 'qa8-argentina-cultural@invalid.local',
    fullName: 'QA8 — Argentina cultural premium',
    intentSnapshot: {
      travel: { destination: 'Argentina', durationDays: 12, budgetPerPerson: 6000 },
      travelStyleAxes: ['CULTURE'],
      preferences: ['premium'],
    },
    travelContext: { destination: 'Argentina', durationDays: 12, budgetPerPerson: 6000 },
  },
  {
    key: 'patagonia-lujo-naturaleza',
    email: 'qa8-patagonia-lujo@invalid.local',
    fullName: 'QA8 — Patagonia lujo naturaleza',
    intentSnapshot: {
      travel: { destination: 'Patagonia', durationDays: 12, budgetPerPerson: 9000 },
      travelStyleAxes: ['NATURE'],
      preferences: ['lujo'],
    },
    travelContext: { destination: 'Patagonia', durationDays: 12, budgetPerPerson: 9000 },
  },
  {
    key: 'uruguay-vino-ciudad',
    email: 'qa8-uruguay-vino@invalid.local',
    fullName: 'QA8 — Uruguay vino ciudad',
    intentSnapshot: {
      travel: { destination: 'Uruguay', durationDays: 8 },
      travelStyleAxes: ['GASTRONOMY', 'CITY_BREAK'],
      preferences: ['vino'],
    },
    travelContext: { destination: 'Uruguay', durationDays: 8 },
  },
  {
    key: 'tailandia-playa-cultura',
    email: 'qa8-tail-playa@invalid.local',
    fullName: 'QA8 — Tailandia playa cultura',
    intentSnapshot: {
      travel: { destination: 'Tailandia', durationDays: 10, budgetPerPerson: 3500 },
      travelStyleAxes: ['BEACH', 'CULTURE'],
    },
    travelContext: { destination: 'Tailandia', durationDays: 10, budgetPerPerson: 3500 },
  },
  {
    key: 'asia-general',
    email: 'qa8-asia-general@invalid.local',
    fullName: 'QA8 — Asia general',
    intentSnapshot: {
      travel: { destination: 'Asia', durationDays: 14, budgetPerPerson: 4000 },
    },
    travelContext: { destination: 'Asia', durationDays: 14, budgetPerPerson: 4000 },
  },
  {
    key: 'japon-cultura-gastro',
    email: 'qa8-japon-gastro@invalid.local',
    fullName: 'QA8 — Japón cultura gastronomía',
    intentSnapshot: {
      travel: { destination: 'Japón', durationDays: 12, budgetPerPerson: 5500 },
      travelStyleAxes: ['CULTURE', 'GASTRONOMY'],
    },
    travelContext: { destination: 'Japón', durationDays: 12, budgetPerPerson: 5500 },
  },
  {
    key: 'viaje-corto-barato',
    email: 'qa8-corto-barato@invalid.local',
    fullName: 'QA8 — Viaje barato corto',
    intentSnapshot: {
      travel: { durationDays: 4, budgetPerPerson: 900 },
    },
    travelContext: { durationDays: 4, budgetPerPerson: 900 },
  },
  {
    key: 'destino-inventado',
    email: 'qa8-zargoth@invalid.local',
    fullName: 'QA8 — Destino inventado',
    intentSnapshot: {
      travel: { destination: 'Planeta Zargoth', durationDays: 7 },
    },
    travelContext: { destination: 'Planeta Zargoth', durationDays: 7 },
  },
];

async function ensureLead(companyId: string, s: Scenario) {
  const existing = await prisma.lead.findFirst({
    where: { companyId, email: s.email, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    await prisma.leadDetail.upsert({
      where: { leadId: existing.id },
      create: {
        leadId: existing.id,
        companyId,
        travelContext: s.travelContext,
      },
      update: { travelContext: s.travelContext },
    });
    return existing.id;
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

function htmlHeuristic(html: string): Record<string, unknown> {
  const lower = html.toLowerCase();
  const tripSections = (lower.match(/circuito|viaje|día\s*\d/gi) ?? []).length;
  return {
    length: html.length,
    approximateTripMarkers: tripSections,
    hasStrongPrice:
      /\d{3,5}\s*(eur|€|usd|\$)/i.test(html) || /desde\s*\d/i.test(lower),
    repetitiveRisk:
      (html.match(/Argentina Esencial/gi) ?? []).length >= 4 ? 'many_same_title' : 'ok',
  };
}

async function main() {
  const companyId = arg('--companyId');
  if (!companyId) {
    console.error('Uso: npm run qa:proposals-deep -- --companyId=<uuid>');
    process.exit(1);
  }

  const approved = await prisma.travelTrip.count({ where: { companyId, status: 'APPROVED' } });
  if (!approved) {
    console.error('Sin viajes APPROVED.');
    process.exit(2);
  }

  const admin = await prisma.user.findFirst({
    where: { companyId, role: 'COMPANY_ADMIN', status: 'ACTIVE' },
    select: { id: true, email: true },
  });
  if (!admin) {
    console.error('Sin COMPANY_ADMIN activo.');
    process.exit(3);
  }

  const svc = new ProposalService();

  let failed = 0;
  for (const s of SCENARIOS) {
    console.log('\n=== Escenario:', s.key, '===');
    try {
      const leadId = await ensureLead(companyId, s);

      const t0 = Date.now();
      const out = await svc.generateForLead(companyId, leadId, admin.id, {
        useAiCopy: false,
        intentSnapshot: s.intentSnapshot,
      });
      const totalMs = Date.now() - t0;

      const v = out.versions[0];
      const html = v?.generatedHtml ?? '';
      const pdfRel = v?.pdfStoragePath ?? null;
      let pdfBytes: number | null = null;
      if (pdfRel) {
        try {
          const abs = uploadsAbs(pdfRel);
          pdfBytes = fs.statSync(abs).size;
        } catch {
          pdfBytes = null;
        }
      }

      const acts = await prisma.leadActivity.findMany({
        where: { companyId, leadId },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: { activityType: true, title: true, metadata: true },
      });

      const sellerActs = acts.filter((a) => a.activityType === 'SELLER_NOTIFIED');

      const tripsRaw = v?.trips ?? [];
      const tripTitles = tripsRaw.map((t, i) => {
        const pt = t as {
          orderIndex?: number;
          score?: number | null;
          travelTrip?: { title?: string | null; mainDestination?: string | null };
        };
        return {
          order: pt.orderIndex ?? i,
          title: pt.travelTrip?.title ?? '—',
          mainDestination: pt.travelTrip?.mainDestination,
          score: pt.score,
        };
      });

      console.log(
        JSON.stringify(
          {
            tiempo_ms_total_con_finalize_y_smtp: totalMs,
            proposalId: out.id,
            status: out.status,
            versionNumber: v?.versionNumber,
            trips_en_propuesta: tripsRaw.length,
            tripTitles,
            html_heuristic: htmlHeuristic(html),
            pdfStoragePath: pdfRel,
            pdf_bytes: pdfBytes,
          },
          null,
          2,
        ),
      );

      console.log(
        'Actividades (extracto):',
        JSON.stringify(
          acts.map((a) => ({
            type: a.activityType,
            title: a.title,
          })),
          null,
          2,
        ),
      );

      if (sellerActs.length) {
        const meta = sellerActs[0].metadata as Record<string, unknown> | null;
        console.log(
          'SMTP / notificación:',
          JSON.stringify(
            {
              title: sellerActs[0].title,
              metadata_channelResults: meta?.channelResults ?? meta,
            },
            null,
            2,
          ),
        );
      }
    } catch (e) {
      failed++;
      console.error(`\n[ERROR escenario ${s.key}]`, e instanceof Error ? e.message : e);
    }
  }

  if (failed) {
    console.log(`\nResumen: ${failed} escenario(s) fallidos de ${SCENARIOS.length}.`);
    process.exitCode = 1;
  }

  console.log(
    '\nNota: tiempo total incluye recomendación + render HTML/PDF + finalize + envíos SMTP secuenciales por destinatario (8 escenarios).',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
