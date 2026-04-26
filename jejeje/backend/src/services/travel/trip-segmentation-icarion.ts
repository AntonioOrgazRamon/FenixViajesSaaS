/**
 * Heurísticas Icárion: señales de viaje real, títulos bloqueados, hoteles y páginas a ignorar.
 * Usado por TripSegmentationService (procesado por número de página real del PDF).
 */

import { logger } from '../../common/logger';
import { buildRawTextForAI } from './trip-text-cleaning.service';

/** Páginas 1..5: portada, índice, valores — no alimentan viajes. */
export const ICARION_COVER_MAX_PAGE = 5;

export type PageClassKind =
  | 'TRIP_START'
  | 'TRIP_CONTINUATION'
  | 'HOTEL_PAGE'
  | 'INFO_PAGE'
  | 'LEGAL_PAGE'
  | 'INSURANCE_PAGE'
  | 'INDEX_PAGE'
  | 'INTERNAL_SECTION'
  | 'COVER_SKIP'
  | 'ORPHAN_IGNORED';

const LEGAL_PATTERNS = [
  /CONDICIONES\s+GENERALES/i,
  /NUESTROS\s+VALORES/i,
  /SOSTENIBILIDAD/i,
  /APP\s+IC[ÁA]RION|APP ICARION/i,
  /(^|\n)\s*ÍNDICE\b/i,
  /DOCUMENTACI[ÓO]N\s+DE\s+VIAJE/i,
  /NOTIFICACIONES/i,
  /CONTACTOS\s+DIRECTOS/i,
  /Y\s+MUCHO\s+M[ÁA]S/i,
  /CONSULTA\s+NUESTROS\s+VIAJES/i,
] as const;

const INSURANCE_PATTERNS = [/\bSEGURO\s+DE\s+VIAJE\b/i, /\bSEGURO\s+DE\s+CANCELACI[ÓO]N\b/i] as const;

const INFO_PATTERNS = [/\bINFORMACI[ÓO]N\b(?!\s*DE\s*VIAJE)/i, /^.{0,500}MUCHO\s+MAS/ims] as const;

const HOTEL_IN_HEADER = /HOTELES\s+EN\s+/i;

/** Línea inicial bloqueada: nunca título de viaje. */
export const BLOCKED_TITLE_STARTS = [
  'HOTELES EN',
  'SERVICIOS INCLUIDOS',
  'SALIDAS',
  'A TENER EN CUENTA',
  'PRECIO ORIENTATIVO',
  'PRECIO ORIENTAT',
  'SEGURO',
  'CONDICIONES',
  'NUESTROS VALORES',
  'SOSTENIBILIDAD',
  'APP IC',
  'ÍNDICE',
  'INDICE',
  'DOCUMENTACIÓN',
  'DOCUMENTACION',
  'NOTIFICACIONES',
  'INFORMACIÓN',
  'INFORMACION',
  'CONTACTOS',
  'CONSULTA NUESTROS',
] as const;

const HOTEL_BRAND_TOKENS =
  /RITZ|ST\.\s*REGIS|REGIS\s+BAH|HYATT|FAIRMONT|EL\s+SAN\s+JUAN|IBEROSTAR|PARADISUS|JOIA|DORADO\s+BEACH|DORADO\s+A\s+RITZ|VANDERBILT|CONQUIS|CONQUISISTAD|RITZ-CARLTON|HOTEL\s+$/i;

export function normalizeTitleLine(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/[€$]/g, '')
    .trim()
    .toUpperCase();
}

/** Señal 1: itinerario por días */
export function signalItinerary(t: string): boolean {
  const n = t.slice(0, 20_000);
  return (
    /\bD[ÍI]A\s*1\b/i.test(n) ||
    /\bD[ÍI]A[S]?\s*\d+\s*[-–]\s*\d+/i.test(n) ||
    /\bD[ÍI]A\s+\d{1,2}\b/i.test(n) ||
    /\bD[ÍI]A\s+\d+[^\n]{0,30}(origen|llegad|vuelo)/i.test(n)
  );
}

/** Señal 2: duración noches / días */
export function signalDuration(t: string): boolean {
  return /\b\d{1,2}\s*\/\s*\d{1,2}\b/.test(t.slice(0, 20_000));
}

export function countTripSignals(text: string): { total: number; flags: string[] } {
  const t = text.slice(0, 30_000);
  const flags: string[] = [];
  if (signalItinerary(t)) flags.push('itinerary');
  if (signalDuration(t)) flags.push('duration');
  if (/SERVICIOS\s+INCLUIDOS/i.test(t)) flags.push('servicios');
  if (/SALIDAS(?:\s+20\d{2}\s*[\/-]\s*\d{2,4})?/i.test(t)) flags.push('salidas');
  if (/PRECIO\s+ORIENTATIVO/i.test(t)) flags.push('precio');
  if (/A\s+TENER\s+EN\s+CUENTA/i.test(t)) flags.push('a_tener');
  if (hasRealTripTitlePattern(t)) flags.push('title_pattern');
  if (hasMainDestinationLine(t)) flags.push('destino');
  return { total: flags.length, flags };
}

