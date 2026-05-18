/**
 * Capa final de higiene de título antes de persistir: prefijos de página, narrativa, alternativas en segmento.
 * No modifica la segmentación.
 */

import type { IndexExpectedTrip } from './travel-index-coverage.service';
import { findBestIndexTitleForPages } from './catalog-trip-title.service';
import {
  extractTripTitle,
  isBlockedFirstLineOrTitle,
  isLikelyGeographicCatalogTitleLine,
  isValidProductTitle,
} from './trip-segmentation-icarion';
import { looksNarrativeOrBrokenTitle, normalizeTravelTitle } from './travel-segment-validator.service';

export type ValidateAndRepairTripTitleResult = {
  ok: boolean;
  /** No crear fila de via (título irreparable). */
  skipPersist: boolean;
  /** Persistir pero marcar revisión humana del título. */
  needsReviewTitle: boolean;
  title: string | null;
  titleBefore: string;
  titleAfter: string | null;
  titleConfidence: number;
  titleRepairReason: string;
};

/** Prefijo numérico tipo índice de páginas del PDF. */
export function stripLeadingPageNumberFromTitle(title: string): string {
  return title.replace(/^\s*\d{1,3}\s+(?=[\p{L}])/u, '').trim();
}

const NARRATIVE_CONTAMINATION: RegExp[] = [
  /\bmaravillos[oa]\s+del\b/i,
  /\bveremos\b/i,
  /\bseguiremos\b/i,
  /\btendremos\b/i,
  /\bdurante\s+el\s+d[ií]a\b/i,
  /\bpara\s+descubrir\b/i,
  /\bpara\s+disfrutar\b/i,
  /\bcon\s+las\s+torres\b/i,
  /\bdel\s+acantilado\b/i,
  /\byellow\s+bridge\b/i,
  /\bautocar\b/i,
];

/** Destinos / producto; líneas cortas necesitan señal explícita. */
const DESTINO_PRODUCT_RE =
  /\b(TAILANDIA|THAILAND|VIETNAM|BUT[ÁA]N|BHUTAN|INDIA|SRI\s+LANKA|MYANMAR|LAOS|CAMBOYA|CAMBODIA|MALASIA|MALAYSIA|INDONESIA|FILIPINAS|JAP[ÓO]N|CHINA|SINGAPUR|BORNEO|BALI|JAVA|SUMATRA|NEPAL|DUBAI|EMIRATOS|EGIPTO|MARRUECOS|TURQU[IÍ]A|CUBA|M[EÉ]XICO|COSTA\s+RICA|PER[ÚU]|NOR(?:TE|OESTE)\s+DE)\b/i;

const TEMPLO_ALLOW = /\b(ICONOS?\s+DE|TEMPLOS?\s+DE|RUTA\s+DE\s+LOS\s+TEMPLOS|ANGKOR|BOROBUDUR)\b/i;
const PLAZA_ALLOW = /\bPLAZA\s+(MAYOR|DE\s+ARMAS|DEL\s+PALACIO)\b/i;

export function titleHasNarrativeContamination(title: string): boolean {
  const t = normalizeTravelTitle(title);
  if (!t) return true;
  for (const re of NARRATIVE_CONTAMINATION) {
    if (re.test(t)) return true;
  }
  if (/\btemplo\b/i.test(t) && !TEMPLO_ALLOW.test(t)) return true;
  if (/\bplaza\b/i.test(t) && !PLAZA_ALLOW.test(t)) return true;
  return false;
}

function wordCount(s: string): number {
  return normalizeTravelTitle(s)
    .split(/\s+/)
    .filter((w) => /[\p{L}\d]/u.test(w)).length;
}

function isTitleCaseOrStrongUpper(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim();
  if (t.length < 4) return false;
  const words = t.split(/\s+/).filter((w) => /[\p{L}]/u.test(w));
  if (words.length < 2) return false;
  let upperish = 0;
  for (const w of words) {
    const letters = w.replace(/[^a-zA-ZÁÉÍÓÚÑáéíóúñ]/g, '');
    if (!letters) continue;
    if (letters === letters.toUpperCase() && letters.length >= 2) upperish++;
    else if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{1,}/.test(letters)) upperish++;
  }
  return upperish / words.length >= 0.5;
}

function hasDestinationOrProductSignal(s: string): boolean {
  if (isLikelyGeographicCatalogTitleLine(s) || isValidProductTitle(s)) return true;
  return DESTINO_PRODUCT_RE.test(s);
}

/** Texto antes de la primera duración tipo D / N o de bloques fijos de ficha. */
export function sliceBeforeStructureAnchors(text: string, maxLen = 14_000): string {
  const t = text.slice(0, maxLen);
  const dur = t.search(/\b\d{1,2}\s*\/\s*\d{1,2}\b/);
  const precio = t.search(/\bPRECIO\s+ORIENTATIVO\b/i);
  const serv = t.search(/\bSERVICIOS\s+INCLUIDOS\b/i);
  const sal = t.search(/\bSALIDAS\b/i);
  const cands = [dur, precio, serv, sal].filter((x) => x >= 0);
  const cut = cands.length ? Math.min(...cands) : Math.min(t.length, 8000);
  return t.slice(0, Math.max(200, cut));
}

function lineIsBadForTitle(line: string): boolean {
  const s = stripLeadingPageNumberFromTitle(line);
  const wc = wordCount(s);
  if (wc < 2 || wc > 10) return true;
  if (/servicios|salidas|precio\s+orientativo|^a\s+tener|€|\d{1,2}\s*\/\s*\d{1,2}/i.test(s)) return true;
  if (/\bD[ÍI]A\s*\d+/i.test(s)) return true;
  if (titleHasNarrativeContamination(s) || looksNarrativeOrBrokenTitle(s)) return true;
  if (isBlockedFirstLineOrTitle(s)) return true;
  if (!isTitleCaseOrStrongUpper(s)) return true;
  if (!hasDestinationOrProductSignal(s)) return true;
  return false;
}

