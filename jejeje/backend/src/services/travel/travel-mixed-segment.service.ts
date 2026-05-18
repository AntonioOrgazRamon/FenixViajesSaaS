/**
 * Detección y división de segmentos que mezclan 2+ fichas de viaje en un solo bloque de texto.
 */

import { extractTripTitle, extractTitleLineCandidate, normalizeTitleLine } from './trip-segmentation-icarion';

export type MixedSegmentAnalysis = {
  likelyMixed: boolean;
  reasons: string[];
  serviciosBlocks: number;
  precioBlocks: number;
  dayOneStarts: number;
  strongTitles: number;
};

function countRe(re: RegExp, text: string): number {
  return (text.match(re) ?? []).length;
}

/**
 * Señales heurísticas de mezcla (sin listas por PDF concreto).
 */
export function analyzeMixedSegment(text: string): MixedSegmentAnalysis {
  const reasons: string[] = [];
  const serviciosBlocks = countRe(/\bSERVICIOS\s+INCLUIDOS\b/gi, text);
  const precioBlocks = countRe(/\bPRECIO\s+ORIENTATIVO\b/gi, text);
  const dayOneStarts = countRe(/\bD[ÍI]A\s*1\b/gi, text);

  let strongTitles = 0;
  for (const block of text.split(/\n---\n/g)) {
    const h = extractTitleLineCandidate(block) ?? extractTripTitle(block);
    if (h && h.length >= 8 && h.length < 120) {
      strongTitles++;
    }
  }
  if (serviciosBlocks >= 2) reasons.push('multiple_servicios_incluidos');
  if (precioBlocks >= 2) reasons.push('multiple_precio_orientativo');
  if (dayOneStarts >= 2 && precioBlocks >= 1) reasons.push('multiple_dia1_con_precio');
  if (strongTitles >= 2 && precioBlocks >= 2) reasons.push('titulos_multiples_y_precios');

  const likelyMixed =
    (serviciosBlocks >= 2 && precioBlocks >= 2) ||
    (dayOneStarts >= 2 && serviciosBlocks >= 2) ||
    (strongTitles >= 2 && precioBlocks >= 2);

  return { likelyMixed, reasons, serviciosBlocks, precioBlocks, dayOneStarts, strongTitles };
}

/**
 * Tras el primer precio orientativo, un bloque "título de producto + duración n/m" suele abrir el siguiente viaje.
 */
export function findSecondTripSplitIndex(text: string): number | null {
  const fp = text.search(/\bPRECIO\s+ORIENTATIVO\b/i);
  if (fp < 0) return null;
  const afterPrice = text.slice(fp);
  const blockAfterPrice = /\n\s*([A-ZÁÉÍÚÑ0-9][^\n]{6,95})\s*\n\s*(\d{1,2}\s*\/\s*\d{1,2})\b/;
  const m0 = blockAfterPrice.exec(afterPrice);
  if (m0 && m0.index != null) {
    const idx = fp + m0.index + 1;
    if (idx >= 40 && idx < text.length - 40) return idx;
  }
  const tail = text.slice(fp + 1);
  const re = /\bD[ÍI]A\s*1\b[^\n]*?\b(?:CIUDAD\s+DE\s+ORIGEN|ciudad\s+de\s+origen)\b/i;
  const m = re.exec(tail);
  if (!m || m.index == null) return null;
  const idx = fp + 1 + m.index;
  if (idx < 40 || idx > text.length - 40) return null;
  return idx;
}

/**
 * Parte un texto largo en varios trozos en límites de segundo viaje; si no aplica, devuelve [text].
 */
export function splitSegmentByTripBoundaries(text: string): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  let iter = 0;
  while (rest.length > 0 && iter++ < 8) {
    const split = findSecondTripSplitIndex(rest);
    if (split == null || split <= 0) {
      parts.push(rest);
      break;
    }
    const head = rest.slice(0, split).trim();
    if (head.length) parts.push(head);
    rest = rest.slice(split).trim();
  }
  return parts.length ? parts : [text];
}

export function titleConsistencyKey(title: string): string {
  return normalizeTitleLine(title.replace(/\s+/g, ' ').trim());
}