const DE_LUJO = /\b[A-ZÁÉÍÚÑ0-9\s,]{4,50}DE\s+LUJO\b/i;
/** Títulos de producto (estricto). Evita coincidir solo "VIETNAM" en cuerpo de hoteles. */
const NARROW_CATALOG_TITLES =
  /ENCANTOS?\s+DE|VIETNAM\s+SORPRENDENTE(?:\s+CON\s+SAPA)?|JAP[ÓO]N\s+DE|MARAVILLAS\s+DE|ICONOS\s+DE|NATURALEZA\s+DE|LUXURY\s+VIETNAM|VIETNAM\s+Y\s+CAMBOYA|VIETNAM\s+CON\s+SAPA|ENCANTOS\s+DE/i;

const TITLE_SCAN = 40_000;
const NARRATIVE_TITLE_VERB =
  /\b(PASEAR|CONOCER|DESCUBR|MARAV[ÍI]LLATE|EMBARQUE|TENER|VISITAR|DISFRUTAR|EXPERIMENTAR|CONSULTA|VUELO|TRASLADO)\b/i;

export function hasRealTripTitleNarrow(t: string): boolean {
  const h = t.slice(0, TITLE_SCAN);
  if (DE_LUJO.test(h)) return true;
  if (NARROW_CATALOG_TITLES.test(h)) return true;
  if (
    /CARIBE\s+MEXICANO|REP[ÚU]BLICA\s+DOMINICANA|PUERTO\s+RICO/i.test(h) &&
    /DE\s+LUJO|ENCANTOS/i.test(h)
  ) {
    return true;
  }
  return /CARIBE\s+MEXICANO|REP[ÚU]BLICA\s+DOMINICANA|PUERTO\s+RICO/i.test(h);
}

/** Compat: usar versión estricta para títulos de ficha. */
export function hasRealTripTitlePattern(t: string): boolean {
  return hasRealTripTitleNarrow(t);
}

/**
 * Ficha con todos los anclajes: evita confundir con HOTELE_PAGE o fragmentos.
 */
/**
 * Ficha mínima de producto: Día 1 + 7/5 (o análogo) + servicios + salidas + precio.
 * Sí aunque arriba haya publicidad/CTA ("Consulta nuestros viajes…") — vence `isLegal` con flags débiles.
 */
export function hasCoreFichaAnclas(text: string): boolean {
  const s = text.slice(0, 35_000);
  return (
    signalItinerary(s) &&
    (signalDuration(s) || /PRECIO\s+ORIENTATIVO/i.test(s)) &&
    /SERVICIOS\s+INCLUIDOS/i.test(s) &&
    /SALIDAS/i.test(s) &&
    /PRECIO\s+ORIENTATIVO/i.test(s)
  );
}

export function isCompleteTripFiche(text: string): boolean {
  const s = text.slice(0, 35_000);
  return (
    signalItinerary(s) &&
    signalDuration(s) &&
    /SERVICIOS\s+INCLUIDOS/i.test(s) &&
    /SALIDAS/i.test(s) &&
    /PRECIO\s+ORIENTATIVO/i.test(s) &&
    (hasRealTripTitleNarrow(s) || hasMainDestinationLine(s))
  );
}

/**
 * Condición mínima: itinerario, duración o precio, título/destino, y bloques servicios+salidas.
 */
export function passesStructuralTripStart(text: string): boolean {
  const s = text.slice(0, 30_000);
  if (!signalItinerary(s)) return false;
  if (!signalDuration(s) && !/PRECIO\s+ORIENTATIVO/i.test(s)) return false;
  if (!hasRealTripTitleNarrow(s) && !hasMainDestinationLine(s)) return false;
  if (!/SERVICIOS\s+INCLUIDOS/i.test(s) || !/SALIDAS/i.test(s)) return false;
  return true;
}

const SEASON_BANNER_STRIP = /\b(CARIBE|JAP[ÓO]N|IC[ÁA]RION)\s+DE\s+LUJO\s+20\d{2}\s*\/\s*20?\d{2,4}\b/gi;

function cleanObviousNotTitleLines(text: string): string {
  return text.replace(SEASON_BANNER_STRIP, '\n');
}

/**
 * Cabecera "CARIBE DE LUJO 2025/26" (sin destino) — no es título de producto.
 */
export function isShortCaribeDeLujoSeasonLine(l: string): boolean {
  if (!/DE\s+LUJO/i.test(l)) return false;
  if (/MEXICANO|REP[ÚU]BLICA\s+DOMINICANA|PUERTO\s+RICO|ENCANTOS|SORPRENDENTE|MARAVILLAS|ICONOS|LUXURY|VIETNAM|SAPA|CAMBOYA/i.test(l)) {
    return false;
  }
  if (/^.{0,45}CARIBE\s+DE\s+LUJO/i.test(l) && /20\d{2}/.test(l)) {
    return true;
  }
  if (/^CARIBE\s+DE\s+LUJO$/i.test(l.split(/\s+/).slice(0, 4).join(' '))) {
    return true;
  }
  return false;
}

function deLujoLineFallback(s: string): string | null {
  const body = s.slice(0, TITLE_SCAN);
  const re = /\b([A-ZÁÉÍÑ0-9][A-ZÁÉÍÑ0-9\s,]{2,52})\s+DE\s+LUJO\b/gi;
  const hits: { raw: string; good: number }[] = [];
  for (const m of body.matchAll(re)) {
    const raw = m[0]!.replace(/\s+/g, ' ').trim();
    if (isBlockedFirstLineOrTitle(raw)) continue;
    if (isShortCaribeDeLujoSeasonLine(raw)) continue;
    let good = 0;
    if (/MEXICANO|REP[ÚU]BLICA\s+DOMINICANA|PUERTO\s+RICO|ENCANTOS|SORPRENDENTE|LUXURY|MARAVILLAS|ICONOS/i.test(raw)) {
      good = 3;
    }
    hits.push({ raw, good });
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => b.good - a.good);
  return hits[0]!.raw.toUpperCase();
}

