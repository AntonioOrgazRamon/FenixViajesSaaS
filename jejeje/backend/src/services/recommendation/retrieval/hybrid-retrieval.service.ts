import { config } from '../../../common/config';
import { logger } from '../../../common/logger';
import type { TravelSearchIntent } from '../../travel/travel-search.schema';
import type { TravelTripSearchRow, DestinationPointsGeoOpts } from '../../travel/travel-search.scoring';
import { embeddingService } from '../embedding/embedding.service';
import { buildIntentEmbeddingQuery } from '../embedding/intent-embedding-query';
import {
  DEFAULT_LEXICAL_WEIGHT,
  DEFAULT_STRUCTURED_WEIGHT,
  DEFAULT_VECTOR_WEIGHT,
  HYBRID_RETRIEVAL_POOL_CAP,
  HYBRID_RETRIEVAL_PROFILE_VERSION,
} from '../constants';
import { lexicalRetrieve } from './lexical-retrieval.service';
import { structuredRetrieve } from './structured-retrieval.service';
import { minMaxNormalize, vectorSearchLocal } from './vector-search.service';

import type { LexicalHit } from './lexical-retrieval.service';
import type { StructuredHit } from './structured-retrieval.service';
import type { VectorHit } from './vector-search.service';

export type HybridCandidate = {
  tripId: string;
  hybridScore: number;
  lexicalScore: number;
  vectorScore: number;
  structuredScore: number;
  lexicalNorm: number;
  vectorNorm: number;
  structuredNorm: number;
  provenance: 'hybrid';
  retrievalReasons: string[];
};

export type HybridRetrievalResult = {
  candidateRows: TravelTripSearchRow[];
  candidates: HybridCandidate[];
  byTripId: Map<string, HybridCandidate>;
  stats: {
    profileVersion: string;
    poolSize: number;
    catalogSize: number;
    missingEmbeddings: number;
    queryEmbeddingOk: boolean;
    weights: { lexical: number; vector: number; structured: number };
    lexicalMs: number;
    structuredMs: number;
    vectorMs: number;
    embedQueryMs: number;
  };
  warnings: string[];
  channels?: {
    lexical: { hits: LexicalHit[]; stats: { avgDocLen: number; queryTerms: number } };
    structured: StructuredHit[];
    vector: { hits: VectorHit[]; missingEmbeddingTripIds: string[]; model: string };
  };
};

function sumWeights(a: number, b: number, c: number): number {
  return a + b + c;
}

/**
 * Orquestador: structured + lexical + vector → fusión linear sobre scores normalizados.
 */
