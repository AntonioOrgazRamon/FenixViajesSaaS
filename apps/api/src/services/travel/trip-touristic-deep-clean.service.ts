/**
 * FASE 1 — Limpieza profunda para catálogos turísticos: guiones, folios, ruido, bloques.
 * Se aplica **después** de `buildRawTextForAI` (o usar `deepCleanFromRawSegmentText` desde el segmento bruto).
 */

import { buildRawTextForAI, cleanRepeatedCatalogHeaders } from './trip-text-cleaning.service';

const DIGITS_ONLY_LINE = /^\d{1,4}$|^\d{1,2}\s+\d{1,2}$/;

/**
 * "histo-\nria" → "historia" (palabra cortada por salto)
 */
function joinHyphenatedLineBreaks(text: string, passes = 3): string {
  let t = text;
  for (let i = 0; i < passes; i++) {
    t = t.replace(
      /([A-Za-zÁÉÍÓÚÑáéíóúñü0-9])-\s*\r?\n+\s*([A-Za-zÁÉÍÓÚÑáéíóúñü0-9])/g,
      '$1$2',
    );
  }
  return t;
}

/**
 * Línea que parece solo número de folio o pie de impresión
 */
function stripFolioStyleLines(s: string): string {
  return s
    .split(/\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (DIGITS_ONLY_LINE.test(t)) return false;
      if (/^\d{1,2}\s*\/\s*\d{1,2}\s*-\s*Page$/i.test(t)) return false;
      if ([/^\d{1,2}\s*\/\s*Page$/i, /^Pág\.?\s*\d+$/i].some((r) => r.test(t))) return false;
      return true;
    })
    .join('\n');
}

/**
 * Elimina renglones pegados "2928" + inicio de palabra (OCR/maquetación)
 */
function splitDigitGlueToWord(s: string): string {
  return s.replace(
    /(\d{2,4})(?=[A-Za-zÁÉÑÑáéíóúñ]{3,})/g,
    '$1 ',
  );
}

function collapseExtraBlankLines(s: string): string {
  return s
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Limpieza profunda sobre el mismo texto que se envía a la IA (`rawTextForAI`).
 */
export function deepCleanTouristicText(rawTextForAI: string): string {
  let t = joinHyphenatedLineBreaks(stripFolioStyleLines(rawTextForAI));
  t = splitDigitGlueToWord(t);
  t = cleanRepeatedCatalogHeaders(t);
  t = stripFolioStyleLines(t);
  t = collapseExtraBlankLines(t);
  return t;
}

/** Desde el texto de segmento con marcas de página; equivale a buildRawTextForAI + profundo. */
export function deepCleanFromRawSegmentText(segmentText: string): string {
  return deepCleanTouristicText(buildRawTextForAI(segmentText));
}

export class TripTouristicDeepCleanService {
  fromSegmentText(segmentText: string): string {
    return deepCleanFromRawSegmentText(segmentText);
  }
  fromRawTextForAI(rawTextForAI: string): string {
    return deepCleanTouristicText(rawTextForAI);
  }
}