function sameSegmentTitle(a: string, b: string): boolean {
  return normalizeTitleLine(a) === normalizeTitleLine(b);
}

export function hasMainDestinationLine(t: string): boolean {
  const s = t.slice(0, 25_000);
  return /Caribe Mexicano|caribe mexicano|Rep[úu]blica Dominicana|República Dominicana|Puerto Rico|Vietnam|Camboya|Jap[óo]n|Laos|La\s?os|Cambodge/i.test(
    s,
  );
}

const MAIN_DEST_KNOWN: { re: RegExp; label: string }[] = [
  { re: /CARIBE\s+MEXICANO\s+DE\s+LUJO/i, label: 'Caribe Mexicano' },
  { re: /REP[ÚU]BLICA\s+DOMINICANA\s+DE\s+LUJO/i, label: 'República Dominicana' },
  { re: /PUERTO\s+RICO\s+DE\s+LUJO/i, label: 'Puerto Rico' },
  { re: /ENCANTOS?\s+DE\s+VIETNAM/i, label: 'Vietnam' },
  { re: /VIETNAM\s+SORPRENDENTE/i, label: 'Vietnam' },
];

/**
 * Línea de destino bajo el título (Title Case) o por mapa a partir del título de producto.
 */
export function extractMainDestinationFromTitle(
  text: string,
  title: string,
): string | null {
  for (const m of MAIN_DEST_KNOWN) {
    if (m.re.test(title) || m.re.test(text.slice(0, 1_200))) {
      return m.label;
    }
  }
  const s = text.slice(0, 1_200);
  const t = title.toUpperCase();
  if (/DE\s+LUJO$/.test(t) && DE_LUJO.test(title)) {
    const m = title.match(/^(?:\s)*([A-ZÁÉÍÑ0-9][A-ZÁÉÍÑ0-9\s,]+?)\s+DE\s+LUJO/i);
    if (m?.[1]) {
      return toTitleFromUpper(m[1]!.replace(/\s+/g, ' ').trim());
    }
  }
  for (const line of s.split(/\n+/)) {
    const l = line.trim();
    if (l.length < 3 || l.length > 60) continue;
    if (isTitleCaseLine(l) && !/INCLUIDO|SALIDAS|D[ÍI]A|€/i.test(l)) {
      if (/México|Dominicana|Puerto Rico|Vietnam|Japón|Camboya|Laos/i.test(l) || l.split(/\s+/).length <= 4) {
        return l;
      }
    }
  }
  return null;
}

function isTitleCaseLine(s: string): boolean {
  const w = s.split(/\s+/).filter(Boolean);
  if (w.length < 1 || w.length > 8) return false;
  const ok = w.filter((x) => /[A-Za-záéíóúÁÉÍÓÚÑ]/.test(x) && x[0]! === x[0]!.toUpperCase());
  return ok.length >= w.length * 0.7;
}

function toTitleFromUpper(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : ''))
    .join(' ');
}

/**
 * Añade saltos si el PDF pegó "2025/26CARIBE..." o "DÍA 1" al título.
 */
export function splitCatalogGlueArtifacts(text: string): string {
  return text
    .replace(/(\d{1,2}\s*\/\s*20\d{2,4}|[\d.]{1,2}\s*\/\s*20\d{2,4})(?=[A-ZÁÉÍÑD])/gi, '\n$1\n')
    .replace(/(DE\s+LUJO)(?=[A-ZÁÉÍÑD])/gi, '$1\n');
}

/**
 * Título de producto: primero se despega basura, luego extractTripTitle.
 */
export function extractTitleLineCandidate(text: string): string | null {
  return extractTripTitle(text);
}

/** Título aceptable para publicar o para ganar a la IA. */
export function isValidProductTitle(s: string | null | undefined): boolean {
  if (s == null) return false;
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length < 4 || t.length > 80) return false;
  if (/20\d{2}\s*\/\s*20?\d{2,4}/.test(t) || /2025\/26|2026\/27/i.test(t)) return false;
  if (/^D[ÍI]A\s/i.test(t) || (t.length < 50 && /D[ÍI]A\s*1|D[ÍI]A\s*7/i.test(t))) return false;
  if (NARRATIVE_TITLE_VERB.test(t)) return false;
  if (/CIUDAD DE ORIGEN/i.test(t)) return false;
  if (/^HOTELES EN|SERVICIOS INCLUIDOS|CONSULTA NUESTROS|CONSULTA\s+NUESTRO|PRECIO ORIENTATIVO|^SALIDAS\s*$/i.test(t)) {
    return false;
  }
  if (isShortCaribeDeLujoSeasonLine(t)) return false;
  if (/PRECIO ORIENTATIVO|SERVICIOS INCLUIDOS|HOTELES EN/i.test(t) && t.length < 100) {
    if (!/MEXICANO|DOMINICANA|PUERTO|DE\s+LUJO|ENCANTOS/i.test(t)) return false;
  }
  return !isBlockedFirstLineOrTitle(t);
}