function scoreAlternativeLine(line: string): number {
  const s = normalizeTravelTitle(stripLeadingPageNumberFromTitle(line));
  let sc = 0;
  if (isLikelyGeographicCatalogTitleLine(s)) sc += 6;
  if (isValidProductTitle(s)) sc += 5;
  if (DESTINO_PRODUCT_RE.test(s)) sc += 3;
  const wc = wordCount(s);
  if (wc >= 3 && wc <= 8) sc += 2;
  if (/DE\s+LUJO|AL\s+COMPLETO|LUXURY|ICONOS|NATURALEZA/i.test(s)) sc += 2;
  return sc;
}

export function findAlternativeCommercialTitleInSegment(rawExtractedText: string): string | null {
  const head = sliceBeforeStructureAnchors(rawExtractedText);
  const lines = head
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  let best: { line: string; sc: number } | null = null;
  for (const line of lines) {
    if (line.length < 6 || line.length > 100) continue;
    if (lineIsBadForTitle(line)) continue;
    const sc = scoreAlternativeLine(line);
    if (!best || sc > best.sc) best = { line: stripLeadingPageNumberFromTitle(line), sc };
  }
  return best && best.sc >= 3 ? normalizeTravelTitle(best.line) : null;
}

/** Corrige español típico erróneo "la completo" cuando el PDF lleva "al completo". */
export function applyCompletoTypoFromContext(title: string, rawText: string): string | null {
  const t = normalizeTravelTitle(title);
  if (!/\bla\s+completo\b/i.test(t)) return null;
  if (!/\bAL\s+COMPLETO\b/i.test(rawText)) return null;
  return t.replace(/\bla\s+completo\b/gi, 'AL COMPLETO');
}

export function validateAndRepairTripTitle(
  rawTitle: string | null | undefined,
  rawExtractedText: string,
  ctx: { indexEntries: IndexExpectedTrip[]; pageStart: number; pageEnd: number },
): ValidateAndRepairTripTitleResult {
  const titleBefore = normalizeTravelTitle(rawTitle ?? '');
  const baseFail = (reason: string): ValidateAndRepairTripTitleResult => ({
    ok: false,
    skipPersist: true,
    needsReviewTitle: false,
    title: null,
    titleBefore,
    titleAfter: null,
    titleConfidence: 0,
    titleRepairReason: reason,
  });

  if (!titleBefore || titleBefore.length < 4) {
    return baseFail('EMPTY_TITLE');
  }

  let work = stripLeadingPageNumberFromTitle(titleBefore);
  const prefixStripped = work !== titleBefore;

  const completoFix = applyCompletoTypoFromContext(work, rawExtractedText);
  if (completoFix) {
    work = completoFix;
  }

  const isContaminated = (s: string) =>
    titleHasNarrativeContamination(s) || looksNarrativeOrBrokenTitle(s) || isBlockedFirstLineOrTitle(s);

  const head = sliceBeforeStructureAnchors(rawExtractedText);
  let repaired: string | null = null;
  let reason = '';

  if (!isContaminated(work)) {
    const confidence = prefixStripped || completoFix ? 0.9 : 0.96;
    reason =
      prefixStripped && completoFix
        ? 'STRIPPED_PAGE_PREFIX|COMPLETO_CONTEXT_FIX'
        : prefixStripped
          ? 'STRIPPED_PAGE_PREFIX'
          : completoFix
            ? 'COMPLETO_CONTEXT_FIX'
            : 'ACCEPT_CLEAN';
    return {
      ok: true,
      skipPersist: false,
      needsReviewTitle: !!completoFix,
      title: work,
      titleBefore,
      titleAfter: work,
      titleConfidence: confidence,
      titleRepairReason: reason,
    };
  }

  repaired = findAlternativeCommercialTitleInSegment(rawExtractedText);
  if (repaired && !isContaminated(repaired)) {
    reason = 'REPAIRED_ALTERNATIVE_LINE';
    return {
      ok: true,
      skipPersist: false,
      needsReviewTitle: false,
      title: repaired,
      titleBefore,
      titleAfter: repaired,
      titleConfidence: 0.86,
      titleRepairReason: reason,
    };
  }

  const extracted = extractTripTitle(head);
  if (extracted) {
    const e = normalizeTravelTitle(stripLeadingPageNumberFromTitle(extracted));
    if (e.length >= 4 && !isContaminated(e)) {
      reason = 'REPAIRED_EXTRACT_TRIP_TITLE';
      return {
        ok: true,
        skipPersist: false,
        needsReviewTitle: false,
        title: e,
        titleBefore,
        titleAfter: e,
        titleConfidence: 0.82,
        titleRepairReason: reason,
      };
    }
  }

  const idx = findBestIndexTitleForPages(titleBefore, ctx.indexEntries, ctx.pageStart, ctx.pageEnd);
  if (idx && idx.score >= 0.42) {
    const idxTitle = normalizeTravelTitle(idx.entry.expectedTitle);
    if (!isContaminated(idxTitle)) {
      return {
        ok: true,
        skipPersist: false,
        needsReviewTitle: true,
        title: idxTitle,
        titleBefore,
        titleAfter: idxTitle,
        titleConfidence: 0.52 + Math.min(0.2, idx.score * 0.2),
        titleRepairReason: 'NEEDS_REVIEW_TITLE|FALLBACK_INDEX',
      };
    }
  }

  return baseFail('NO_CLEAN_TITLE|NEEDS_REVIEW_UNMET');
}
