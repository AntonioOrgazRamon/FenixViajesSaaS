import prisma from '../../../infrastructure/db';
import { config } from '../../../common/config';
import { logger } from '../../../common/logger';
import { cosineSimilarity, minMaxNormalize } from '../embedding/vector-math';

export type VectorHit = {
  tripId: string;
  vectorScore: number;
  vectorRank: number;
  model: string;
  provenance: 'local_cosine' | 'missing_embedding' | 'no_query_vector';
};

/**
 * Búsqueda vectorial in-memory: O(n) por empresa. Apta hasta ~5k vectores en memoria;
 * más volumen → Qdrant/pgvector (misma interfaz de scores).
 */
export async function vectorSearchLocal(params: {
  companyId: string;
  tripIds: string[];
  queryVector: number[] | null;
}): Promise<{
  hits: VectorHit[];
  missingEmbeddingTripIds: string[];
  model: string;
}> {
  const model = config.TRAVEL_EMBEDDING_MODEL;
  let rows: { tripId: string; vector: unknown }[] = [];
  try {
    rows = await prisma.travelTripEmbedding.findMany({
      where: { companyId: params.companyId, model, tripId: { in: params.tripIds } },
      select: { tripId: true, vector: true },
    });
  } catch (e) {
    logger.warn(
      { err: e, companyId: params.companyId },
      'Fallo leyendo travel_trip_embeddings; retrieval vector en 0 (¿migración pendiente?)',
    );
    const sortedIds = [...params.tripIds].sort();
    return {
      hits: sortedIds.map((id, idx) => ({
        tripId: id,
        vectorScore: 0,
        vectorRank: idx + 1,
        model,
        provenance: 'missing_embedding' as const,
      })),
      missingEmbeddingTripIds: [...params.tripIds],
      model,
    };
  }
  const vecByTrip = new Map<string, number[]>();
  for (const r of rows) {
    const v = r.vector as unknown;
    if (Array.isArray(v) && v.every((x) => typeof x === 'number')) {
      vecByTrip.set(r.tripId, v as number[]);
    }
  }

  const missing: string[] = [];
  const sim01 = params.tripIds.map((id) => {
    if (!params.queryVector) {
      return { id, score: 0, prov: 'no_query_vector' as const };
    }
    const tv = vecByTrip.get(id);
    if (!tv || tv.length !== params.queryVector.length) {
      missing.push(id);
      return { id, score: 0, prov: 'missing_embedding' as const };
    }
    const cos = cosineSimilarity(params.queryVector, tv);
    const score = (cos + 1) / 2;
    return { id, score, prov: 'local_cosine' as const };
  });

  const sorted = [...sim01].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const hits: VectorHit[] = sorted.map((r, idx) => ({
    tripId: r.id,
    vectorScore: r.score,
    vectorRank: idx + 1,
    model,
    provenance: r.prov,
  }));

  return { hits, missingEmbeddingTripIds: [...new Set(missing)], model };
}

/** Expone utilidad de normalización para el orquestador híbrido. */
export { minMaxNormalize };