function looksNarrativeTitle(t: string): boolean {
  if (NARRATIVE_TITLE_VERB.test(t)) return true;
  if (/[.;:!?]/.test(t) && t.length > 18) return true;
  const w = t.split(/\s+/).filter(Boolean);
  if (w.length < 2 || w.length > 12) return true;
  return false;
}

function extractIndexTitleHints(pages: { page: number; text: string }[]): string[] {
  const hints: string[] = [];
  for (const p of pages) {
    if (p.page > 20) break;
    if (!/\b[ÍI]NDICE\b/i.test(p.text) && !/CONSULTA\s+NUESTROS/i.test(p.text)) continue;
    for (const l0 of p.text.split(/\n+/)) {
      const l = l0.replace(/\s+/g, ' ').trim();
      if (l.length < 6 || l.length > 90) continue;
      if (isBlockedFirstLineOrTitle(l)) continue;
      if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(l)) continue;
      if (/\d{1,3}\s*$/.test(l)) continue; // n° página al final
      const up = l.toUpperCase();
      if (/(ENCANTOS|SORPRENDENTE|LUXURY|ICONOS|VIETNAM|CAMBOYA|LAOS|JAP[ÓO]N|DE LUJO)/i.test(up)) {
        hints.push(up);
      }
    }
  }
  return Array.from(new Set(hints));
}

function computeSegmentScore(
  text: string,
  title: string | null,
  indexHints: string[],
): { score: number; titleScore: number; structureScore: number; itineraryScore: number; catalogIndexScore: number; reasons: string[] } {
  const reasons: string[] = [];
  const signals = countTripSignals(text);
  const t = title?.trim() ?? '';
  const titleScore = t && !looksNarrativeTitle(t) && !isBlockedFirstLineOrTitle(t) ? 0.3 : 0;
  if (titleScore > 0) reasons.push('title-ok');
  const structureRaw =
    (signals.flags.includes('duration') ? 0.15 : 0) +
    (signals.flags.includes('servicios') ? 0.1 : 0) +
    (signals.flags.includes('salidas') ? 0.1 : 0) +
    (signals.flags.includes('precio') ? 0.08 : 0) +
    (signals.flags.includes('a_tener') ? 0.05 : 0);
  const structureScore = Math.min(0.38, structureRaw);
  if (structureScore > 0.2) reasons.push('structure-strong');
  const itineraryScore = signals.flags.includes('itinerary') ? 0.22 : 0;
  if (itineraryScore > 0) reasons.push('itinerary');
  let catalogIndexScore = 0;
  if (t && indexHints.some((h) => normalizeTitleLine(h) === normalizeTitleLine(t) || normalizeTitleLine(t).includes(normalizeTitleLine(h)))) {
    catalogIndexScore = 0.12;
    reasons.push('index-match');
  }
  if (t && looksNarrativeTitle(t)) {
    reasons.push('title-narrative');
  }
  const score = Math.max(0, Math.min(1, titleScore + structureScore + itineraryScore + catalogIndexScore));
  return { score, titleScore, structureScore, itineraryScore, catalogIndexScore, reasons };
}

export function isBlockedFirstLineOrTitle(candidate: string): boolean {
  if (isShortCaribeDeLujoSeasonLine(candidate)) return true;
  if (/\b20\d{2}\s*\/\s*20?\d{2,4}\b/.test(candidate) && candidate.length < 55) return true;
  if (/\bD[ÍI]A\s*\d|CIUDAD DE ORIGEN|PRECIO ORIENTATIVO|SERVICIOS INCLUIDOS|HOTELES EN/i.test(candidate) && !/DE\s+LUJO$/.test(candidate)) {
    if (candidate.length < 90 && !/MEXICANO|DOMINICANA|PUERTO|ENCANTOS|SORPR/i.test(candidate)) {
      return true;
    }
  }
  const u = normalizeTitleLine(candidate);
  for (const b of BLOCKED_TITLE_STARTS) {
    if (u.startsWith(b) || u.includes(` ${b}`)) return true;
  }
  if (BLOCKED_TITLE_STARTS.some((b) => u.startsWith(b))) return true;
  if (u.startsWith('HOTELES ')) return true;
  if (/^PRECIO/.test(u) && u.includes('ORIENTAT')) return true;
  if (u.length > 60 && (HOTEL_BRAND_TOKENS.test(candidate) && !DE_LUJO.test(candidate) && !signalItinerary(candidate))) {
    return true;
  }
  return false;
}

export function isLikelyHotelNameBlock(text: string): boolean {
  if (isCompleteTripFiche(text)) return false;
  const t = text.slice(0, 1_200).trim();
  if (HOTEL_IN_HEADER.test(t)) return true;
  const firstLine = t.split(/\n+/).find((l) => l.trim().length > 10) ?? t;
  if (firstLine.length < 20) return false;
  if (DE_LUJO.test(t) && countTripSignals(text).total >= 4) return false;
  if (HOTEL_BRAND_TOKENS.test(firstLine) && firstLine.length < 200 && !signalItinerary(text)) return true;
  if (/RESORT|HOTEL|BAH[ií]A/i.test(t) && !signalItinerary(t) && !hasRealTripTitlePattern(t) && /RITZ|HYATT|ST\./i.test(t)) {
    return true;
  }
  return false;
}

/**
 * Cualquier página cuyo foco es "HOTELES EN <país>" o listados de hoteles sin 4+ señales = anexo, no viaje.
 * Si al inicio aparece HOTELES EN, siempre tratarlo como anexo hoteles (nunca inicio de Trip).
 */
