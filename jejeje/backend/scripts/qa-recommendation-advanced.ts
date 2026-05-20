/**
 * QA recomendación exigente: intents variados + top5 + trustSummary + premiumUx (sin LLM en narrativa).
 * Para auditoría sin OpenAI: exportar antes `OPENAI_ENABLED=false` y `TRAVEL_HYBRID_RETRIEVAL_ENABLED=false`.
 *
 * npm run qa:recommendation-advanced -- --companyId=<uuid>
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import { TravelSearchService } from '../src/services/travel/travel-search.service';
import type { TravelSearchIntent } from '../src/services/travel/travel-search.schema';
import type { TravelSearchResultItem } from '../src/services/travel/travel-search.schema';
import { DEFAULT_DIVERSITY_LAMBDA } from '../src/services/recommendation/constants';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1)?.trim();
}

function parseDestinationGeo(contribs: TravelSearchResultItem['contributions']) {
  const dest = contribs.find((c) => c.factor === 'destination');
  if (!dest) return { destinationPoints: null, destinationMax: null, lexicalPts: null, geoDelta: null };
  const ex = dest.explanation;
  const lex = ex.match(/léxico (\d+)\/(\d+)/i);
  const geo = ex.match(/Δgeo\s*([-\d]+)/);
  return {
    destinationPoints: dest.contribution,
    destinationMax: dest.weight,
    lexicalPts: lex ? parseInt(lex[1], 10) : null,
    geoDelta: geo ? parseInt(geo[1], 10) : null,
  };
}

function factorBreakdown(it: TravelSearchResultItem) {
  const m = new Map(it.contributions.map((c) => [c.factor, { pts: c.contribution, max: c.weight }]));
  const g = parseDestinationGeo(it.contributions);
  return {
    destinationPoints: g.destinationPoints,
    destinationMax: g.destinationMax,
    lexicalDestinationPts: g.lexicalPts,
    geoBonusDelta: g.geoDelta,
    durationPoints: m.get('duration')?.pts ?? null,
    durationMax: m.get('duration')?.max ?? null,
    budgetPoints: m.get('budget')?.pts ?? null,
    budgetMax: m.get('budget')?.max ?? null,
    stylePoints: m.get('ontology_style')?.pts ?? null,
    styleMax: m.get('ontology_style')?.max ?? null,
    keywordsPoints: m.get('keywords')?.pts ?? null,
    keywordsMax: m.get('keywords')?.max ?? null,
    calendarPoints: m.get('calendar')?.pts ?? null,
    semanticPoints: m.get('semanticSimilarity')?.pts ?? null,
    dossierPoints: m.get('dossier_completeness')?.pts ?? null,
  };
}

const CASES: { name: string; intent: TravelSearchIntent; logicHint?: string }[] = [
  {
    name: '1 Argentina cultural premium',
    intent: {
      destination: 'Argentina',
      travelStyleAxes: ['CULTURE'],
      preferences: ['premium'],
      budgetPerPerson: 6000,
      durationDays: 12,
    },
    logicHint: 'Debe preferir circuitos Argentina + cultura; precio alto.',
  },
  {
    name: '2 Patagonia naturaleza lujo',
    intent: {
      destination: 'Patagonia',
      travelStyleAxes: ['NATURE'],
      preferences: ['lujo'],
      budgetPerPerson: 9000,
      durationDays: 12,
    },
    logicHint: 'Patagonia / glaciares / sur.',
  },
  {
    name: '3 Uruguay vino ciudad',
    intent: {
      destination: 'Uruguay',
      travelStyleAxes: ['GASTRONOMY', 'CITY_BREAK'],
      preferences: ['vino'],
      durationDays: 8,
    },
    logicHint: 'Encaje con Uruguay / Montevideo / bodegas.',
  },
  {
    name: '4 Tailandia playa cultura',
    intent: {
      destination: 'Tailandia',
      travelStyleAxes: ['BEACH', 'CULTURE'],
      budgetPerPerson: 3500,
      durationDays: 10,
    },
    logicHint: 'Bangkok + playas / triángulo oro.',
  },
  {
    name: '5 Asia general',
    intent: {
      destination: 'Asia',
      durationDays: 14,
      budgetPerPerson: 4000,
    },
    logicHint: 'Amplio; top debe ser coherente con catálogo Asia.',
  },
  {
    name: '6 Japón cultura gastronomía',
    intent: {
      destination: 'Japón',
      travelStyleAxes: ['CULTURE', 'GASTRONOMY'],
      budgetPerPerson: 5500,
      durationDays: 12,
    },
    logicHint: 'Japón explícito en títulos o destinos.',
  },
  {
    name: '7 Maldivas lujo honeymoon',
    intent: {
      destination: 'Maldivas',
      travelStyleAxes: ['HONEYMOON', 'WELLNESS'],
      preferences: ['lujo'],
      budgetPerPerson: 10000,
      durationDays: 8,
    },
    logicHint: 'Islas / resort; match débil aceptable si catálogo reducido.',
  },
  {
    name: '8 Viaje barato corto',
    intent: { durationDays: 4, budgetPerPerson: 900 },
    logicHint: 'Presupuesto bajo; puede relajar destino.',
  },
  {
    name: '9 Destino inventado',
    intent: { destination: 'Planeta Zargoth' },
    logicHint: 'NO_MATCH o ranking muy bajo; sin vender humo.',
  },
  {
    name: '10 Intent vacío',
    intent: {},
    logicHint: 'NEEDS_CLARIFICATION o WEAK; catálogo general.',
  },
];

async function main() {
  const companyId = arg('--companyId');
  if (!companyId) {
    console.error('Uso: npm run qa:recommendation-advanced -- --companyId=<uuid>');
    process.exit(1);
  }

  const approved = await prisma.travelTrip.count({ where: { companyId, status: 'APPROVED' } });
  if (!approved) {
    console.error('Sin viajes APPROVED.');
    process.exit(2);
  }

  const titles = new Map(
    (await prisma.travelTrip.findMany({ where: { companyId }, select: { id: true, title: true } })).map((x) => [
      x.id,
      x.title,
    ]),
  );

  const svc = new TravelSearchService();

  console.log(JSON.stringify({ diversityLambda: DEFAULT_DIVERSITY_LAMBDA, note: 'MMR diversity; orden previo no expuesto en API' }));

  for (const c of CASES) {
    const t0 = Date.now();
    const res = await svc.searchByIntent(companyId, c.intent, { telemetryVerbose: true });
    const wallMs = Date.now() - t0;

    const tel = res.debug?.telemetry as
      | {
          timingsMs?: Record<string, number>;
          counts?: Record<string, unknown>;
          whyNotSample?: { tripId: string; reasons: string[] }[];
        }
      | undefined;

    const top5 = res.ranked.slice(0, 5).map((it, i) => ({
      rank: i + 1,
      title: titles.get(it.tripId) ?? it.tripId,
      tripId: it.tripId,
      score: it.score,
      matchState: it.matchState,
      confidence: it.confidence,
      relaxedAlternative: it.relaxedAlternative ?? false,
      factors: factorBreakdown(it),
      explanations: it.reasons.slice(0, 10),
      commercialAngle: it.commercialAngle,
    }));

    const titlesTop = top5.map((x) => x.title);
    const dupConcept =
      titlesTop.length !== new Set(titlesTop).size
        ? titlesTop.filter((t, i) => titlesTop.indexOf(t) !== i)
        : [];

    console.log('\n========', c.name, '========');
    console.log('logicHint:', c.logicHint ?? '—');
    console.log('intent:', JSON.stringify(c.intent));
    console.log(
      JSON.stringify(
        {
          tiempo_ms_total: wallMs,
          telemetry_timings_ms: tel?.timingsMs ?? null,
          matchState_global: res.matchState,
          globalConfidence: res.globalConfidence,
          trustSummary: res.trustSummary,
          relaxedAlternatives: res.relaxedAlternatives,
          fallbackHints: res.fallbackHints,
          validationIssues: res.validationIssues,
          criteriaApplied: res.criteriaApplied,
          totalCandidates: res.totalCandidates,
          retrieval_pool: tel?.counts?.retrievalPool,
          afterHardFilters: tel?.counts?.afterHardFilters,
          geoPrefilterActive: tel?.counts?.geoPrefilterActive,
        },
        null,
        2,
      ),
    );
    console.log(
      'premiumUx (reasoning / tradeoffs):',
      JSON.stringify(
        {
          humanReadableReasoning: res.premiumUx.humanReadableReasoning,
          mainTradeoffs: res.premiumUx.mainTradeoffs,
          whyRecommendedBullets: res.premiumUx.whyRecommendedBullets.slice(0, 5),
          confidencePanel_matchHeadline: res.premiumUx.confidencePanel.matchQualityHeadline,
        },
        null,
        2,
      ),
    );
    console.log('TOP 5:', JSON.stringify(top5, null, 2));

    const seemsLogical =
      c.intent.destination === 'Planeta Zargoth'
        ? res.matchState === 'NO_MATCH' || (top5[0]?.score ?? 0) < 70
        : c.intent.destination === 'Uruguay' && top5.length
          ? top5.some((x) => /uruguay|montevideo|colonia/i.test(String(x.title)))
          : top5.length > 0;
    console.log('QA_parece_logico:', seemsLogical, '(heurístico; revisar manualmente)');
    if (dupConcept.length) console.log('⚠️ posible repetición en top5:', dupConcept);

    const rejected = res.debug?.rejectedSample ?? tel?.whyNotSample ?? [];
    if (rejected?.length) {
      const rejTitles = await Promise.all(
        rejected.slice(0, 10).map(async (r) => ({
          title: titles.get(r.tripId) ?? r.tripId,
          reasons: r.reasons,
        })),
      );
      console.log('MUESTRA RECHAZADOS (pipeline):', JSON.stringify(rejTitles, null, 2));
    } else {
      console.log('MUESTRA RECHAZADOS: (vacío en muestra o todos elegibles)');
    }

    const heuristicIssues: string[] = [];
    const absurdDest = c.intent.destination === 'Planeta Zargoth';
    if (absurdDest && res.relaxedAlternatives && top5[0]?.score != null && top5[0].score >= 85) {
      heuristicIssues.push('Destino absurdo pero top1 score muy alto sin relajar sentido');
    }
    if (
      c.intent.destination === 'Uruguay' &&
      top5.length &&
      !top5.some((x) => /uruguay|montevideo/i.test(String(x.title)))
    ) {
      heuristicIssues.push('Intent Uruguay: ningún título top5 menciona Uruguay explícitamente');
    }
    if (heuristicIssues.length) console.log('⚠️ HEURÍSTICA QA:', heuristicIssues);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
