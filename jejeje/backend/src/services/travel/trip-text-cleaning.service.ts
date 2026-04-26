/**
 * Limpia texto de catálogo antes de enviar a IA: cabeceras repetidas, marcadores de segmentación.
 */

const PAGE_MARKER_LINE = /^---\s*Pág\.\s*real\s+\d+[^-\n]*---\s*$/gim;
const EMBEDDED_TRIP_DEBUG = /---\s*Pág\.\s*real\s+\d+\s*\([^)]+\)\s*---/gi;
/** Cabecera corta "CARIBE DE LUJO 2025/26" (no título "CARIBE MEXICANO DE LUJO") */
const SHORT_DE_LUJO_SEASON = /\b(CARIBE|JAP[ÓO]N|IC[ÁA]RION)\s+DE\s+LUJO\s+20\d{2}\s*\/\s*20?\d{2,4}/gi;
/** Misma cabecera pegada dos o más veces seguidas (OCR) */
const GLUED_SEASON = /(?:\b(CARIBE|JAP[ÓO]N)\s+DE\s+LUJO\s+20\d{2}\s*\/\s*20?\d{2,4}){2,}/gi;
/** Inicio de línea: cabecera + basura */
const LINE_LEAD_CARIBE_SEASON = /^(?:\s*CARIBE\s+DE\s+LUJO\s+20\d{2}\s*\/\s*20?\d{2,4}[\s]*){1,4}/gim;
const STANDALONE_SEASON = /^(?:\s*)(?:[A-ZÁÉÍÑ0-9\-\s]{0,30}\s+)?20\d{2}\s*\/\s*20?\d{2,4}\s*$/gim;
const CATALOG_SLOGAN = /\b(VIETNAM|JAP[ÓO]N|IC[ÁA]RION)\s+20\d{2}\s*\/\s*20?\d{2,4}/gi;
const MANY_DASH = /\n?-{3,}\n?/g;

/**
 * Elimina cabeceras de temporada o marca repetida típicas de catálogos Icárion/similares.
 * No elimina títulos de producto (p. ej. "CARIBE MEXICANO DE LUJO" sin fecha pegada a "DE LUJO" sola
 * con temporada en la misma frase: se ataca al patrón "… DE LUJO 2025/26" corto o línea-solo temporada).
 */
export function cleanRepeatedCatalogHeaders(text: string): string {
  let t = text;
  t = t.replace(GLUED_SEASON, ' ');
  t = t.replace(SHORT_DE_LUJO_SEASON, ' ');
  t = t.replace(CATALOG_SLOGAN, ' ');
  t = t.replace(LINE_LEAD_CARIBE_SEASON, ' ');
  t = t.replace(STANDALONE_SEASON, '\n');
  t = t.replace(
    /CARIBE\s+DE\s+LUJO\s*20?\d{2}?\s*\/?\s*20?\d{2,4}?\s*CARIBE\s+DE\s+LUJO/gi,
    ' ',
  );
  const lines = t.split(/\n/).filter((l, i, a) => i === 0 || l.trim() !== a[i - 1]!.trim());
  t = lines.join('\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(MANY_DASH, '\n\n');
  return t
    .replace(/[ \t]+/g, ' ')
    .replace(/^\s+|\s+$/gm, '')
    .replace(/\n{2,}CARIBE DE LUJO 20\d{2}[^\n]*/gim, '\n')
    .trim();
}

/** Quitar guiones y marcadores internos de importación. */
export function stripSegmentDebugMarkers(text: string): string {
  let t = text.replace(PAGE_MARKER_LINE, '');
  t = t.replace(EMBEDDED_TRIP_DEBUG, '');
  t = t.replace(MANY_DASH, '\n\n');
  t = t.replace(/^\s*\n/gm, '\n');
  return t;
}

/**
 * Texto listo para el modelo: sin marcadores y con cabeceras de catálogo suavizadas.
 * Orden: primero se quitan marcas de página, luego cabeceras.
 */
export function buildRawTextForAI(segmentText: string): string {
  return cleanRepeatedCatalogHeaders(stripSegmentDebugMarkers(segmentText));
}

export class TripTextCleaningService {
  buildRawTextForAI(text: string): string {
    return buildRawTextForAI(text);
  }
  cleanHeaders(text: string): string {
    return cleanRepeatedCatalogHeaders(text);
  }
  stripMarkers(text: string): string {
    return stripSegmentDebugMarkers(text);
  }
}
