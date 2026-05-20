/**
 * QA recommendation MVP: sólo catálogo APPROVED, mismos paths que producción.
 *
 * npm run qa:recommendation-mvp -- --companyId=<uuid>
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import { TravelSearchService } from '../src/services/travel/travel-search.service';
import type { TravelSearchIntent } from '../src/services/travel/travel-search.schema';
import type { TravelSearchResultItem } from '../src/services/travel/travel-search.schema';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1)?.trim();
}

function factorMap(it: TravelSearchResultItem) {
  const m: Record<string, number> = {};
  for (const c of it.contributions) {
    m[c.factor] = c.contribution;
  }
  return {
    destination: m.destination ?? null,
    duration: m.duration ?? null,
    budget: m.budget ?? null,
    calendar: m.calendar ?? null,
    keywords: m.keywords ?? null,
    ontology_style: m.ontology_style ?? null,
    semanticSimilarity: m.semanticSimilarity ?? null,
    dossier_completeness: m.dossier_completeness ?? null,
  };
}

const CASES: { name: string; intent: TravelSearchIntent }[] = [
  { name: 'Argentina', intent: { destination: 'Argentina', durationDays: 10, budgetPerPerson: 4000 } },
  { name: 'Patagonia', intent: { destination: 'Patagonia', travelStyleAxes: ['NATURE', 'ADVENTURE'] } },
  { name: 'Uruguay', intent: { destination: 'Uruguay', durationDays: 7 } },
  { name: 'Japón', intent: { destination: 'Japón', durationDays: 12, budgetPerPerson: 4500 } },
  { name: 'Asia', intent: { destination: 'Asia', durationDays: 14 } },
  { name: 'Maldivas', intent: { destination: 'Maldivas', travelStyleAxes: ['BEACH', 'HONEYMOON'] } },
  { name: 'Presupuesto bajo', intent: { durationDays: 7, budgetPerPerson: 1200 } },
  {
    name: 'Lujo',
    intent: {
      destination: 'Argentina',
      budgetPerPerson: 8000,
      preferences: ['lujo', 'hoteles boutique'],
    },
  },
  { name: 'Naturaleza', intent: { destination: 'Argentina', travelStyleAxes: ['NATURE'] } },
  {
    name: 'Gastronomía',
    intent: { destination: 'Argentina', travelStyleAxes: ['GASTRONOMY', 'CULTURE'] },
  },
  { name: 'Luna de miel', intent: { travelStyleAxes: ['HONEYMOON'], preferences: ['playa'] } },
];

async function main() {
  const companyId = arg('--companyId');
  if (!companyId) {
    console.error('Uso: npm run qa:recommendation-mvp -- --companyId=<uuid>');
    process.exit(1);
  }

  const approved = await prisma.travelTrip.count({ where: { companyId, status: 'APPROVED' } });
  if (!approved) {
    console.error('No hay viajes APPROVED. Ejecute npm run travel:auto-approve antes.');
    process.exit(2);
  }

  const svc = new TravelSearchService();

  for (const c of CASES) {
    const t0 = Date.now();
    const res = await svc.searchByIntent(companyId, c.intent);
    const ms = Date.now() - t0;

    const titles = new Map(
      (await prisma.travelTrip.findMany({ where: { companyId }, select: { id: true, title: true } })).map(
        (x) => [x.id, x.title],
      ),
    );

    const top5 = res.ranked.slice(0, 5).map((it, i) => ({
      rank: i + 1,
      title: titles.get(it.tripId) ?? it.tripId,
      tripId: it.tripId,
      score: it.score,
      matchState: it.matchState,
      confidence: it.confidence,
      factors: factorMap(it),
      explanations: it.reasons.slice(0, 6),
      commercialAngle: it.commercialAngle,
    }));

    console.log('\n========', c.name, '========');
    console.log({
      tiempo_ms: ms,
      matchState_global: res.matchState,
      globalConfidence: res.globalConfidence,
      relaxedAlternatives: res.relaxedAlternatives,
      fallbackHints: res.fallbackHints,
      validationIssues: res.validationIssues,
      picks: {
        recommended: res.picks.recommended?.tripId,
        budget: res.picks.budget?.tripId,
        luxury: res.picks.luxury?.tripId,
        alternative: res.picks.alternative?.tripId,
      },
    });
    console.log('TOP 5:', JSON.stringify(top5, null, 2));

    const titlesTop = top5.map((x) => x.title);
    const dupTitles = titlesTop.filter((t, i) => titlesTop.indexOf(t) !== i);
    if (dupTitles.length) console.log('⚠ posible falta diversidad (título repetido en top5):', dupTitles);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
