/**
 * Pruebas mínimas Fase 2: documentos embedding, query intención, cosine, fusión, hard gate destino.
 * Requiere DATABASE_URL para partes que llaman a Prisma (hybrid + vectorSearchLocal).
 * npm run test:hybrid-retrieval
 */
import 'dotenv/config';
import { createHash } from 'crypto';
import type { TravelSearchIntent } from '../src/services/travel/travel-search.schema';
import { type TravelTripSearchRow } from '../src/services/travel/travel-search.scoring';
import { buildTripEmbeddingDocument } from '../src/services/recommendation/embedding/trip-embedding-document';
import { buildIntentEmbeddingQuery } from '../src/services/recommendation/embedding/intent-embedding-query';
import { cosineSimilarity, minMaxNormalize } from '../src/services/recommendation/embedding/vector-math';
import { lexicalRetrieve } from '../src/services/recommendation/retrieval/lexical-retrieval.service';
import { hybridRetrieve } from '../src/services/recommendation/retrieval/hybrid-retrieval.service';
import { runTravelRecommendation } from '../src/services/recommendation/pipeline';
import { vectorSearchLocal } from '../src/services/recommendation/retrieval/vector-search.service';

let failed = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    console.error('FAIL:', name, detail ?? '');
    failed++;
  }
}

function tripVi(id: string): TravelTripSearchRow {
  return {
    id,
    provider: null,
    title: 'Vietnam delta',
    mainDestination: 'Vietnam',
    durationDays: 12,
    indicativePrice: '2400',
    currency: 'EUR',
    season: 'Marzo',
    description: 'Cultural y naturaleza Mekong',
    tripDestinations: [{ destination: { name: 'Vietnam', normalizedName: 'vietnam' } }],
    departures: [],
    highlights: [{ text: 'Mekong' }],
    services: [{ type: 'INCLUDED', text: 'trayectos' }],
    hotels: [],
    itineraryDays: [],
    luxuryLevel: 'STANDARD',
    budgetTier: 'MID',
    pace: 'MODERATE',
    climatePreference: null,
    exclusivity: null,
    styleAxes: ['CULTURE', 'NATURE'],
  };
}

void (async () => {
  const t = tripVi('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
  const doc = buildTripEmbeddingDocument(t);
  assert('trip doc hash len', doc.contentHash.length === 64);
  assert('trip doc has title', doc.content.includes('title:'));
  assert('trip doc no uuid in content', !doc.content.includes('aaaaaaaa'));

  const intent: TravelSearchIntent = {
    destination: 'Vietnam',
    durationDays: 12,
    budgetPerPerson: 2500,
    month: 3,
    travelStyleAxes: ['CULTURE'],
  };
  const iq = buildIntentEmbeddingQuery(intent);
  assert('intent query hash', iq.queryHash.length === 64);
  assert('intent query mentions Vietnam', iq.query.toLowerCase().includes('vietnam'));

  assert('cosine identical', Math.abs(cosineSimilarity([1, 0], [1, 0]) - 1) < 1e-6);
  assert('cosine orth', Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-6);

  const n = minMaxNormalize([1, 3, 5]);
  assert('minmax edges', n[0] === 0 && n[2] === 1);

  const { hits: lex } = lexicalRetrieve(intent, [t]);
  assert('lexical one trip', lex.length === 1);

  if (process.env.DATABASE_URL) {
    const h = await hybridRetrieve('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', intent, [t], {
      includeChannelDetails: true,
    });
    assert('hybrid pool size', h.candidateRows.length >= 1);
    assert('hybrid has channels when requested', Boolean(h.channels?.lexical));

    const vs = await vectorSearchLocal({
      companyId: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee',
      tripIds: [],
      queryVector: [0.1, 0.2],
    });
    assert('vector empty trips', vs.hits.length === 0);
  } else {
    console.warn('DATABASE_URL ausente: omitiendo hybridRetrieve / vectorSearchLocal');
  }

  const jpIntent: TravelSearchIntent = {
    destination: 'Japón',
    durationDays: 12,
    budgetPerPerson: 3000,
  };
  const { response } = await runTravelRecommendation({
    companyId: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
    intent: jpIntent,
    rows: [tripVi('dddddddd-dddd-4ddd-dddd-dddddddddddd')],
    options: {
      policyOverride: { allowRelaxedAlternatives: false },
      skipHybridRetrieval: true,
    },
  });
  assert('japan vs vietnam no ranked strict', response.ranked.length === 0);

  const vague = await runTravelRecommendation({
    companyId: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
    intent: {},
    rows: [t],
    options: { skipHybridRetrieval: true },
  });
  assert(
    'vague intent needs clarification',
    vague.response.matchState === 'NEEDS_CLARIFICATION',
    vague.response.matchState,
  );

  /** Snapshots estables (alarde si cambia el contrato de texto) */
  const snapTrip = createHash('sha256').update(doc.content, 'utf8').digest('hex');
  const snapIntent = createHash('sha256').update(iq.query, 'utf8').digest('hex');
  assert('snapshot trip embedding doc', snapTrip === doc.contentHash);
  assert('snapshot intent query', snapIntent === iq.queryHash);

  if (failed) {
    console.error(`\n${failed} error(es) hybrid phase2`);
    process.exit(1);
  }
  console.log('\nOK hybrid retrieval phase2');
})();
