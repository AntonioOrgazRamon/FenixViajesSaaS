/**
 * Extracción defensiva de hoteles — no guardar prosa en `hotelName`.
 */

import { config } from '../../common/config';
import { logger } from '../../common/logger';
import {
  CATALOG_HOTELS_CARIBE_MX,
  CATALOG_HOTELS_CARIBE_PR,
  CATALOG_HOTELS_CARIBE_RD,
} from './catalog-hotel-seeds';

import type { TripAiExtract } from './trip-ai.schemas';

const DEV = config.NODE_ENV === 'development';
const PIPE = config.TRAVEL_HOTEL_PIPELINE_LOG === true;

const NARR =
  /\b(cuenta|ofrece|está|están|tien|dispon|disfrut|descubre|podr[áa]s?|alberga|ubicad[oa]|situad[oa]|rodead[oa]|incluy|embarc|retiro|inaugur[óo]|brinda|proporciona|ideal|sumer|aléj|sumér|encontr|disfrutar|sum[ée]rgete|disfrutad)\b/i;
const BANN = /^(HOTELES\s+EN|HOTELES$|CIUDAD\s*HOTEL$|CIUDAD$|NOTAS|CONDICIONES)\b/i;
const BANNER = /CARIBE\s+DE\s+LUJO(\s+20\d{2})?/i;
const SUSPECT_RES = /^reserve(\s+puerto\s*rico)?$/i;

