import type { PageText } from './pdf-extraction.service';
import { buildRawTextForAI } from './trip-text-cleaning.service';

export type IndexExpectedTrip = {
  expectedTitle: string;
  pageNumber: number;
  section: string | null;
  /** Título normalizado para métricas / fuzzy match */
  normalizedTitle: string;
};

export type IndexCoverageBuildResult = {
  expected: IndexExpectedTrip[];
  segments: Array<{
    pageStart: number;
    pageEnd: number;
    title: string;
    text: string;
    rawTextForAI: string;
    kind: 'trip';
    fromIndex: true;
  }>;
};

const INDEX_MARKER = /\b[ÍI]NDICE\b|CONSULTA\s+NUESTROS\s+VIAJES/i;
const TITLE_WITH_PAGE = /^(.{4,120}?)\s+(\d{1,3})$/;
/** "130 Singapur e iconos de Malasia" */
const PAGE_THEN_TITLE = /^(\d{1,3})\s+(.{4,120})$/;

function normTitle(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitLines(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseIndexLine(l: string): { title: string; page: number } | null {
  let m = l.match(TITLE_WITH_PAGE);
  if (m) {
    const page = parseInt(m[2]!, 10);
    const title = m[1]!.replace(/[.\-–—\s]+$/g, '').trim();
    if (Number.isFinite(page) && page > 0 && title.length >= 4) return { title, page };
  }
  m = l.match(PAGE_THEN_TITLE);
  if (m) {
    const page = parseInt(m[1]!, 10);
    const title = m[2]!.replace(/[.\-–—\s]+$/g, '').trim();
    if (Number.isFinite(page) && page > 0 && title.length >= 4) return { title, page };
  }
  return null;
}

function extractIndexEntriesFromPage(text: string): IndexExpectedTrip[] {
  const out: IndexExpectedTrip[] = [];
  let currentSection: string | null = null;
  for (const l of splitLines(text)) {
    if (l.length < 3) continue;
    if (/^(ASIA|AM[ÉE]RICA|CARIBE|JAP[ÓO]N|VIETNAM|INDIA|CHINA|COREA|EXTENSIONES)\b/i.test(l) && !/\d{1,3}$/.test(l)) {
      currentSection = l;
      continue;
    }
    const parsed = parseIndexLine(l);
    if (!parsed) continue;
    const { title, page } = parsed;
    if (title.length > 120) continue;
    if (/^(ÍNDICE|INDICE|P[ÁA]GINA|PAGINA)$/i.test(title)) continue;
    out.push({
      expectedTitle: title,
      pageNumber: page,
      section: currentSection,
      normalizedTitle: normTitle(title),
    });
  }
  return out;
}

function scanIndexPages(pages: PageText[]): PageText[] {
  return pages.filter((p) => {
    if (p.page > 40) return false;
    if (INDEX_MARKER.test(p.text)) return true;
    const lines = splitLines(p.text);
    const nTitlePage = lines.filter((l) => parseIndexLine(l) != null).length;
    return nTitlePage >= 3;
  });
}

function findRealStartPage(pages: PageText[], expectedTitle: string, pageHint: number): number {
  const nTitle = normTitle(expectedTitle);
  const near = pages.filter((p) => p.page >= Math.max(1, pageHint - 4) && p.page <= pageHint + 6);
  const best = near.find((p) => normTitle(p.text.slice(0, 2000)).includes(nTitle));
  if (best) return best.page;
  const broad = pages.find((p) => p.page >= Math.max(1, pageHint - 8) && normTitle(p.text.slice(0, 2500)).includes(nTitle));
  return broad?.page ?? pageHint;
}

export function buildIndexCoverageSegments(pages: PageText[]): IndexCoverageBuildResult {
  const indexPages = scanIndexPages(pages);
  const entriesRaw = indexPages.flatMap((p) => extractIndexEntriesFromPage(p.text));
  const dedupe = new Map<string, IndexExpectedTrip>();
  for (const e of entriesRaw) {
    const k = `${normTitle(e.expectedTitle)}|${e.pageNumber}`;
    if (!dedupe.has(k)) dedupe.set(k, e);
  }
  const expected = Array.from(dedupe.values()).sort((a, b) => a.pageNumber - b.pageNumber);
  if (expected.length === 0) return { expected: [], segments: [] };

  const withReal = expected.map((e) => ({
    ...e,
    realPage: findRealStartPage(pages, e.expectedTitle, e.pageNumber),
  }));
  const segments: IndexCoverageBuildResult['segments'] = [];
  for (let i = 0; i < withReal.length; i++) {
    const cur = withReal[i]!;
    const next = withReal[i + 1];
    const start = Math.max(1, cur.realPage);
    const end = Math.max(start, (next?.realPage ?? pages[pages.length - 1]?.page ?? start) - 1);
    const chunkPages = pages.filter((p) => p.page >= start && p.page <= end);
    if (chunkPages.length === 0) continue;
    const text = chunkPages.map((p) => `--- Pág. real ${p.page} (INDEX_TRIP) ---\n${p.text}`).join('\n\n---\n\n');
    segments.push({
      pageStart: start,
      pageEnd: end,
      title: cur.expectedTitle,
      text,
      rawTextForAI: buildRawTextForAI(text),
      kind: 'trip',
      fromIndex: true,
    });
  }
  return { expected, segments };
}

