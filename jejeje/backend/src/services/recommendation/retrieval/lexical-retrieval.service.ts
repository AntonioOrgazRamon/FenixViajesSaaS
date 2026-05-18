import type { TravelSearchIntent } from '../../travel/travel-search.schema';
import type { TravelTripSearchRow } from '../../travel/travel-search.scoring';
import { normalizeKey, tokenize } from '../../travel/travel-search.scoring';
import { buildIntentEmbeddingQuery } from '../embedding/intent-embedding-query';
import { tripCorpus } from '../scoring.engine';

const K1 = 1.2;
const B = 0.75;

function docTokens(trip: TravelTripSearchRow): string[] {
  const corpus = tripCorpus(trip);
  const raw = normalizeKey(corpus);
  return raw.split('-').filter((t) => t.length >= 2);
}

function queryTokens(intent: TravelSearchIntent): string[] {
  const { query } = buildIntentEmbeddingQuery(intent);
  const fromQuery = tokenize(query);
  if (fromQuery.length) return [...new Set(fromQuery)];
  return [...new Set(tokenize(intent.destination ?? 'viaje'))];
}

export type LexicalHit = {
  tripId: string;
  lexicalScore: number;
  lexicalRank: number;
  matchedTerms: string[];
  provenance: 'bm25';
};

function termFreq(tokens: string[], term: string): number {
  let c = 0;
  for (const t of tokens) if (t === term) c++;
  return c;
}

/**
 * BM25 ligero en memoria (catálogo pequeño/medio; no sustituye Elasticsearch).
 */
export function lexicalRetrieve(
  intent: TravelSearchIntent,
  trips: TravelTripSearchRow[],
): { hits: LexicalHit[]; stats: { avgDocLen: number; queryTerms: number } } {
  const qTerms = [...new Set(queryTokens(intent))];
  if (!qTerms.length) {
    return {
      hits: trips.map((t, i) => ({
        tripId: t.id,
        lexicalScore: 0,
        lexicalRank: i + 1,
        matchedTerms: [],
        provenance: 'bm25' as const,
      })),
      stats: { avgDocLen: 0, queryTerms: 0 },
    };
  }

  const docs = trips.map((t) => ({ id: t.id, tokens: docTokens(t) }));
  const N = docs.length;
  const df = new Map<string, number>();
  for (const term of qTerms) {
    let c = 0;
    for (const d of docs) {
      if (d.tokens.includes(term)) c++;
    }
    df.set(term, c);
  }

  let totalLen = 0;
  for (const d of docs) totalLen += d.tokens.length;
  const avgdl = N ? totalLen / N : 1;

  const scores = docs.map((d) => {
    let s = 0;
    const matched: string[] = [];
    const len = d.tokens.length || 1;
    for (const term of qTerms) {
      const tf = termFreq(d.tokens, term);
      if (tf === 0) continue;
      matched.push(term);
      const nDf = df.get(term) ?? 0;
      const idf = Math.log(1 + (N - nDf + 0.5) / (nDf + 0.5));
      const num = tf * (K1 + 1);
      const den = tf + K1 * (1 - B + (B * len) / avgdl);
      s += idf * (num / den);
    }
    return { id: d.id, score: s, matched };
  });

  scores.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const hits: LexicalHit[] = scores.map((r, idx) => ({
    tripId: r.id,
    lexicalScore: r.score,
    lexicalRank: idx + 1,
    matchedTerms: r.matched,
    provenance: 'bm25',
  }));

  return { hits, stats: { avgDocLen: avgdl, queryTerms: qTerms.length } };
}