const SECTION_LINE =
  /^(HOTELES|HOTELES\s+EN|HOTELES\s*\(|SERVICIOS|SEGUR[OÓ]|SALIDAS|PRECI[OÓ]|A\s+TENER|D[ÍI]A|D[ÍI]AS|D[ÍI]A\s*\d|D[ÍI]AS\s*\d|NOTAS\s+IMP)\b/i;
const ITIN_WORDS = /\b(D[ÍI]A|D[ÍI]AS|Día|Días|Llegada|Salida|Llega|Noche a bordo|Ciudad de Origen|Ciudad de origen)\b/i;
const SVC_SAL = /\b(Servicios Incluidos|Seguro\s+de\s+viaje|Tasas locales?|Vuelo|Vuelos|Traslad)\b/i;
const NARR_OPENER =
  /^(Descubre|Disfruta|Aléjate|Embá|Sum[ée]r|Encontr|Podr|La posibilidad|Excelente|Lujo se|Desde los|Alojamiento en (el|los)|Del \d{1,2}[/]\d{1,2})/i;
const TRIV_DE_LUJO = /^.+\b(DE|de)\s+Lujo$/i;
const BANN_UPPER_SECTION =
  /^(HOTELES\s+EN|SERVICIOS|SEGUR[OÓ]|SALIDAS|PRECI[OÓ]|A\s+TENER|D[ÍI]A|NOTAS|CARIBE\s+DE|CIUDAD\s+HOTEL|CIUDAD\s*HOTEL$)/i;

const ALL: readonly string[] = [
  ...CATALOG_HOTELS_CARIBE_MX,
  ...CATALOG_HOTELS_CARIBE_RD,
  ...CATALOG_HOTELS_CARIBE_PR,
].sort((a, b) => b.length - a.length);

/** Marca / palabra clave de alojamiento (no “Spa” suelto en frases de tratamiento) */
export const RE_HOTEL_TRUST =
  /\b(Hyatt|Fairmont|Ritz|Ritz-?Carlton|Regency|Iberostar|Paradis|Secrets?|Banyan|Viceroy|Xcaret|Belmond|Rosewood|Grand Velas|Sanctuary|Eden\s+Roc|Tortuga Bay|Conquistador|Vanderbilt|Joi[ao]a?|Andaz|Nizuc|Conrad|Unico|Dorado Beach|Marriott|Hilton|Palace|Hotel Xcaret|Casa de Campo|St\.\s*Regis|Regis|Condado|El\s+San Juan|W\s+Hotel|Palafitos?|Moxch[ée]\b|Kanai|Impressions|Zo[ëe]try|Excellence|Live\s+Aqua)\b/i;

/**
 * Palabras/marcas que permiten persistir sin whitelist (barrera final).
 * Incluye tipología (Hotel, Resort, Beach…) además de cadenas hoteleras.
 */
export const RE_STRONG_HOTEL_KEYWORD =
  /\b(Hotels?|Resorts?|Beach|Villas?|Suites?|Palac(?:e|io)|Spa|Hyatt|Fairmont|Iberostar|Paradisus|Paradis|Secrets?|Zo[ëe]try|Excellence|Xcaret|Mayakoba|Ritz(?:-?\s*Carlton)?|St\.\s*Regis|Vanderbilt|Condado|Conquistador|Banyan\s+Tree|Rosewood|Belmond|Grand\s+Velas|\bVelas\b|Viceroy|Dorado\s+Beach|Regency|Andaz|Conrad|Marriott|Hilton|Sanctuary|Nizuc|Unico|Live\s+Aqua|Hotel\s+Xcaret|Casa\s+de\s+Campo|Tortuga\s+Bay|Palafitos?|Kanai|Impressions|Jo[ií]a|Eden\s+Roc|W\s+Hotel|El\s+San\s+Juan|\bRegis\b)\b/i;

/** Umbral mínimo para persistir / devolver en el extractor (0–1) */
export const MIN_HOTEL_CONFIDENCE = 0.75;

const MAX_W_DEFAULT = 10;

export type HotelSource = 'TABLE' | 'HOTEL_TITLE' | 'PATTERN' | 'AI';

export type HotelCandidate = {
  city: string | null;
  hotelName: string;
  category: string | null;
  source: HotelSource;
  confidence: number;
  normKey: string;
};

export type RejectedCandidate = { value: string; reason: string };

export type ExtractCleanHotelsInput = {
  hotelsTableBlock?: string;
  hotelDescriptionsBlock?: string;
  fullSegmentText?: string;
  title?: string;
  mainDestination?: string;
};

export type ExtractCleanHotelsResult = {
  hotels: Array<{
    city: string | null;
    hotelName: string;
    category: string | null;
    source: HotelSource;
    confidence: number;
  }>;
  rejectedCandidates: RejectedCandidate[];
};

export function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[''`.´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isKnownCatalogName(t: string): boolean {
  const k = normKey(t);
  for (const n of ALL) {
    if (normKey(n) === k) {
      return true;
    }
  }
  return false;
}

function stopwordRatio(t: string): number {
  const w = t.split(/\s+/).filter(Boolean);
  if (w.length < 4) {
    return 0;
  }
  const stop = new Set([
    'de',
    'la',
    'el',
    'los',
    'las',
    'que',
    'para',
    'con',
    'en',
    'por',
    'del',
    'al',
    'un',
    'una',
    'y',
    'o',
  ]);
  let c = 0;
  for (const x of w) {
    if (stop.has(x.toLowerCase().replace(/[.,;:!?]/, ''))) {
      c++;
    }
  }
  return c / w.length;
}

export function normalizeHotelName(name: string): string {
  return ensureRitzComma(
    fixFairmontElSanJuanCasing(
      name
        .replace(/\s+/g, ' ')
        .split(/\s+/)
        .map((w) => {
          if (w.length <= 1) {
            return w;
          }
          if (w.length <= 3 && w === w.toUpperCase()) {
            return w;
          }
          if (/&/.test(w)) {
            return w[0]!.toUpperCase() + w.slice(1).toLowerCase();
          }
          return w[0]!.toUpperCase() + w.slice(1).toLowerCase();
        })
        .join(' ')
        .replace(/\bSt\./gi, 'St.')
        .replace(/\bThe St\./gi, 'The St.'),
    ),
  );
}

/** "Fairmont EL SAN Juan Hotel" → "Fairmont El San Juan Hotel" */
function fixFairmontElSanJuanCasing(s: string): string {
  return s
    .replace(/\bEL\s+SAN\s+JUAN\b/gi, 'El San Juan')
    .replace(/\bEL\s+(?=San\s+Juan\b)/gi, 'El ');
}

/** Formato de marca: coma antes de “, a …” (Ritz-Carlton) */
function ensureRitzComma(name: string): string {
  return name.replace(
    /\bDorado Beach\s*,?\s*A\s+Ritz-?carlton\s+Reserve\b/gi,
    'Dorado Beach, a Ritz-Carlton Reserve',
  );
}

function twords(s: string) {
  return s.split(/\s+/).filter(Boolean).length;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function extractCategoryFromHotelsBlock(block: string): string | null {
  const m = block.match(/\bCat\.\s*\(([^)]+)\)/i);
  if (!m?.[1]) {
    return null;
  }
  return m[1].replace(/\s+/g, ' ').trim();
}

function collectCitiesFromSegment(full: string): string[] {
  const out: string[] = [];
  const s = full.replace(/\r\n/g, '\n');
  const lines = s.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  // Línea típica debajo del título: "Hanoi, Bahía de Halong, ... y Siem Reap"
  for (let i = 0; i < Math.min(lines.length, 14); i++) {
    const l = lines[i]!;
    if (l.length < 8 || l.length > 220) continue;
    if (!/,/.test(l)) continue;
    if (/SERVICIOS|SALIDAS|HOTELES|PRECIO|D[ÍI]A/i.test(l)) continue;
    const parts = l
      .split(/,| y /i)
      .map((x) => x.replace(/\.$/, '').trim())
      .filter((x) => x.length >= 3 && x.length <= 40);
    for (const p of parts) {
      if (/^(Vietnam|Camboya|Laos|Japón|Caribe|Ciudad de origen)$/i.test(p)) continue;
      if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p)) continue;
      out.push(p);
    }
  }
  // Rutas de itinerario: "Día 4 Hanoi - Bahía de Halong"
  for (const m of s.matchAll(/D[ÍI]A[S]?\s*\d+(?:\s*[-–]\s*\d+)?\s+([^\n]{4,180})/gi)) {
    const row = m[1]!;
    const parts = row
      .split(/[-–]/)
      .map((x) => x.replace(/\.$/, '').trim())
      .filter((x) => x.length >= 3 && x.length <= 50);
    for (const p of parts) {
      if (/^(Ciudad de origen|Llegada|Salida)$/i.test(p)) continue;
      if (/SERVICIOS|SALIDAS|HOTELES|PRECIO/i.test(p)) continue;
      out.push(p);
    }
  }
  const cleaned = uniq(out)
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter((x) => x.length > 1);
  cleaned.sort((a, b) => b.length - a.length);
  return cleaned;
}

function splitByKnownCities(line: string, knownCities: string[]): Array<{ city: string; hotel: string }> {
  const raw = line.replace(/^[·•\-\*]\s*/, '').replace(/\s+/g, ' ').trim();
  if (!raw || knownCities.length === 0) {
    return [];
  }
  const matches: { city: string; start: number; end: number }[] = [];
  for (const city of knownCities) {
    const re = new RegExp(`\\b${escRe(city)}\\b`, 'gi');
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(raw)) != null) {
      matches.push({ city, start: m.index, end: m.index + m[0]!.length });
    }
  }
  if (matches.length === 0) {
    return [];
  }
  matches.sort((a, b) => a.start - b.start || b.city.length - a.city.length);
  const nonOverlapping: typeof matches = [];
  for (const m of matches) {
    if (nonOverlapping.some((x) => m.start < x.end && m.end > x.start)) continue;
    nonOverlapping.push(m);
  }
  const out: Array<{ city: string; hotel: string }> = [];
  for (let i = 0; i < nonOverlapping.length; i++) {
    const m = nonOverlapping[i]!;
    const next = nonOverlapping[i + 1];
    const tail = raw.slice(m.end, next ? next.start : raw.length).replace(/^[\s:·•\-–]+/, '').trim();
    if (!tail) continue;
    out.push({ city: m.city, hotel: tail });
  }
  return out;
}

export function rejectHotelCandidate(candidate: string): string | null {
  const t = candidate.replace(/\s+/g, ' ').trim();
  if (!t) {
    return 'vacío';
  }
  if (BANN.test(t) || (BANNER.test(t) && t.length < 100 && !RE_HOTEL_TRUST.test(t))) {
    return 'línea/marca de catálogo';
  }
  if (SECTION_LINE.test(t) && t.length < 90) {
    return 'título de sección';
  }
  if (BANN_UPPER_SECTION.test(t) && t === t.toUpperCase() && t.length < 50) {
    return 'rúbrica en mayúsculas (no hotel)';
  }
  if (NARR_OPENER.test(t) && twords(t) > 2) {
    return 'narración (inicio)';
  }
  if (ITIN_WORDS.test(t) && (/\d/.test(t) || twords(t) > 5)) {
    return 'itinerario o día';
  }
  if (SVC_SAL.test(t) && twords(t) < 8) {
    return 'servicio/seguro/salidas';
  }
  if (/Hoteles\s*\(\s*indicados|HOTELES\s*\(indicados/i.test(t) && t.length < 100) {
    return 'rúbrica hoteles (indicados)';
  }
  if (/\b20\d{2}\s*\/\s*20?\d{2,4}\b/.test(t) && twords(t) < 7) {
    return 'rango de salidas (temporada)';
  }
  if (/^Del\s+\d{1,2}\/[/\d]|\bDiaria?s?\b.*\b€?$/i.test(t) && twords(t) < 8) {
    return 'rango de fechas/precio';
  }
  if (TRIV_DE_LUJO.test(t) && !RE_HOTEL_TRUST.test(t)) {
    return 'título de viaje (De Lujo), no alojamiento';
  }
  if (/\b(La posibilidad|Lujo se mezclan|Excelente en esta|Desde los recuerdos|de las escasas)\b/i.test(t)) {
    return 'fragmento narrativo';
  }
  if (/\b(Alojamiento en (el|los) hotel|hotel seleccionado|según disponibilidad)\b/i.test(t)) {
    return 'texto genérico alojamiento';
  }
  if (
    /\b(Tratamientos|Acompañad[oa]|Experiencias|Comerciales|culinari|tiendas|bosque lluvioso|naturaleza increíble)\b/i.test(
      t,
    ) &&
    twords(t) < 12
  ) {
    return 'servicio/experiencia (no nombre de hotel)';
  }
  if (/\b(Tasas\s+Aéreas|carburante|Seguro\s+de\s+Viaje|Seguro\s+de\s+viaje|Días\s+Libres|Hoteles\s+De)\b/i.test(t)) {
    return 'servicio/tasas/días (no hotel)';
  }
  if (/\b(Acompañado\s+de\s+Noches|De\s+Spa,)/i.test(t)) {
    return 'itinerario spa/noches (no hotel)';
  }
  if (NARR.test(t) && t.length > 22) {
    return 'narración (verbo/estilo)';
  }
  if (
    /^(de\s+la|con\s+una|en\s+medio|este\s+hotel|el\s+hotel|descubre|situad[oa]|en\s+el|disfrut)\b/i.test(
      t,
    ) &&
    t.length > 20
  ) {
    return 'narración (inicio de párrafo)';
  }
  const wn = twords(t);
  const allowLong = isKnownCatalogName(t);
  if (wn > MAX_W_DEFAULT && !allowLong) {
    return 'demasiadas palabras para nombre de hotel';
  }
  if (wn > 12) {
    return 'demasiadas palabras (límite duro)';
  }
  if (stopwordRatio(t) > 0.4 && wn > 4 && !RE_HOTEL_TRUST.test(t) && !allowLong) {
    return 'muchos conectores (prosa)';
  }
  if (SUSPECT_RES.test(t)) {
    return 'fragmento (Reserve aislado)';
  }
  if (/^el condado$/i.test(t) || /^el san juan$/i.test(t)) {
    return 'fragmento (Área/El sin nombre de hotel completo)';
  }
  if (/\b(este|esta)\s+hotel\s+/i.test(t) && t.length > 28) {
    return 'prosa: “este hotel”';
  }
  if (t.length > 80) {
    const l = (t.match(/[a-záéíóúñü]/g) || []).length;
    if (l / t.length > 0.4) {
      return 'largo, muchas minúsculas (prosa)';
    }
  }
  if (/\bde\s+la\s+naturaleza\b/i.test(t) && t.length > 40) {
    return 'naturaleza (prosa)';
  }
  if (/\./.test(t) && t.length > 30 && !/\bSt\./i.test(t) && t.split(/\s+/).length > 4) {
    return 'puntuación (posible prosa)';
  }
  if (/;/.test(t) && t.length > 45) {
    return 'punto y coma (prosa)';
  }
  return null;
}

function sourceBase(s: HotelSource): number {
  const b: Record<HotelSource, number> = { TABLE: 0.8, HOTEL_TITLE: 0.76, PATTERN: 0.7, AI: 0.66 };
  return b[s] ?? 0.7;
}

export type HotelConfidenceContext = {
  /** Cerca de cabecera “Hoteles (en …)” o tabla ciudad/hotel. */
  nearHotelesHeader?: boolean;
  /** Apariciones del candidato en el bloque. */
  repeatInSegment?: number;
};

export function computeHotelConfidence(
  name: string,
  source: HotelSource,
  debug?: { reasons: string[] },
  ctx?: HotelConfidenceContext,
): number {
  const t = name.replace(/\s+/g, ' ').trim();
  const r = debug?.reasons;
  if (!t || !/[A-Za-zÁÉÑáé]/.test(t)) {
    r?.push('empty');
    return 0;
  }
  if (rejectHotelCandidate(t) != null) {
    r?.push('hard-reject');
    return 0;
  }
  if (isKnownCatalogName(t)) {
    r?.push('catalog');
    return 0.98;
  }
  let c = sourceBase(source);
  r?.push(`base+${source}=${c.toFixed(2)}`);
  if (RE_HOTEL_TRUST.test(t) && !/Tratamientos|Acompañ|Experiencias|Comerciales|culinari|tiendas/i.test(t)) {
    c += 0.1;
    r?.push('brand+0.1');
  }
  const wn = twords(t);
  if (t.length >= 8 && t === t.toUpperCase() && wn >= 2 && wn <= 9) {
    if (/\b(HYATT|FAIRM|RITZ|REGIS|DORADO|HOTEL|RESORT|CONQ|VAND|CONDADO|THE ST)\b/.test(t)) {
      c += 0.04;
      r?.push('upper+0.04');
    }
  }
  if (stopwordRatio(t) > 0.38) {
    c -= 0.12;
    r?.push('stop-0.12');
  }
  if (wn > 8) {
    c -= 0.1;
    r?.push('long-0.1');
  }
  if (/,/.test(t) && wn >= 5 && !/\bDorado Beach\b.*Ritz|,\s*a\s+Ritz-\s*?Carlton|Ritz-\s*?Carlton\s+Reserve\b/i.test(t)) {
    c -= 0.1;
    r?.push('comma-0.1');
  }
  if (/^De |^Con |^En (el |la |los )|^Este |^El hotel está|^Sus |^Nuestr/i.test(t)) {
    c -= 0.25;
    r?.push('narrStart-0.25');
  }
  if (/\b(tratamientos?|acompañ|días libres?|hoteles de|tasas?|seguro de)\b/i.test(t) && wn < 8) {
    c -= 0.35;
    r?.push('narrW-0.35');
  }
  if (ctx?.nearHotelesHeader) {
    c += 0.04;
    r?.push('nearHoteles+0.04');
  }
  if (ctx?.repeatInSegment != null && ctx.repeatInSegment >= 2) {
    c += 0.03;
    r?.push('repeat+0.03');
  }
  c = Math.max(0, Math.min(0.99, c));
  r?.push(`final=${c.toFixed(2)}`);
  return c;
}

export function maxHotelPersistenceConfidence(name: string): number {
  return Math.max(
    computeHotelConfidence(name, 'TABLE'),
    computeHotelConfidence(name, 'HOTEL_TITLE'),
    computeHotelConfidence(name, 'PATTERN'),
    computeHotelConfidence(name, 'AI'),
  );
}

export function isValidHotelCandidate(candidate: string, source: HotelSource = 'PATTERN'): boolean {
  if (rejectHotelCandidate(candidate) != null) {
    return false;
  }
  if (!/[A-Za-zÁÉÑáé]/.test(candidate)) {
    return false;
  }
  return computeHotelConfidence(candidate, source) >= MIN_HOTEL_CONFIDENCE;
}

export function isLikelyHotelName(candidate: string, source: HotelSource = 'PATTERN'): boolean {
  return isValidHotelCandidate(candidate, source);
}

function escRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Título “pegado” en mayúsculas (segundo hotel) */
const SPLIT_MAYUS_RE =
  /(?<=\S)\s+(?=(?:CONDADO\s+VAND|EL\s+CONQUI|DORADO BEACH|FAIRMONT|HYATT|THE\s+ST\.?|VANDERBILT|RITZ-CARLTON|RITZ)\b)/i;

/**
 * Títulos pegados o múltiples cadenas conocidas en un mismo renglón
 */
export function splitJoinedHotelTitles(line: string, sink: RejectedCandidate[]): string[] {
  const raw0 = line.replace(/^[·•\-\*]\s*/, '');
  const raw = raw0.replace(/\s+/g, ' ').trim();
  if (raw.length < 6) {
    return [];
  }
  if (/^Área\s/i.test(raw)) {
    return [];
  }

  const u = raw.toUpperCase();
  const found: { a: number; b: number; n: string }[] = [];
  for (const name of ALL) {
    const re = new RegExp(name.split(/\s+/).map(escRe).join('\\s+'), 'gi');
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(raw)) != null) {
      if (m[0]!.length < 5 && name.length > 8) {
        continue;
      }
      found.push({ a: m.index, b: m.index + m[0]!.length, n: name });
    }
  }

  found.sort((s, t) => s.a - t.a || t.n.length - s.n.length);
  const picked: typeof found = [];
  for (const h of found) {
    if (picked.some((e) => h.a < e.b && h.b > e.a)) {
      continue;
    }
    picked.push(h);
  }
  if (picked.length > 1) {
    return picked
      .sort((s, t) => s.a - t.a)
      .map((h) => h.n)
      .map((n) => normalizeHotelName(n))
      .filter((n) => !rejectHotelCandidate(n) && isLikelyHotelName(n, 'HOTEL_TITLE'));
  }

  if (u.length > 0 && u === u.toUpperCase() && raw.length > 32) {
    const parts = raw.split(SPLIT_MAYUS_RE);
    if (parts.length > 1) {
      return parts
        .map((c) => c.replace(/\s+/g, ' ').trim())
        .filter((c) => c.length > 3)
        .map((c) => normalizeHotelName(c))
        .filter((c) => !rejectHotelCandidate(c) && isLikelyHotelName(c, 'HOTEL_TITLE'));
    }
  }

  const singleLineSource: HotelSource = u.length > 0 && u === u.toUpperCase() && raw.length > 12 ? 'HOTEL_TITLE' : 'PATTERN';
  if (!rejectHotelCandidate(raw) && isLikelyHotelName(raw, singleLineSource)) {
    return [normalizeHotelName(raw)];
  }
  if (raw.length) {
    const rj = rejectHotelCandidate(raw) ?? (!isLikelyHotelName(raw, singleLineSource) ? 'no parece hotel' : null);
    if (rj) {
      sink.push({ value: raw, reason: rj });
    }
  }
  return [];
}

export function mergeBrokenTableLines(linesIn: string[]): string[] {
  const lines = linesIn
    .map((l) => l.replace(/^[·•\-\*]\d*\.?\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let a = lines[i]!;
    const b = lines[i + 1];
    if (
      b != null &&
      b.length < 50 &&
      /^reserve(\s+puerto\s*rico)?$/i.test(b) &&
      /(Grand|Regency|Río|Hyatt|Fair|ST|St|GRAND)/i.test(a) &&
      a.length < 120
    ) {
      a = `${a} ${b}`.replace(/\s+/g, ' ').trim();
      i++;
    }
    out.push(a);
  }
  return out;
}

function tryParseAreaLine(
  line: string,
  rejected: RejectedCandidate[],
): { city: string; hotel: string; confidence: number } | null {
  const t = line.replace(/^[·•\-\*]\s*/, '').replace(/\s+/g, ' ').trim();
  if (!/^Área\s+/i.test(t) || BANN.test(t) || (BANNER.test(t) && t.length < 20)) {
    return null;
  }
  if (/HOTELES\s+EN|CARIBE\s+DE|NOTAS|CONDICIONES/i.test(t) && t.length < 12) {
    return null;
  }
  const m = t.match(/^Área\s+((?:Río|Rio)\s+Grande|[^\d·.]{2,50}?)\s+(.+)$/i);
  if (m) {
    const city = `Área ${m[1]!.replace(/\s+/g, ' ').trim()}`;
    const hotel = m[2]!.replace(/\s+/g, ' ').trim();
    if (SUSPECT_RES.test(hotel)) {
      return null;
    }
    const rj = rejectHotelCandidate(hotel);
    if (rj != null) {
      rejected.push({ value: hotel, reason: `área+hotel: ${rj}` });
      return null;
    }
    const conf = computeHotelConfidence(hotel, 'TABLE');
    if (conf < MIN_HOTEL_CONFIDENCE) {
      return null;
    }
    return { city, hotel: normalizeHotelName(hotel), confidence: conf };
  }
  return null;
}

export function extractHotelsFromTableBlock(
  block: string,
  rejected: RejectedCandidate[],
  opts?: { knownCities?: string[]; category?: string | null },
): HotelCandidate[] {
  if (!block.trim()) {
    return [];
  }
  const out: HotelCandidate[] = [];
  const knownCities = opts?.knownCities ?? [];
  for (const line0 of mergeBrokenTableLines(block.split(/\n/))) {
    if (BANN.test(line0)) {
      continue;
    }
    if (/^Cat\./i.test(line0) || /^Ciudad\s+Hotel/i.test(line0)) {
      continue;
    }
    const a = tryParseAreaLine(line0, rejected);
    if (a) {
      out.push({
        city: a.city,
        hotelName: a.hotel,
        category: opts?.category ?? null,
        source: 'TABLE',
        confidence: a.confidence,
        normKey: normKey(`${a.city} ${a.hotel} ${opts?.category ?? ''}`),
      });
      continue;
    }
    const citySplits = splitByKnownCities(line0, knownCities);
    if (citySplits.length > 0) {
      for (const sp of citySplits) {
        const hName = normalizeHotelName(sp.hotel);
        const rej = rejectHotelCandidate(hName);
        if (rej) {
          rejected.push({ value: `${sp.city} ${sp.hotel}`, reason: `tabla ciudad-hotel: ${rej}` });
          continue;
        }
        const conf = computeHotelConfidence(hName, 'TABLE', undefined, { nearHotelesHeader: true });
        if (conf < MIN_HOTEL_CONFIDENCE) continue;
        out.push({
          city: sp.city,
          hotelName: hName,
          category: opts?.category ?? null,
          source: 'TABLE',
          confidence: conf,
          normKey: normKey(`${sp.city} ${hName} ${opts?.category ?? ''}`),
        });
      }
      continue;
    }
    for (const piece of splitJoinedHotelTitles(line0, rejected)) {
      if (!piece || SUSPECT_RES.test(piece)) {
        continue;
      }
      const conf = computeHotelConfidence(piece, 'TABLE');
      if (conf < MIN_HOTEL_CONFIDENCE) {
        continue;
      }
      out.push({
        city: null,
        hotelName: piece,
        category: opts?.category ?? null,
        source: 'TABLE',
        confidence: conf,
        normKey: normKey(`${piece} ${opts?.category ?? ''}`),
      });
    }
  }
  return out;
}

export function extractHotelTitlesFromDescriptionBlock(
  block: string,
  rejected: RejectedCandidate[],
  have: Set<string>,
): HotelCandidate[] {
  const o: HotelCandidate[] = [];
  for (const line0 of block.split(/\n/)) {
    if (BANN.test(line0)) {
      continue;
    }
    const line = line0.replace(/\s+/g, ' ').trim();
    if (line.length < 4) {
      continue;
    }
    if (line.length > 200) {
      if (NARR.test(line) && twords(line) > 5) {
        continue;
      }
    }
    if (line.length > 45 && NARR.test(line) && twords(line) > 5) {
      continue;
    }
    for (const piece of splitJoinedHotelTitles(line, rejected)) {
      const p = piece.trim();
      if (!p) {
        continue;
      }
      if (have.has(normKey(p))) {
        continue;
      }
      if (rejectHotelCandidate(p) != null) {
        continue;
      }
      const chConf = computeHotelConfidence(p, 'HOTEL_TITLE');
      if (chConf < MIN_HOTEL_CONFIDENCE) {
        continue;
      }
      have.add(normKey(p));
      o.push({ city: null, hotelName: p, category: null, source: 'HOTEL_TITLE', confidence: chConf, normKey: normKey(p) });
    }
  }
  return o;
}

function narrativeNearMatch(text: string, idx: number, span: number): boolean {
  const w = 35;
  const s = text.slice(Math.max(0, idx - w), Math.min(text.length, idx + span + w));
  if (/\b(naturaleza|este\s+hotel|el\s+hotel|cuenta\s+con|embarc)\b/i.test(s) && twords(s) > 8) {
    return true;
  }
  return NARR.test(s) && twords(s) > 8;
}

function findKnownInText(text: string, have: Set<string>, _sink: RejectedCandidate[]): HotelCandidate[] {
  const t = text.slice(0, 200_000);
  const o: HotelCandidate[] = [];
  for (const name of ALL) {
    if (SUSPECT_RES.test(name)) {
      continue;
    }
    const m = t.match(new RegExp(escRe(name), 'i'));
    if (!m || m.index == null) {
      continue;
    }
    if (narrativeNearMatch(t, m.index, m[0]!.length) && twords(name) < 3) {
      continue;
    }
    const n = m[0]!.trim();
    if (have.has(normKey(n))) {
      continue;
    }
    if (narrativeNearMatch(t, m.index, m[0]!.length)) {
      if (!/HYATT|FAIRMONT|THE ST\.|DORADO|VAND|CONDADO|CONQUIS|RITZ/i.test(n) && twords(n) < 3) {
        continue;
      }
    }
    const nNorm = normalizeHotelName(n);
    if (rejectHotelCandidate(nNorm) != null) {
      continue;
    }
    if (!isLikelyHotelName(nNorm)) {
      continue;
    }
    have.add(normKey(nNorm));
    o.push({ city: null, hotelName: nNorm, category: null, source: 'PATTERN', confidence: 0.52, normKey: normKey(nNorm) });
  }
  return o;
}

const SOURCE_RANK: Record<HotelSource, number> = {
  TABLE: 4,
  HOTEL_TITLE: 3,
  PATTERN: 2,
  AI: 1,
};

/**
 * Deduplicación: preferir origen, luego nombre más largo; quitar subcadenas
 */
export function dedupeHotels(
  candidates: HotelCandidate[],
  sink: RejectedCandidate[],
  _fromTablePremerged?: boolean,
): HotelCandidate[] {
  if (candidates.length === 0) {
    return [];
  }
  const sorted = [...candidates].sort(
    (a, b) =>
      SOURCE_RANK[b.source] - SOURCE_RANK[a.source] || b.hotelName.length - a.hotelName.length,
  );
  const by = new Map<string, HotelCandidate>();
  for (const h of sorted) {
    if (!h.normKey) {
      continue;
    }
    const prev = by.get(h.normKey);
    if (!prev) {
      by.set(h.normKey, h);
      continue;
    }
    if (SOURCE_RANK[h.source] > SOURCE_RANK[prev.source] ||
        (SOURCE_RANK[h.source] === SOURCE_RANK[prev.source] && h.hotelName.length > prev.hotelName.length + 1)) {
      sink.push({ value: prev.hotelName, reason: 'dupe→sustituido por origen/len' });
      by.set(h.normKey, h);
    } else {
      sink.push({ value: h.hotelName, reason: 'duplicado' });
    }
  }
  const list0 = Array.from(by.values());
  return list0.filter((h) => {
    const sub = list0.some(
      (x) =>
        x !== h &&
        h.hotelName.length < x.hotelName.length &&
        x.hotelName.toLowerCase().includes(h.hotelName.toLowerCase()) &&
        h.hotelName.length < 22,
    );
    if (sub) {
      sink.push({ value: h.hotelName, reason: 'contenido en hotel más completo' });
    }
    return !sub;
  });
}

function hasExplicitHotelFraming(n: string): boolean {
  return (
    /\b(el|la|los)\s+(hotel|resort|hostal)\s+\S/i.test(n) ||
    /\b(en|al)\s+(el|los?)\s+(hotel|resort)\b/i.test(n) ||
    /\balojamiento(\s+en|\s+del|\s+en el)?\s+\S/i.test(n) ||
    /^hotel\s+\S/i.test(n) ||
    /^resort\s+\S/i.test(n)
  );
}

export type FilterHotelsForPersistenceOptions = {
  /** normKey de hoteles detectados solo en tabla / títulos visuales del bloque estructurado (no destino fijo). */
  visualWhitelistNormKeys?: Set<string>;
};

/**
 * Barrera dura antes de persistir: rechaza prosa aunque pase scoring.
 * Requiere palabra hotelera fuerte, marco explícito ("el hotel …") o whitelist del extractor estructurado.
 */
export function finalHotelPersistenceBarrier(
  name: string,
  opts?: FilterHotelsForPersistenceOptions,
): string | null {
  const raw = name.replace(/\s+/g, ' ').trim();
  if (!raw) {
    return 'vacío';
  }
  const n = normalizeHotelName(raw);
  const k = normKey(n);

  if (/\bnoches?\s+a\s+bordo\b/i.test(n)) {
    return 'itinerario (noche a bordo)';
  }
  if (/bah[ií]as?\s+bioluminiscentes?\b/i.test(n)) {
    return 'excursión / naturaleza (bioluminiscentes)';
  }
  if (/\bd[ií]as?\s+libres?\b/i.test(n)) {
    return 'itinerario (días libres)';
  }
  if (/\bservicios\s+incluidos\b/i.test(n)) {
    return 'rúbrica servicios';
  }
  if (/\bprecio\s+orientativo\b/i.test(n)) {
    return 'rúbrica precio';
  }
  if (/^(d[ií]a|d[ií]as)\b/i.test(n)) {
    return 'itinerario (día/días)';
  }
  if (/\bsalidas\b/i.test(n) && twords(n) < 10) {
    return 'rúbrica o texto de salidas';
  }

  if (/\.\s*$/.test(n) && twords(n) <= 10 && !RE_STRONG_HOTEL_KEYWORD.test(n)) {
    return 'frase narrativa (termina en punto)';
  }

  const inWhitelist = opts?.visualWhitelistNormKeys?.has(k) ?? false;
  const strongKw = RE_STRONG_HOTEL_KEYWORD.test(n);
  const framing = hasExplicitHotelFraming(n);

  if (!strongKw && !framing && !inWhitelist) {
    return 'barrera final: sin señal hotelera fuerte ni contexto explícito ni whitelist de ficha';
  }
  return null;
}

/**
 * Aceptados para persistir (última barrera)
 */
export function filterHotelsForPersistence(
  hotels: TripAiExtract['hotels'],
  opts?: FilterHotelsForPersistenceOptions,
): {
  kept: NonNullable<typeof hotels>;
  dropped: RejectedCandidate[];
} {
  const kept: NonNullable<typeof hotels> = [];
  const dropped: RejectedCandidate[] = [];
  for (const h of hotels) {
    const n0 = h.hotelName?.replace(/\s+/g, ' ').trim() ?? '';
    if (!n0) {
      dropped.push({ value: '(empty)', reason: 'nombre vacío' });
      continue;
    }
    const n = normalizeHotelName(n0);
    const r = rejectHotelCandidate(n);
    if (r) {
      dropped.push({ value: n, reason: r });
      continue;
    }
    if (maxHotelPersistenceConfidence(n) < MIN_HOTEL_CONFIDENCE) {
      dropped.push({ value: n, reason: 'confianza persistencia < umbral' });
      continue;
    }
    const barrier = finalHotelPersistenceBarrier(n, opts);
    if (barrier) {
      dropped.push({ value: n, reason: barrier });
      continue;
    }
    kept.push({ ...h, hotelName: n });
  }
  return { kept, dropped };
}

function devLog(accepted: HotelCandidate[], rejected: RejectedCandidate[]) {
  if (!DEV && !PIPE) {
    return;
  }
  if (DEV) {
    for (const x of accepted) {
      const reasons: string[] = [];
      computeHotelConfidence(x.hotelName, x.source, { reasons });
      try {
        logger.debug({ hotel: x.hotelName, source: x.source, conf: x.confidence, reasons }, 'travel:hotelScore');
      } catch {
        /* */
      }
    }
  }
  const a = accepted.map(
    (x) => ({ hotel: x.hotelName, city: x.city, source: x.source, conf: x.confidence }),
  );
  const r = rejected.slice(0, 80);
  const bySource: Record<string, number> = {};
  for (const h of accepted) {
    bySource[h.source] = (bySource[h.source] ?? 0) + 1;
  }
  try {
    const fn = DEV ? logger.debug : logger.info;
    fn(
      { nAccepted: accepted.length, nRejected: rejected.length, bySource, accepted, rejected: r },
      'travel:extractCleanHotels (capas TABLE/HOTEL_TITLE/PATTERN, AI en merge)',
    );
  } catch {
    /* pino puede no estar inicializado en scripts ts-node aislados */
  }
}

export function extractCleanHotelsFromBlocks(input: ExtractCleanHotelsInput): ExtractCleanHotelsResult {
  const rejected: RejectedCandidate[] = [];
  const full =
    input.fullSegmentText ??
    `${input.hotelDescriptionsBlock ?? ''}\n${input.hotelsTableBlock ?? ''}`.trim();
  const knownCities = collectCitiesFromSegment(full);
  const tableCategory = extractCategoryFromHotelsBlock(input.hotelsTableBlock ?? '');
  const fromTable = extractHotelsFromTableBlock(input.hotelsTableBlock ?? '', rejected, {
    knownCities,
    category: tableCategory,
  });
  const have = new Set<string>(fromTable.map((h) => h.normKey).filter(Boolean));
  const fromDesc = extractHotelTitlesFromDescriptionBlock(input.hotelDescriptionsBlock ?? '', rejected, have);
  const fromPattern =
    (input.hotelsTableBlock ?? '').trim().length > 0
      ? []
      : findKnownInText(full, have, rejected);
  const raw = [...fromTable, ...fromDesc, ...fromPattern];
  const merged = dedupeHotels(raw, rejected, false);
  if (DEV || PIPE) {
    devLog(merged, rejected);
  }
  return {
    hotels: merged.map((h) => ({
      city: h.city,
      hotelName: h.hotelName,
      category: h.category ?? null,
      source: h.source,
      confidence: h.confidence,
    })),
    rejectedCandidates: rejected,
  };
}