export async function hybridRetrieve(
  companyId: string,
  intent: TravelSearchIntent,
  rows: TravelTripSearchRow[],
  options?: { includeChannelDetails?: boolean; geoOpts?: DestinationPointsGeoOpts },
): Promise<HybridRetrievalResult> {
  const warnings: string[] = [];
  const catalogSize = rows.length;
  const byId = new Map(rows.map((r) => [r.id, r]));

  let wL = config.TRAVEL_RETRIEVAL_LEXICAL_WEIGHT;
  let wV = config.TRAVEL_RETRIEVAL_VECTOR_WEIGHT;
  let wS = config.TRAVEL_RETRIEVAL_STRUCTURED_WEIGHT;
  const ws = sumWeights(wL, wV, wS);
  if (ws <= 0) {
    wL = DEFAULT_LEXICAL_WEIGHT;
    wV = DEFAULT_VECTOR_WEIGHT;
    wS = DEFAULT_STRUCTURED_WEIGHT;
    warnings.push('Pesos retrieval inválidos; usando defaults.');
  } else {
    wL /= ws;
    wV /= ws;
    wS /= ws;
  }

  const t0 = Date.now();
  const { hits: lexHits, stats: lexStats } = lexicalRetrieve(intent, rows);
  const lexicalMs = Date.now() - t0;

  const t1 = Date.now();
  const structHits = structuredRetrieve(intent, rows, options?.geoOpts);
  const structuredMs = Date.now() - t1;

  const tripIds = rows.map((r) => r.id);
  const lexById = new Map(lexHits.map((h) => [h.tripId, h]));
  const strById = new Map(structHits.map((h) => [h.tripId, h]));

  let queryVector: number[] | null = null;
  let queryEmbeddingOk = false;
  const tEmbed = Date.now();
  try {
    if (config.OPENAI_API_KEY?.trim()) {
      const { query, queryHash } = buildIntentEmbeddingQuery(intent);
      const emb = await embeddingService.embedText(query, `intent:${queryHash}`, { companyId });
      queryVector = emb.vector;
      queryEmbeddingOk = true;
    } else {
      warnings.push('Sin OPENAI_API_KEY: canal vector en retrieval en 0.');
    }
  } catch (e) {
    logger.warn({ err: e, companyId }, 'embedding consulta intención falló; retrieval vector=0');
    warnings.push('Fallo al embeddar intención (OpenAI); canal vector desactivado para este run.');
  }
  const embedQueryMs = Date.now() - tEmbed;

  const tVec = Date.now();
  const {
    hits: vecHits,
    missingEmbeddingTripIds,
    model: vectorModel,
  } = await vectorSearchLocal({
    companyId,
    tripIds,
    queryVector,
  });
  const vectorMs = Date.now() - tVec;
  const vecById = new Map(vecHits.map((h) => [h.tripId, h]));

  if (missingEmbeddingTripIds.length && config.OPENAI_API_KEY?.trim()) {
    warnings.push(
      `${missingEmbeddingTripIds.length} viajes sin embedding para modelo actual; ejecute npm run travel:embed.`,
    );
  }

  const lexRaw = tripIds.map((id) => lexById.get(id)?.lexicalScore ?? 0);
  const vecRaw = tripIds.map((id) => vecById.get(id)?.vectorScore ?? 0);
  const strRaw = tripIds.map((id) => strById.get(id)?.structuredScore ?? 0);

  const lexN = minMaxNormalize(lexRaw);
  const vecN = minMaxNormalize(vecRaw);
  const strN = minMaxNormalize(strRaw);

  const candidates: HybridCandidate[] = tripIds.map((id, i) => {
    const l = lexN[i] ?? 0;
    const v = vecN[i] ?? 0;
    const s = strN[i] ?? 0;
    const hybrid = wL * l + wV * v + wS * s;
    const reasons: string[] = [];
    if (l >= 0.65) reasons.push('Alto encaje léxico (BM25)');
    if (v >= 0.65) reasons.push('Alta similitud semántica (embedding)');
    if (s >= 0.65) reasons.push('Buena alineación estructural (duración/presupuesto/estilo)');
    return {
      tripId: id,
      hybridScore: hybrid,
      lexicalScore: lexRaw[i] ?? 0,
      vectorScore: vecRaw[i] ?? 0,
      structuredScore: strRaw[i] ?? 0,
      lexicalNorm: l,
      vectorNorm: v,
      structuredNorm: s,
      provenance: 'hybrid',
      retrievalReasons: reasons.length ? reasons : ['Fusión híbrida estándar'],
    };
  });

  candidates.sort((a, b) => b.hybridScore - a.hybridScore || a.tripId.localeCompare(b.tripId));

  const top = candidates.slice(0, HYBRID_RETRIEVAL_POOL_CAP);
  const candidateRows = top.map((c) => byId.get(c.tripId)!).filter(Boolean);

  const byTripId = new Map(top.map((c) => [c.tripId, c]));

  const previewLimit = 80;
  const channels = options?.includeChannelDetails
    ? {
        lexical: { hits: lexHits.slice(0, previewLimit), stats: lexStats },
        structured: structHits.slice(0, previewLimit),
        vector: {
          hits: vecHits.slice(0, previewLimit),
          missingEmbeddingTripIds,
          model: vectorModel,
        },
      }
    : undefined;

  return {
    candidateRows,
    candidates: top,
    byTripId,
    stats: {
      profileVersion: HYBRID_RETRIEVAL_PROFILE_VERSION,
      poolSize: candidateRows.length,
      catalogSize,
      missingEmbeddings: missingEmbeddingTripIds.length,
      queryEmbeddingOk,
      weights: { lexical: wL, vector: wV, structured: wS },
      lexicalMs,
      structuredMs,
      vectorMs,
      embedQueryMs,
    },
    warnings,
    ...(channels ? { channels } : {}),
  };
}

/** Igual que hybridRetrieve con detalle por canal (admin / debug). */
export function hybridRetrievalPreview(
  companyId: string,
  intent: TravelSearchIntent,
  rows: TravelTripSearchRow[],
): Promise<HybridRetrievalResult> {
  return hybridRetrieve(companyId, intent, rows, { includeChannelDetails: true });
}