export function isHotelPageText(text: string): boolean {
  if (isCompleteTripFiche(text)) {
    return false;
  }
  const head = text.slice(0, 2_200);
  if (HOTEL_IN_HEADER.test(head)) {
    return true;
  }
  if (isLikelyHotelNameBlock(text) && countTripSignals(text).total < 4) {
    return true;
  }
  return false;
}

/** Página de ficha de viaje: no tratarla como legal solo por palabras sueltas en pie o banner. */
function isStrongCatalogTripPage(text: string): boolean {
  const { total } = countTripSignals(text);
  return (
    total >= 4 &&
    signalItinerary(text) &&
    signalDuration(text) &&
    (hasRealTripTitlePattern(text) || hasMainDestinationLine(text))
  );
}

export function isLegalOrInfoOrIndexPage(text: string): boolean {
  if (hasCoreFichaAnclas(text) || isCompleteTripFiche(text)) {
    return false;
  }
  if (isStrongCatalogTripPage(text)) {
    const t = text.slice(0, 2_500);
    if (LEGAL_PATTERNS.some((re) => re.test(t))) return true;
    if (INSURANCE_PATTERNS.some((re) => re.test(t)) && !signalItinerary(text) && !signalDuration(text)) return true;
    return false;
  }
  const t = text.slice(0, 2_000);
  if (LEGAL_PATTERNS.some((re) => re.test(t))) return true;
  if (INSURANCE_PATTERNS.some((re) => re.test(t)) && !signalItinerary(text)) return true;
  if (INFO_PATTERNS.some((re) => re.test(t))) return true;
  if (/SOSTENIBILIDAD|NUESTROS\s+VALORES|CONTACTOS/i.test(t)) return true;
  return false;
}

export function isInsurancePage(text: string): boolean {
  return INSURANCE_PATTERNS.some((re) => re.test(text.slice(0, 2_500)));
}

const INTERNAL_START = /^(SERVICIOS INCLUIDOS|A TENER EN CUENTA|Salidas|Salidas 20|PRECIO ORIENTATIVO|NOTAS)/i;

export function isInternalSectionOnlyPage(text: string): boolean {
  if (countTripSignals(text).total >= 4) return false;
  const first = (text.split(/\n+/).find((l) => l.trim().length > 2) ?? '').trim();
  if (INTERNAL_START.test(first) || /^SALIDAS/i.test(first)) {
    return true;
  }
  if (isBlockedFirstLineOrTitle(first) && !signalItinerary(text) && !hasRealTripTitlePattern(text)) {
    if (/^(PRECIO|A TENER|SERVICIOS|NOTAS|OBSERVA)/i.test(first)) return true;
  }
  return false;
}

const MIN_REAL_TRIP_SIGNALS = 4;

export function isRealTripPageText(text: string): boolean {
  if (isHotelPageText(text)) return false;
  if (isLegalOrInfoOrIndexPage(text)) return false;
  if (isInsurancePage(text) && !signalItinerary(text) && !signalDuration(text)) {
    if (!hasRealTripTitlePattern(text)) return false;
  }
  const { total, flags } = countTripSignals(text);
  if (total < MIN_REAL_TRIP_SIGNALS) return false;
  const hasTitle = flags.includes('title_pattern') || flags.includes('destino') || hasRealTripTitlePattern(text);
  if (!hasTitle) return false;
  const t = extractTripTitle(text) ?? '';
  if (t && isBlockedFirstLineOrTitle(t)) return false;
  if (!passesStructuralTripStart(text)) return false;
  return true;
}
function isNoiseTitleLine(l: string): boolean {
  const t = l.trim();
  if (t.length < 4 || t.length > 120) return true;
  if (/^D[ÍI]A\s*[\d-–]|\bD[ÍI]A\s*1\b/i.test(t)) return true;
  if (/^CIUDAD DE ORIGEN/i.test(t)) return true;
  if (/^PRECIO\s+ORIENTATIVO|^SERVICIOS\s+INCLUIDOS|^SALIDAS\s*20|^HOTELES\s+EN/i.test(t)) return true;
  if (/^CONSULTA\s+NUESTROS\s+VIAJES/i.test(t)) return true;
  if (isShortCaribeDeLujoSeasonLine(t)) return true;
  return false;
}

function scoreProductTitleLine(l: string): number {
  let s = 0;
  if (/MEXICANO|REP[ÚU]BLICA|DOMINICANA|PUERTO\s+RICO|ENCANTOS|SORPRENDENTE|LUXURY|VIETNAM|MARAVILL|ICONOS|SAPA|CAMBOYA|NATURALEZA/i.test(l)) {
    s += 4;
  }
  if (/\bDE\s+LUJO\s*$/i.test(l) || /ENCANTOS?\s+DE/i.test(l)) s += 2;
  if (l.length < 50) s += 1;
  return s;
}

/**
 * Título a menudo va DESPUÉS del itinerario: recorre todo el texto, no solo el encabezado.
 */
