/** Similitud coseno; vectores no nulos, misma dimensión. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  if (d === 0) return 0;
  return Math.max(-1, Math.min(1, dot / d));
}

/** Min-max normalización por lote; si constante, devuelve 0.5 para cada entrada. */
export function minMaxNormalize(scores: number[]): number[] {
  if (!scores.length) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const s of scores) {
    if (s < min) min = s;
    if (s > max) max = s;
  }
  if (max === min) return scores.map(() => 0.5);
  const r = max - min;
  return scores.map((s) => (s - min) / r);
}
