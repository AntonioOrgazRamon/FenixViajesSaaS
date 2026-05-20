/**
 * Auditoría funcional travel + geo + recommendation + proposals (solo lectura en catálogo).
 * Sin embeddings Fase 2 obligatorios; sin llamadas OpenAI si no hay API key (vector=0).
 *
 * Uso:
 *   QA_AUDIT_COMPANY_ID=<uuid> npx ts-node --transpile-only scripts/qa-full-travel-audit.ts
 *
 * Opcional:
 *   QA_AUDIT_PERSIST_PROPOSAL=1   — persiste 1 propuesta (caso 1) vía ProposalService + notificación
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import { config } from '../src/common/config';
import { GeoPlaceService } from '../src/services/geo/geo-place.service';
import { TripGeoRetrievalService } from '../src/services/geo/trip-geo-retrieval.service';
import type { TravelSearchResponse } from '../src/services/travel/travel-search.schema';
import { runTravelRecommendation } from '../src/services/recommendation/pipeline';
import type { TravelTripSearchRow, DestinationPointsGeoOpts } from '../src/services/travel/travel-search.scoring';
import type { TravelSearchIntent } from '../src/services/travel/travel-search.schema';
import { enrichTripSearchRowsWithGeoPlaces } from '../src/services/geo/geo-search-rows';
import { lexicalRetrieve } from '../src/services/recommendation/retrieval/lexical-retrieval.service';
import { structuredRetrieve } from '../src/services/recommendation/retrieval/structured-retrieval.service';
import { hybridRetrievalPreview } from '../src/services/recommendation/retrieval/hybrid-retrieval.service';
import { destinationPoints } from '../src/services/recommendation/scoring.engine';
import {
  mapTripRowDbToSearchRow,
  travelSearchTripSelect,
} from '../src/services/travel/travel-search.service';
import { ProposalGenerationService } from '../src/services/proposals/proposal-generation.service';
import { ProposalService } from '../src/modules/proposals/proposal.service';
import {
  classifyTravelJsonTrip,
  coerceTravelImportRootToEnriched,
} from '../src/services/travel/travel-json-import-validation';
import { travelJsonEnrichedFileZ } from '../src/services/travel/travel-json-import.schema';
import fs from 'fs';
import path from 'path';

function hr(title: string) {
  console.log(`\n${'='.repeat(14)} ${title} ${'='.repeat(14)}\n`);
}

function section(title: string) {
  console.log(`\n--- ${title} ---\n`);
}

async function runAuditRecommendation(
  companyId: string,
  intent: TravelSearchIntent,
  enrichedRows: TravelTripSearchRow[],
): Promise<TravelSearchResponse> {
  const company = await prisma.company.findFirst({
    where: { id: companyId },
    select: { recommendationPolicy: true },
  });

  let geoScoringContext: DestinationPointsGeoOpts | undefined;
  let nonRelaxedCandidateRows: TravelTripSearchRow[] | undefined;

  if (config.TRAVEL_GEO_RETRIEVAL_ENABLED && intent.destination?.trim()) {
    const plan = await new TripGeoRetrievalService().plan(companyId, intent.destination);
    geoScoringContext = plan.scoringContext;
    if (plan.usePrefilter && plan.candidateTripIds?.size && plan.scoringContext) {
      nonRelaxedCandidateRows = enrichedRows.filter(
        (r) => plan.candidateTripIds!.has(r.id) || !plan.tripsWithGeoLinkIds.has(r.id),
      );
    }
  }

  const { response } = await runTravelRecommendation({
    companyId,
    intent,
    rows: enrichedRows,
    options: {
      companyPolicyJson: company?.recommendationPolicy ?? undefined,
      telemetryVerbose: true,
      geoScoringContext,
      nonRelaxedCandidateRows,
    },
  });

  return response;
}

async function resolveCompanyId(): Promise<{ id: string; name: string }> {
  const envId = process.env.QA_AUDIT_COMPANY_ID?.trim();
  if (envId) {
    const c = await prisma.company.findFirst({ where: { id: envId }, select: { id: true, name: true } });
    if (!c) throw new Error(`QA_AUDIT_COMPANY_ID no existe: ${envId}`);
    return c;
  }
  const grouped = await prisma.travelTrip.groupBy({
    by: ['companyId'],
    _count: { _all: true },
  });
  if (!grouped.length) throw new Error('No hay ningún TravelTrip en la base de datos.');
  grouped.sort((a, b) => b._count._all - a._count._all);
  const id = grouped[0]!.companyId;
  const c = await prisma.company.findFirst({ where: { id }, select: { id: true, name: true } });
  return c!;
}

const MOCK_CASES: { name: string; intent: TravelSearchIntent }[] = [
  {
    name: 'Caso 1 Argentina cultura+gastro+budget',
    intent: {
      destination: 'Argentina',
      durationDays: 10,
      budgetPerPerson: 5000,
      travelStyleAxes: ['CULTURE', 'GASTRONOMY'],
    },
  },
  {
    name: 'Caso 2 Argentina naturaleza+budget',
    intent: {
      destination: 'Argentina',
      travelStyleAxes: ['NATURE'],
      budgetPerPerson: 3000,
    },
  },
  {
    name: 'Caso 3 Uruguay vino+ciudad',
    intent: {
      destination: 'Uruguay',
      travelStyleAxes: ['GASTRONOMY', 'CITY_BREAK'],
    },
  },
  {
    name: 'Caso 4 Patagonia naturaleza+aventura',
    intent: {
      destination: 'Patagonia',
      travelStyleAxes: ['NATURE', 'ADVENTURE'],
    },
  },
  {
    name: 'Caso 5 Buenos Aires ciudad+cultura',
    intent: {
      destination: 'Buenos Aires',
      travelStyleAxes: ['CITY_BREAK', 'CULTURE'],
    },
  },
  {
    name: 'Caso 6 Japón',
    intent: { destination: 'Japón' },
  },
  {
    name: 'Caso 7 Asia',
    intent: { destination: 'Asia' },
  },
  {
    name: 'Caso 8 Luna de miel + lujo (preferencias)',
    intent: {
      travelStyleAxes: ['HONEYMOON'],
      preferences: ['Lujo'],
    },
  },
  {
    name: 'Caso 9 Solo duración + presupuesto',
    intent: { durationDays: 5, budgetPerPerson: 1000 },
  },
  {
    name: 'Caso 10 Destino inventado',
    intent: { destination: 'sitio inventado raro xyz123' },
  },
];

function summarizeItem(it: {
  tripId: string;
  score: number;
  matchState: string;
  confidence: number | null;
  contributions: { factor: string; contribution: number }[];
  matches: string[];
  misses: string[];
  reasons: string[];
  retrievalProvenance?: { hybridScore: number; structuredNorm: number; lexicalNorm: number };
  constraintViolations?: { code: string; kind: string; message: string }[];
}) {
  const topContrib = [...it.contributions].sort((a, b) => b.contribution - a.contribution).slice(0, 6);
  return {
    tripId: it.tripId,
    score: it.score,
    matchState: it.matchState,
    confidence: it.confidence,
    topContributions: topContrib.map((c) => `${c.factor}:${c.contribution.toFixed(1)}`),
    matches: it.matches.slice(0, 4),
    misses: it.misses.slice(0, 3),
    reasonsHead: it.reasons.slice(0, 4),
    retrieval: it.retrievalProvenance
      ? {
          hybrid: it.retrievalProvenance.hybridScore.toFixed(3),
          structuredN: it.retrievalProvenance.structuredNorm.toFixed(3),
          lexicalN: it.retrievalProvenance.lexicalNorm.toFixed(3),
        }
      : null,
    constraints: (it.constraintViolations ?? []).slice(0, 3),
  };
}

async function main() {
  hr('CONFIGURACIÓN EFECTIVA (runtime)');
  console.log({
    TRAVEL_GEO_RETRIEVAL_ENABLED: config.TRAVEL_GEO_RETRIEVAL_ENABLED,
    TRAVEL_HYBRID_RETRIEVAL_ENABLED: config.TRAVEL_HYBRID_RETRIEVAL_ENABLED,
    OPENAI_API_KEY_presente: Boolean(config.OPENAI_API_KEY?.trim()),
    SMTP_HOST: config.SMTP_HOST ?? null,
    EMAIL_FROM: config.EMAIL_FROM ?? null,
  });

  const company = await resolveCompanyId();
  console.log('\nTenant auditoría:', company);

  hr('FASE 1 — CATÁLOGO (tenant)');
  const cid = company.id;

  const totalTrips = await prisma.travelTrip.count({ where: { companyId: cid } });
  const approved = await prisma.travelTrip.count({ where: { companyId: cid, status: 'APPROVED' } });
  const pending = await prisma.travelTrip.count({ where: { companyId: cid, status: 'PENDING_REVIEW' } });
  const withDestRel = await prisma.travelTrip.count({
    where: { companyId: cid, tripDestinations: { some: {} } },
  });
  const withTripGeo = await prisma.travelTrip.count({
    where: { companyId: cid, tripGeoPlaces: { some: {} } },
  });
  const geoPlaceCount = await prisma.geoPlace.count({ where: { companyId: cid } });
  const tripGeoPlaceCount = await prisma.tripGeoPlace.count({
    where: { trip: { companyId: cid } },
  });
  const withItinerary = await prisma.travelTrip.count({
    where: { companyId: cid, itineraryDays: { some: {} } },
  });
  const withHighlights = await prisma.travelTrip.count({
    where: { companyId: cid, highlights: { some: {} } },
  });
  const withHotels = await prisma.travelTrip.count({
    where: { companyId: cid, hotels: { some: {} } },
  });
  const withPrice = await prisma.travelTrip.count({
    where: { companyId: cid, indicativePrice: { not: null } },
  });

  console.log({
    totalTravelTrip: totalTrips,
    APPROVED: approved,
    PENDING_REVIEW: pending,
    con_al_menos_un_Destination_via_TripDestination: withDestRel,
    con_TripGeoPlace: withTripGeo,
    geoPlaces_totales_tenant: geoPlaceCount,
    tripGeoPlace_filas: tripGeoPlaceCount,
    con_itineraryDays: withItinerary,
    con_highlights: withHighlights,
    con_hotels: withHotels,
    con_indicativePrice: withPrice,
  });

  const orphanGeoPlaces = await prisma.geoPlace.count({
    where: { companyId: cid, tripGeoPlaces: { none: {} } },
  });
  console.log('\nGeoPlaces sin ningún TripGeoPlace (tenant):', orphanGeoPlaces);

  const dupSlugRows = await prisma.$queryRaw<Array<{ import_slug: string; c: bigint }>>`
    SELECT import_slug, COUNT(*) AS c FROM travel_trips
    WHERE company_id = ${cid} AND import_slug IS NOT NULL
    GROUP BY import_slug HAVING c > 1 LIMIT 20`;
  console.log('\nimportSlug duplicados:', dupSlugRows.length ? dupSlugRows : 'ninguno');

  const dupTitles = await prisma.$queryRaw<Array<{ title: string; c: bigint }>>`
    SELECT title, COUNT(*) AS c FROM travel_trips
    WHERE company_id = ${cid}
    GROUP BY title HAVING c > 1 LIMIT 15`;
  console.log('\nTítulos duplicados (muestra):', dupTitles);

  const absurdDur = await prisma.travelTrip.count({
    where: {
      companyId: cid,
      OR: [{ durationDays: { lt: 1 } }, { durationDays: { gt: 90 } }, { durationDays: null }],
    },
  });
  console.log('\nViajes con durationDays null, <1 o >90:', absurdDur);

  const noMainDest = await prisma.travelTrip.count({
    where: {
      companyId: cid,
      OR: [{ mainDestination: null }, { mainDestination: '' }],
    },
  });
  console.log('Sin mainDestination útil:', noMainDest);

  const noCountry = await prisma.travelTrip.count({
    where: {
      companyId: cid,
      tripDestinations: { none: { destination: { type: 'COUNTRY' } } },
    },
  });
  const noCity = await prisma.travelTrip.count({
    where: {
      companyId: cid,
      tripDestinations: { none: { destination: { type: 'CITY' } } },
    },
  });
  console.log('Sin país (Destination COUNTRY):', noCountry);
  console.log('Sin ciudad (Destination CITY):', noCity);

  hr('FASE 2 — GEO RETRIEVAL + CANALES LEXICAL/STRUCTURED/HÍBRIDO');

  const approvedCountForMotor = await prisma.travelTrip.count({
    where: { companyId: cid, status: 'APPROVED' },
  });
  const motorStatus =
    approvedCountForMotor > 0
      ? ({ status: 'APPROVED' as const } as const)
      : ({
          status: 'PENDING_REVIEW' as const,
        } as const);
  if (approvedCountForMotor === 0) {
    console.warn(
      '\n⚠️  APPROVED=0 para este tenant: el motor de recomendación en PRODUCCIÓN sólo usa APPROVED.\n' +
        '    Esta auditoría usará PENDING_REVIEW sólo para ejercitar scoring/retrieval con datos reales.\n' +
        '    Aprueba viajes para alinear QA con el comportamiento del endpoint público.\n',
    );
  }

  const tripsDb = await prisma.travelTrip.findMany({
    where: { companyId: cid, ...motorStatus },
    select: travelSearchTripSelect,
  });
  let rows = tripsDb.map(mapTripRowDbToSearchRow);
  await enrichTripSearchRowsWithGeoPlaces(cid, rows);

  const geoQueries = [
    'Argentina',
    'Uruguay',
    'Buenos Aires',
    'Patagonia',
    'Iguazú',
    'Montevideo',
    'Asia',
    'Japón',
    'Tokio',
    'destino-totalmente-inventario-xyz',
  ];

  const geoSvc = new GeoPlaceService();
  const tripGeoSvc = new TripGeoRetrievalService();

  for (const q of geoQueries) {
    section(`Consulta: "${q}"`);
    const tGeo0 = Date.now();
    const plan = await tripGeoSvc.plan(cid, q);
    const geoMs = Date.now() - tGeo0;

    let resolvedNames: string[] = [];
    const tRes = Date.now();
    try {
      const resolved = await geoSvc.resolveIntentToGeoPlaces(cid, q);
      resolvedNames = resolved.slice(0, 8).map((p) => `${p.canonicalName}(${p.kind})`);
    } catch (e) {
      resolvedNames = [`ERROR: ${String(e)}`];
    }
    const resolveMs = Date.now() - tRes;

    const intentMini: TravelSearchIntent = { destination: q };
    const lex = lexicalRetrieve(intentMini, rows);
    const str = structuredRetrieve(intentMini, rows, plan.scoringContext);
    const tHyb = Date.now();
    const hyb = await hybridRetrievalPreview(cid, intentMini, rows);
    const hybMs = Date.now() - tHyb;

    const lexTop = [...lex.hits].sort((a, b) => b.lexicalScore - a.lexicalScore).slice(0, 5);
    const strTop = [...str].sort((a, b) => b.structuredScore - a.structuredScore).slice(0, 5);
    const rowById = new Map(rows.map((r) => [r.id, r]));

    console.log({
      geo_prefilter_active: plan.usePrefilter,
      geo_notes: plan.notes,
      geo_plan_ms: geoMs,
      resolveIntent_ms: resolveMs,
      geo_places_resueltos: resolvedNames,
      candidatos_prefiltro_geo: plan.candidateTripIds?.size ?? null,
      hybrid_preview_ms: hybMs,
      hybrid_warnings: hyb.warnings,
      hybrid_stats: hyb.stats,
    });

    console.log(
      'structured TOP:',
      strTop.map((h) => ({
        tripId: h.tripId,
        score: h.structuredScore,
        title: rowById.get(h.tripId)?.title?.slice(0, 60),
      })),
    );
    console.log(
      'lexical TOP:',
      lexTop.map((h) => ({
        tripId: h.tripId,
        score: h.lexicalScore,
        title: rowById.get(h.tripId)?.title?.slice(0, 60),
      })),
    );
    console.log(
      'hybrid TOP:',
      hyb.candidates.slice(0, 5).map((c) => ({
        tripId: c.tripId,
        hybrid: c.hybridScore.toFixed(4),
        title: rowById.get(c.tripId)?.title?.slice(0, 55),
      })),
    );
  }

  hr('FASE 3 — RECOMMENDATION (pipeline + telemetry; mismo pool que Fase 2)');

  for (const c of MOCK_CASES) {
    section(c.name);
    const t0 = Date.now();
    const res = await runAuditRecommendation(cid, c.intent, rows);
    const ms = Date.now() - t0;

    const tripTitle = async (id: string) =>
      (await prisma.travelTrip.findFirst({ where: { id }, select: { title: true } }))?.title ?? id;

    const rankedHead = await Promise.all(
      res.ranked.slice(0, 8).map(async (it) => ({
        title: await tripTitle(it.tripId),
        ...summarizeItem(it),
      })),
    );

    console.log({
      tiempo_ms: ms,
      matchState_global: res.matchState,
      globalConfidence: res.globalConfidence,
      relaxedAlternatives: res.relaxedAlternatives,
      totalCandidates: res.totalCandidates,
      ranked_returned: res.ranked.length,
      validationIssues: res.validationIssues,
      fallbackHints: res.fallbackHints,
      picks: {
        recommended: res.picks.recommended
          ? { tripId: res.picks.recommended.tripId, score: res.picks.recommended.score }
          : null,
        budget: res.picks.budget ? { tripId: res.picks.budget.tripId } : null,
        luxury: res.picks.luxury ? { tripId: res.picks.luxury.tripId } : null,
        alternative: res.picks.alternative ? { tripId: res.picks.alternative.tripId } : null,
      },
    });

    console.log('TOP ranking (detalle):');
    console.log(JSON.stringify(rankedHead, null, 2));

    const tel = res.debug?.telemetry as Record<string, unknown> | undefined;
    if (tel) {
      console.log('\nTelemetry (timings + retrieval + muestra rechazos):');
      console.log(
        JSON.stringify(
          {
            timingsMs: tel.timingsMs,
            counts: tel.counts,
            retrieval: tel.retrieval,
            whyNotSample: (tel.whyNotSample as unknown[])?.slice(0, 6),
          },
          null,
          2,
        ),
      );
    }

    // destinationPoints explícitos para el #1 si hay destino en intent
    if (c.intent.destination?.trim() && res.ranked[0]) {
      const topRow = rows.find((r) => r.id === res.ranked[0]!.tripId);
      if (topRow) {
        const plan = await tripGeoSvc.plan(cid, c.intent.destination);
        const pts = destinationPoints(c.intent.destination, topRow, plan.scoringContext);
        console.log('\ndestinationPoints (top1 vs intent):', pts);
      }
    }
  }

  hr('FASE 4 — PROPUESTAS (HTML/PDF determinista, useAiCopy efectivo false)');
  const lead = await prisma.lead.findFirst({
    where: { companyId: cid, deletedAt: null },
    include: { details: true },
  });
  const admin = await prisma.user.findFirst({
    where: { companyId: cid, role: 'COMPANY_ADMIN', status: 'ACTIVE' },
    select: { id: true },
  });

  const genSvc = new ProposalGenerationService();
  const proposalCases = [
    {
      label: 'Propuesta caso 1',
      snapshots: [
        {
          travel: { destination: 'Argentina', durationDays: 10, budgetPerPerson: 5000 },
          travelStyleAxes: ['CULTURE', 'GASTRONOMY'],
        },
      ],
    },
    {
      label: 'Propuesta caso 2',
      snapshots: [
        {
          travel: { destination: 'Argentina', budgetPerPerson: 3000 },
          travelStyleAxes: ['NATURE'],
        },
      ],
    },
    {
      label: 'Propuesta caso 5',
      snapshots: [
        {
          travel: { destination: 'Buenos Aires' },
          travelStyleAxes: ['CITY_BREAK', 'CULTURE'],
        },
      ],
    },
  ];

  if (approvedCountForMotor === 0) {
    console.log(
      '\n⚠️ FASE 4 omitida: el motor de propuestas (TravelSearchService interno) sólo considera viajes APPROVED.\n' +
        '   Aprueba al menos un viaje para validar HTML/PDF/notificación en este entorno.\n',
    );
  } else if (!lead) {
    console.log('Sin Lead en tenant: se omiten pruebas ProposalGenerationService que requieren lead.');
  } else {
    for (const pc of proposalCases) {
      section(pc.label);
      const t0 = Date.now();
      const out = await genSvc.generate({
        lead,
        company: { name: company.name, slug: undefined },
        intentSnapshots: pc.snapshots,
        useAiCopy: false,
      });
      const ms = Date.now() - t0;
      console.log({
        tiempo_ms: ms,
        html_chars: out.html.length,
        pdf_bytes: out.pdfBuffer?.length ?? null,
        picks_scores: {
          rec: out.search.picks.recommended?.score,
          budget: out.search.picks.budget?.score,
          luxury: out.search.picks.luxury?.score,
          alt: out.search.picks.alternative?.score,
        },
      });
      console.log('HTML head (300 chars):', out.html.slice(0, 300).replace(/\s+/g, ' '));
    }
  }

  if (
    approvedCountForMotor > 0 &&
    process.env.QA_AUDIT_PERSIST_PROPOSAL === '1' &&
    lead &&
    admin
  ) {
    section('Persistencia ProposalVersion + activity (caso 1) — QA_AUDIT_PERSIST_PROPOSAL=1');
    const t0 = Date.now();
    const proposalSvc = new ProposalService();
    const persisted = await proposalSvc.generateForLead(cid, lead.id, admin.id, {
      useAiCopy: false,
      intentSnapshot: {
        travel: { destination: 'Argentina', durationDays: 10, budgetPerPerson: 5000 },
        travelStyleAxes: ['CULTURE', 'GASTRONOMY'],
      },
    });
    console.log({
      tiempo_ms: Date.now() - t0,
      proposalId: persisted.id,
      status: persisted.status,
      latestVersion: persisted.versions[0]
        ? {
            versionNumber: persisted.versions[0].versionNumber,
            hasHtml: Boolean(persisted.versions[0].generatedHtml?.length),
            pdfPath: persisted.versions[0].pdfStoragePath,
          }
        : null,
    });
  } else {
    console.log(
      '\n(Opcional) Persistencia BD + notificación: definir QA_AUDIT_PERSIST_PROPOSAL=1 y tener lead + COMPANY_ADMIN.',
    );
  }

  hr('FASE 5 — IMPORT JSON (clasificación en memoria, fixture)');
  try {
    const fixturePath = path.join(process.cwd(), 'fixtures/travel-import-sample.json');
    if (fs.existsSync(fixturePath)) {
      const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as unknown[];
      const parsed = travelJsonEnrichedFileZ.safeParse(raw);
      console.log('Fixture items:', parsed.success ? parsed.data.length : parsed.error.message);
      if (parsed.success) {
        for (let i = 0; i < Math.min(4, parsed.data.length); i++) {
          const item = parsed.data[i]!;
          const coerced = coerceTravelImportRootToEnriched(item);
          const cls = classifyTravelJsonTrip(coerced);
          console.log(`\nÍtem ${i}: status=${cls.status} warnings=${cls.warnings.length} errors=${cls.errors.length}`);
          console.log('errors:', cls.errors);
          console.log('warnings:', cls.warnings.slice(0, 6));
        }
      }
    } else {
      console.log('No existe fixtures/travel-import-sample.json');
    }
  } catch (e) {
    console.log('Fase 5 fixture skip:', String(e));
  }

  hr('FASE 7 — RESUMEN EJECUTIVO (subjetivo post-run)');
  console.log(`
Califica manualmente tras revisar salida anterior:

# Estado general
(elige) roto | usable | bastante sólido | muy sólido

# Pavos (0–10 sugeridos si hybrid/geo apagados en .env)
- Recommendation engine: sin vector fuerte depende de lexical+structured+reglas.
- Geo retrieval: si TRAVEL_GEO_RETRIEVAL_ENABLED=false, aporta sólo enriquecimiento de filas / scoring parcial.
- Calidad catálogo: coherencia destinos/precios/itinerario de Fase 1.
- Importador JSON: validación Zod + normalización ChatGPT.
- Proposal generation: HTML determinista siempre; PDF depende de puppeteer/entorno.
- Arquitectura backend: pipeline explícito telemetry + capas separadas.

# Riesgos
- OPENAI_API_KEY presente → hybrid retrieval puede llamar embed query (coste).
- Sin SMTP configurado → finalize notification puede fallar silenciosamente o sólo log.

# Qué probar después (≤10)
1. Activar TRAVEL_GEO_RETRIEVAL_ENABLED en staging y repetir Fase 2.
2. Pilot TRAVEL_HYBRID_RETRIEVAL_ENABLED + embeddings para comparar ranking.
3. Prueba carga con catálogo 500+ viajes (pool hybrid).
4. Auditar duplicate titles en datos reales (negocio).
5. Contract test API público /travel/search vs servicio.
6. PruebaProposal con useAiCopy true bajo presupuesto OpenAI.
7. Lead sin país/ciudad en CRM → scoring sólo presupuesto/duración.
8. Multi-tenant isolation (companyId cruzado).
9. PDF en CI Linux vs Windows (puppeteer).
10. Índices DB recommendation_runs / proposal_versions por volumen.
`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