export function extractTripTitle(text: string): string | null {
  const prepared = splitCatalogGlueArtifacts(cleanObviousNotTitleLines(text));
  const body = prepared.slice(0, TITLE_SCAN);
  const lines = body
    .split(/\n+/)
    .map((l) => l.trim().replace(/^\W+|\W+$/g, ''))
    .filter((l) => l.length > 0);

  const dLujo: { line: string; i: number; sc: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.length < 8 || line.length > 120) continue;
    if (isNoiseTitleLine(line) || isBlockedFirstLineOrTitle(line)) continue;
    if (HOTEL_IN_HEADER.test(line)) continue;
    if (!DE_LUJO.test(line) && !NARROW_CATALOG_TITLES.test(line) && !/(MARAVILL|ICONOS|LUXURY|SORPRENDENTE)/i.test(line)) {
      continue;
    }
    if (DE_LUJO.test(line) || NARROW_CATALOG_TITLES.test(line) || /MARAVILL|ICONOS|LUXURY|SORPRENDENTE/i.test(line)) {
      const up = line.toUpperCase().replace(/\s+/g, ' ').trim();
      dLujo.push({ line: up, i, sc: scoreProductTitleLine(up) + (i > 0 ? 0.01 * i : 0) });
    }
  }
  if (dLujo.length) {
    dLujo.sort((a, b) => b.sc - a.sc || b.i - a.i);
    return dLujo[0]!.line;
  }

  for (const line of lines) {
    if (line.length < 10 || line.length > 200) continue;
    if (isNoiseTitleLine(line) || isBlockedFirstLineOrTitle(line)) continue;
    const letters = line.replace(/[^a-záéíóúñA-ZÁÉÍÓÚÑ]/g, '');
    const up = letters.split('').filter((c) => c === c.toUpperCase()).length;
    if (letters.length < 6) continue;
    if (up / letters.length < 0.4) continue;
    if (NARROW_CATALOG_TITLES.test(line) || /JAP[ÓO]N|VIETNAM\s+SORP|LUXURY/i.test(line)) {
      return line.toUpperCase();
    }
  }
  return deLujoLineFallback(prepared);
}
export function shouldCreateTripForPage(
  text: string,
  pageNumber: number,
  opts?: { indexHints?: string[] },
): { ok: boolean; title: string | null; score: number; reasons: string[] } {
  if (pageNumber < ICARION_COVER_MAX_PAGE + 1) {
    return { ok: false, title: null, score: 0, reasons: ['cover'] };
  }
  if (isLegalOrInfoOrIndexPage(text)) return { ok: false, title: null, score: 0, reasons: ['legal/info'] };
  if (isHotelPageText(text)) return { ok: false, title: null, score: 0, reasons: ['hotel_page'] };
  if (!isRealTripPageText(text)) return { ok: false, title: null, score: 0, reasons: ['not_real_trip_page'] };
  const prep = splitCatalogGlueArtifacts(cleanObviousNotTitleLines(text));
  const extracted = extractTitleLineCandidate(prep) ?? extractTripTitle(prep);
  const idx = opts?.indexHints ?? [];
  if (extracted && !isBlockedFirstLineOrTitle(extracted)) {
    const norm = extracted.toUpperCase().replace(/\s+/g, ' ').trim();
    const score = computeSegmentScore(text, norm, idx);
    return { ok: score.score >= 0.7, title: score.score >= 0.7 ? norm : null, score: score.score, reasons: score.reasons };
  }
  if (hasRealTripTitlePattern(text) && /DE\s+LUJO|ENCANTOS|VIETNAM|JAP[ÓO]N/i.test(text)) {
    const m = text.match(
      /[A-ZÁÉÍÚÑ0-9][A-ZÁÉÍÚÑ0-9\s,'-]{3,50}\s+DE\s+LUJO|ENCANTOS DE [A-ZÁÉÍÑ\s]+/i,
    );
    if (m && !isBlockedFirstLineOrTitle(m[0]!)) {
      const norm = m[0]!.toUpperCase().replace(/\s+/g, ' ').trim();
      const score = computeSegmentScore(text, norm, idx);
      return { ok: score.score >= 0.7, title: score.score >= 0.7 ? norm : null, score: score.score, reasons: score.reasons };
    }
  }
  const score = computeSegmentScore(text, extracted ?? null, idx);
  return { ok: false, title: null, score: score.score, reasons: score.reasons };
}

export function classifyPageForLog(
  text: string,
  pageNumber: string | number,
): { kind: PageClassKind; motivo: string; asociadaA?: string } {
  if (Number(pageNumber) < ICARION_COVER_MAX_PAGE + 1) {
    return { kind: 'COVER_SKIP', motivo: 'Páginas 1-5: portada/valores, sin candidatos a viaje' };
  }
  if (isLegalOrInfoOrIndexPage(text)) {
    if (isInsurancePage(text) && !signalItinerary(text)) {
      return { kind: 'INSURANCE_PAGE', motivo: 'Seguro / anexo legal' };
    }
    if (/CONDICIONES|VALORES|SOSTENI|IC[ÁA]RION|ÍNDICE|CONTACTO/i.test(text)) {
      return { kind: 'LEGAL_PAGE', motivo: 'Legal / app / valórico' };
    }
    return { kind: 'INFO_PAGE', motivo: 'Solo informativo' };
  }
  if (isHotelPageText(text)) {
    return { kind: 'HOTEL_PAGE', motivo: 'HOTELES EN… o nombres de hoteles sin estructura de viaje' };
  }
  if (isInternalSectionOnlyPage(text) && !isRealTripPageText(text)) {
    return { kind: 'INTERNAL_SECTION', motivo: 'Bloque interno (salidas, precio, sección) sin 4+ señales' };
  }
  const s = shouldCreateTripForPage(text, Number(pageNumber));
  if (s.ok) {
    return { kind: 'TRIP_START', motivo: `4+ señales (${countTripSignals(text).flags.join(', ')}), título: ${s.title}` };
  }
  if (isInternalSectionOnlyPage(text)) {
    return { kind: 'INTERNAL_SECTION', motivo: 'Página de secciones' };
  }
  return { kind: 'ORPHAN_IGNORED', motivo: 'No viaje real' };
}

type Builder = {
  title: string;
  textParts: string[];
  pageStart: number;
  pageEnd: number;
};

/** Texto de diagnóstico legible (p. ej. "Día 1 + 7/5 + servicios + salidas + precio") */
export function buildTripLogMotivo(text: string, titulo: string | undefined): string {
  const { flags } = countTripSignals(text);
  const parts: string[] = [];
  if (flags.includes('itinerary')) parts.push('Día 1 / itinerario');
  if (flags.includes('duration')) parts.push('duración (n/ noches)');
  if (flags.includes('servicios')) parts.push('SERVICIOS INCLUIDOS');
  if (flags.includes('salidas')) parts.push('SALIDAS');
  if (flags.includes('precio')) parts.push('PRECIO ORIENTATIVO');
  if (flags.includes('a_tener')) parts.push('A TENER EN CUENTA');
  if (flags.includes('title_pattern') || flags.includes('destino')) {
    parts.push(titulo ? `título «${titulo}»` : 'título/destino producto');
  }
  if (parts.length === 0) return '4+ señales (detalle en flags logger)';
  return `contiene ${parts.join(' + ')}`;
}

export function formatSignalsForLog(text: string): string {
  return countTripSignals(text).flags.join(', ') || 'ninguna';
}

function logPage(
  num: number,
  msg: {
    kind: PageClassKind;
    motivo: string;
    asociadaA?: string;
    titulo?: string;
    merged?: boolean;
    action?: string;
    titleCandidate?: string;
    signals?: string;
  },
) {
  logger.info(
    {
      segment: 'icarion',
      page: num,
      tipo: msg.kind,
      motivo: msg.motivo,
      ...(msg.asociadaA ? { asociadaA: msg.asociadaA } : {}),
      ...(msg.titulo ? { titulo: msg.titulo } : {}),
      merged: msg.merged,
      ...(msg.action ? { action: msg.action } : {}),
      ...(msg.titleCandidate ? { titleCandidate: msg.titleCandidate } : {}),
      ...(msg.signals ? { signals: msg.signals } : {}),
    },
    `segmentación p.${num} ${msg.kind}${msg.action ? ` action=${msg.action}` : ''}`,
  );
}

/**
 * Bucle por número de página real. Fusiona hoteles y secciones internas al último viaje; solo emite
 * segmentos `kind: 'trip'` con texto completo (varias págs.) para quien tenga 4+ señales reales.
 */
export function buildIcarionSegments(
  pages: { page: number; text: string }[],
  opts: { minPageForTrips?: number; log?: boolean } = {},
): {
  segments: {
    pageStart: number;
    pageEnd: number;
    title: string;
    text: string;
    rawTextForAI: string;
    kind: 'trip';
  }[];
} {
  const minP = opts.minPageForTrips ?? ICARION_COVER_MAX_PAGE + 1;
  const doLog = opts.log !== false;
  const sorted = [...pages].filter((p) => p.text?.trim().length).sort((a, b) => a.page - b.page);
  const indexHints = extractIndexTitleHints(sorted);
  const out: {
    pageStart: number;
    pageEnd: number;
    title: string;
    text: string;
    rawTextForAI: string;
    kind: 'trip';
  }[] = [];
  let current: Builder | null = null;

  const pushCurrent = () => {
    if (!current) return;
    if (current.textParts.join('').length < 80) {
      current = null;
      return;
    }
    const textJoined = current.textParts.join('\n\n---\n\n');
    out.push({
      pageStart: current.pageStart,
      pageEnd: current.pageEnd,
      title: current.title,
      text: textJoined,
      rawTextForAI: buildRawTextForAI(textJoined),
      kind: 'trip',
    });
    current = null;
  };

  const log = (n: number, msg: Parameters<typeof logPage>[1]) => {
    if (doLog) logPage(n, msg);
  };

  for (const p of sorted) {
    const n = p.page;
    const t = p.text;
    if (n < 1) continue;
    if (n < minP) {
      log(n, { kind: 'COVER_SKIP', motivo: `Páginas 1..${ICARION_COVER_MAX_PAGE}: no candidatos` });
      continue;
    }
    if (t.length < 20) {
      log(n, { kind: 'ORPHAN_IGNORED', motivo: 'Casi vacía' });
      continue;
    }

    if (isLegalOrInfoOrIndexPage(t) && !isRealTripPageText(t)) {
      const kind: PageClassKind = isInsurancePage(t) && !signalItinerary(t) ? 'INSURANCE_PAGE' : 'LEGAL_PAGE';
      log(n, { kind, motivo: 'Informativo / legal / seguro (no viaje estructurado)' });
      continue;
    }

    const pageEval = shouldCreateTripForPage(t, n, { indexHints });
    const { ok, title: tripTitle } = pageEval;
    if (ok && tripTitle) {
      const action = current ? 'close_previous_and_open_new_trip' : 'open_new_trip';
      pushCurrent();
      current = {
        title: tripTitle,
        textParts: [`--- Pág. real ${n} (TRIP_START) ---\n${t}`],
        pageStart: n,
        pageEnd: n,
      };
      log(n, {
        kind: 'TRIP_START',
        motivo: `${buildTripLogMotivo(t, tripTitle)} | score=${pageEval.score.toFixed(2)}`,
        titulo: tripTitle,
        titleCandidate: tripTitle,
        signals: `${formatSignalsForLog(t)} | ${pageEval.reasons.join(',')}`,
        action,
      });
      continue;
    }
    if (pageEval.score >= 0.5 && pageEval.score < 0.7) {
      log(n, {
        kind: 'ORPHAN_IGNORED',
        motivo: `discardedCandidate: score=${pageEval.score.toFixed(2)} (<0.70)`,
        titleCandidate: pageEval.title ?? extractTripTitle(t) ?? undefined,
        signals: `${formatSignalsForLog(t)} | ${pageEval.reasons.join(',')}`,
        action: 'discard_low_score',
      });
      continue;
    }

    if (current && isCompleteTripFiche(t) && !isHotelPageText(t)) {
      const alt = extractTitleLineCandidate(t) ?? deLujoLineFallback(t);
      if (alt && !sameSegmentTitle(alt, current.title)) {
        const action = 'close_previous_and_open_new_trip_ficha';
        log(n, {
          kind: 'TRIP_START',
          motivo: 'Nueva ficha completa detectada (cierre y apertura forzada)',
          titleCandidate: alt,
          titulo: alt,
          signals: formatSignalsForLog(t),
          action,
        });
        pushCurrent();
        current = {
          title: alt,
          textParts: [`--- Pág. real ${n} (TRIP_START) ---\n${t}`],
          pageStart: n,
          pageEnd: n,
        };
        continue;
      }
    }

    if (isInternalSectionOnlyPage(t) && !isRealTripPageText(t) && current) {
      current.textParts.push(`--- Pág. real ${n} (INTERNAL_SECTION) ---\n${t}`);
      current.pageEnd = n;
      log(n, { kind: 'INTERNAL_SECTION', motivo: 'Sección interna anexa', asociadaA: current.title, merged: true });
      continue;
    }

    if (isHotelPageText(t)) {
      if (current) {
        const header = `--- Pág. real ${n} (HOTEL_PAGE) ---\n${t}`;
        current.textParts.push(header);
        current.pageEnd = n;
        const headLine = t.split(/\n+/).find((l) => l.trim().length > 3) ?? '';
        const hotelHint = HOTEL_IN_HEADER.test(t.slice(0, 800)) ? 'HOTELES EN…' : 'listado de hoteles';
        log(n, {
          kind: 'HOTEL_PAGE',
          motivo: `asociada al viaje: ${hotelHint}, sin itinerario completo; ${headLine.slice(0, 90)}${headLine.length > 90 ? '…' : ''}`,
          asociadaA: current.title,
          merged: true,
          action: 'append_to_current_trip',
        });
      } else {
        log(n, { kind: 'HOTEL_PAGE', motivo: 'Hoteles sin viaje activo, omitida', merged: false, action: 'ignore_orphan_hotels' });
      }
      continue;
    }

    if (isInternalSectionOnlyPage(t) && !isRealTripPageText(t) && !current) {
      log(n, { kind: 'INTERNAL_SECTION', motivo: 'Bloque interno sin viaje en curso', merged: false });
      continue;
    }

    if (current) {
      if (isCompleteTripFiche(t) || (passesStructuralTripStart(t) && !isInternalSectionOnlyPage(t))) {
        const altC = extractTitleLineCandidate(t) ?? deLujoLineFallback(t);
        if (!altC) {
          log(n, {
            kind: 'ORPHAN_IGNORED',
            motivo: 'Bloque tipo ficha; no se pudo extraer título, no anexar',
            asociadaA: current.title,
            action: 'skip_no_title',
            signals: formatSignalsForLog(t),
          });
          continue;
        }
        if (!sameSegmentTitle(altC, current.title)) {
          log(n, {
            kind: 'ORPHAN_IGNORED',
            motivo:
              'Bloque tipo ficha y título distinto: no anexar como TRIP_CONTINUATION (nuevo producto o revisar corte arriba)',
            asociadaA: current.title,
            action: 'skip_orphan_not_merged',
            titleCandidate: altC,
            signals: formatSignalsForLog(t),
          });
          continue;
        }
      }
      current.textParts.push(`--- Pág. real ${n} (TRIP_CONTINUATION) ---\n${t}`);
      current.pageEnd = n;
      log(n, {
        kind: 'TRIP_CONTINUATION',
        motivo: 'Anexar texto al segmento actual (no ficha con otro título detectada)',
        asociadaA: current.title,
        action: 'append_continuation',
        signals: formatSignalsForLog(t),
        merged: true,
      });
      continue;
    }

    const c = classifyPageForLog(t, n);
    log(n, { kind: c.kind, motivo: c.motivo, asociadaA: c.asociadaA, merged: false });
  }
  pushCurrent();
  if (out.length === 0 && sorted.length) {
    logger.warn({ pages: sorted.length, minPage: minP }, 'Icarion: 0 viajes; revisar señales o títulos');
  }
  return { segments: out };
}

/** Nombres de API pedidos en especificación (alias legibles) */
export const classifyPage = classifyPageForLog;
export const isRealTripPage = isRealTripPageText;
export const isHotelPage = isHotelPageText;
export const isLegalOrInfoPage = isLegalOrInfoOrIndexPage;
export const shouldCreateTrip = shouldCreateTripForPage;