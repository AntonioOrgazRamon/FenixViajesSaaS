import type { TripAiExtract } from './trip-ai.schemas';
import { cleanRepeatedCatalogHeaders } from './trip-text-cleaning.service';
import { CATALOG_HOTELS_CARIBE_MX, CATALOG_HOTELS_CARIBE_PR, CATALOG_HOTELS_CARIBE_RD } from './catalog-hotel-seeds';
import { maxHotelPersistenceConfidence, MIN_HOTEL_CONFIDENCE, normKey } from './trip-hotels-extract.service';
import {
  extractMainDestinationFromTitle,
  extractTitleLineCandidate,
  isValidProductTitle,
} from './trip-segmentation-icarion';

export type DeterministicFicha = Partial<
  Pick<
    TripAiExtract,
    | 'title'
    | 'mainDestination'
    | 'durationDays'
    | 'durationNights'
    | 'indicativePrice'
    | 'currency'
    | 'description'
  >
> & {
    departureText?: string | null;
    servicesExcerpt?: string | null;
    notesExcerpt?: string | null;
    hotels?: TripAiExtract['hotels'];
  };

/**
 * Extrae campos obvios con regex, sin depender de la IA.
 * Usar como base y rellenar nulos con la salida del modelo.
 */
export class TripDeterministicExtractionService {
  /** `text` debe ser rawTextForAI (ya limpio de marcadores). */
  extractFromBlock(text: string, titleHint: string): DeterministicFicha {
    return extractDeterministicFicha(text, titleHint);
  }
}

const PRICE_EUR = /PRECIO\s+ORIENTATIVO\s*([\d.\s]{1,12})\s*€/i;
const DEP_STOP = /A\s+TENER\s+EN\s+CUENTA|PRECIO\s+ORIENTATIVO|SERVICIOS\s+INCLUIDOS|\bHOTELES\b|D[ÍI]A\s*1\b/i;
const DEP_BLOCK = new RegExp(
  `SALIDAS(?:\\s+20\\d{2}\\s*\\/\\s*20?\\d{2,4})?\\s*([\\s\\S]*?)(?=${DEP_STOP.source})`,
  'i',
);
const SVC = /SERVICIOS\s+INCLUIDOS\s*([\s\S]*?)(?=SALIDAS|A\s+TENER\s+EN\s+CUENTA|PRECIO|\bHOTELES\b|D[ÍI]A\s*1)/i;
const NOTAS = /A\s+TENER\s+EN\s+CUENTA\s*([\s\S]*?)(?=PRECIO\s+ORIENTATIVO|\bHOTELES\b|NOTAS\s+IMPORTANTES|D[ÍI]A)/i;

const HOTELES_SUBHEADER = /HOTELES(?:\s*\((?:indicados|o\s*similares|[^)]*indicados[^)]*)\))?\s*(?:Ciudad\s*Hotel)?[^\S\r\n]*/i;

function trimDepartureStops(s: string): string {
  const re = new RegExp(DEP_STOP.source, 'gi');
  const m = re.exec(s);
  if (m && m.index >= 0) return s.slice(0, m.index).replace(/\s+/g, ' ').trim();
  return s.replace(/\s+/g, ' ').trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pickHotelSeedsForTrip(titleHint: string, bodySample: string): readonly string[] {
  const th = titleHint.toUpperCase();
  if (/\bPUERTO\s+RICO/.test(th)) {
    return CATALOG_HOTELS_CARIBE_PR;
  }
  if (/\bREP[ÚU]BLICA\s+DOMINICANA|DOMINICAN/.test(th)) {
    return CATALOG_HOTELS_CARIBE_RD;
  }
  if (/\bCARIBE\s+MEXICANO|MAYAKOBA|RIVIERA|CANC[ÚU]N|XCARET|TUL[UÚ]M?/i.test(titleHint)) {
    return CATALOG_HOTELS_CARIBE_MX;
  }
  const b = `${titleHint}\n${bodySample}`.toUpperCase();
  if (/\bPUERTO\s+RICO/.test(b)) {
    return CATALOG_HOTELS_CARIBE_PR;
  }
  if (/\bREP[ÚU]BLICA\s+DOMINICANA|DOMINICAN|B[ÁA]VARO|CAP\s*CANA|PUNTA\s*CANA|LA\s*ROMANA|SAMAN[ÁA]/.test(b)) {
    return CATALOG_HOTELS_CARIBE_RD;
  }
  if (/\bCARIBE\s+MEXICANO|MAYAKOBA|RIVIERA|CANC[ÚU]N|XCARET|PLAYA/.test(b)) {
    return CATALOG_HOTELS_CARIBE_MX;
  }
  return [
    ...CATALOG_HOTELS_CARIBE_MX,
    ...CATALOG_HOTELS_CARIBE_RD,
    ...CATALOG_HOTELS_CARIBE_PR,
  ] as const;
}

function findKnownHotelsInText(
  text: string,
  seeds: readonly string[],
): { name: string; pos: number }[] {
  const byLen = [...seeds].sort((a, b) => b.length - a.length);
  const out: { name: string; pos: number }[] = [];
  const t = text;
  for (const name of byLen) {
    const m = t.match(new RegExp(escapeRe(name), 'i'));
    if (m && m.index !== undefined) {
      out.push({ name, pos: m.index });
    }
  }
  out.sort((a, b) => a.pos - b.pos);
  const seen = new Set<string>();
  return out.filter((x) => {
    const k = x.name.toLowerCase().normalize('NFC');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function isLikelyHotelNameLine(l: string): boolean {
  const t = l.replace(/^[·•\-\*]\s*/, '').replace(/\d+\.\s*/, '').trim();
  if (t.length < 5 || t.length > 200) {
    return false;
  }
  if (/^(CIUDAD|CITY|DÍA|DIA|D[ÍI]A|NOTA|PÁG|PAGE)\b/i.test(t)) {
    return false;
  }
  if (/^HOTELES(\s|\s*\()/i.test(t) && t.length < 100) {
    return false;
  }
  if (/^(del|vuelo|días|dias|salid|tarif|€|\$|precio|incl|segur)\b/i.test(t)) {
    return false;
  }
  return isValidHotelCandidateTableLine(t);
}

function isValidHotelCandidateTableLine(t: string): boolean {
  return maxHotelPersistenceConfidence(t) >= MIN_HOTEL_CONFIDENCE;
}

function linesFromHotelesSectionBlock(text: string): string[] {
  const m = text.match(
    new RegExp(
      `HOTELES\\s*\\((?:indicados|o\\s*similares|indicados\\s*o\\s*similares|[^)]+similares[^)]*)\\)[^\\S\\r\\n]*(?:C[ií]udad\\s*Hotel\\s*[^\\n]+)?[\\n\\r]+([\\s\\S]*?)(?=A\\s+TENER|(?:^|\\n)\\s*PRECIO\\s+ORIENTATIVO|(?:^|\\n)\\s*SERVICIOS|(?:^|\\n)\\s*SALIDAS|(?:^|\\n)\\s*D[ÍI]A\\s*1)`,
      'i',
    ),
  );
  if (m?.[1]) {
    return m[1]!
      .split(/\n+/)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter((l) => l.length > 0 && isLikelyHotelNameLine(l));
  }
  const hIdx = text.search(/\bHOTELES\b/i);
  if (hIdx < 0) return [];
  const rest = text.slice(hIdx + 'HOTELES'.length);
  const upTo = rest.search(
    /A\s+TENER|(?:\n|\r|^)\s*PRECIO\s+ORIENTATIVO|(?:\n|\r|^)\s*SERVICIOS|(?:\n|\r|^)\s*D[ÍI]A\s*1|(?:\n|\r|^)\s*SALIDAS\b/i,
  );
  const block = (upTo >= 0 ? rest.slice(0, upTo) : rest).split(/\n+/);
  const out: string[] = [];
  for (const line of block) {
    const cleaned = line.replace(HOTELES_SUBHEADER, '').replace(/\s+/g, ' ').trim();
    if (cleaned.length < 5) continue;
    if (isLikelyHotelNameLine(cleaned) && !/^HOTELES\s*$/i.test(cleaned)) {
      out.push(cleaned);
    }
  }
  return out;
}

function linesFromHotelesEnBlock(text: string): string[] {
  const m = text.match(
    /HOTELES\s+EN\s+[^\n]+\n([\s\S]{0,8000}?)(?=(?:\n)\s*PRECIO|(?:\n)\s*A\s+TENER|(?:\n)\s*CONSULTA|(?:\n{3,})|$)/i,
  );
  if (!m?.[1]) return [];
  return m[1]!
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-·•*]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0 && isLikelyHotelNameLine(l));
}

function hotelNameNormKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[.'´`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractHotelsDeterministic(
  preCleanedText: string,
  titleHint: string,
): NonNullable<DeterministicFicha['hotels']> {
  const text = cleanRepeatedCatalogHeaders(preCleanedText);
  const seeds = pickHotelSeedsForTrip(titleHint, text.slice(0, 4_000));
  const fromSeeds = findKnownHotelsInText(text, seeds);
  const extra = [...linesFromHotelesSectionBlock(text), ...linesFromHotelesEnBlock(text)].map((s) =>
    s.replace(/\s+/g, ' ').trim(),
  );

  const byKey = new Map<string, { name: string; pos: number }>();
  for (const { name, pos } of fromSeeds) {
    const k = hotelNameNormKey(name);
    if (!k) continue;
    if (!byKey.has(k) || (byKey.get(k)!.pos > pos)) {
      byKey.set(k, { name: name.replace(/\s+/g, ' ').trim(), pos });
    }
  }
  for (const line of extra) {
    if (!isLikelyHotelNameLine(line) || line.length < 5) continue;
    const k = hotelNameNormKey(line);
    if (byKey.has(k)) continue;
    const p = text.toLowerCase().indexOf(line.toLowerCase().slice(0, 18));
    byKey.set(k, { name: line, pos: p >= 0 ? p : 99_000 });
  }

  const sorted = Array.from(byKey.values())
    .sort((a, b) => a.pos - b.pos)
    .filter((h) => maxHotelPersistenceConfidence(h.name) >= MIN_HOTEL_CONFIDENCE);
  if (!sorted.length) {
    return [];
  }
  return sorted.map((h, i) => ({
    category: null,
    city: null,
    hotelName: h.name.replace(/\s+/g, ' ').trim(),
    order: i,
  }));
}

export function extractDeterministicFicha(
  preCleanedText: string,
  titleHint: string,
): DeterministicFicha {
  const text = cleanRepeatedCatalogHeaders(preCleanedText);
  const title = extractTitleLineCandidate(text) ?? cleanTitleHint(titleHint);
  const mainDest = extractMainDestinationFromTitle(text, title) ?? null;

  let durationDays: number | null = null;
  let durationNights: number | null = null;
  const durMatch = findBestDurationNearFicha(text);
  if (durMatch) {
    durationDays = durMatch[0]!;
    durationNights = durMatch[1]!;
  }

  let indicativePrice: number | null = null;
  const p = text.match(PRICE_EUR);
  if (p?.[1]) {
    const n = parseInt(p[1]!.replace(/\D/g, ''), 10);
    if (!Number.isNaN(n) && n > 0) indicativePrice = n;
  }

  let currency: string | null = /€/.test(text) ? 'EUR' : /US\$|\bUSD\b/i.test(text) ? 'USD' : 'EUR';

  let departureText: string | null = null;
  const dep = text.match(DEP_BLOCK);
  if (dep?.[1]) {
    departureText =
      trimDepartureStops(dep[1]!.replace(/\s+/g, ' ').trim())
        .slice(0, 1_200)
        .replace(/\bHOTELES\b.*/i, '')
        .trim() || null;
  }

  let servicesExcerpt: string | null = null;
  const s = text.match(SVC);
  if (s?.[1]) servicesExcerpt = s[1]!.replace(/\s+/g, ' ').trim().slice(0, 2_000) || null;

  let notesExcerpt: string | null = null;
  const n0 = text.match(NOTAS);
  if (n0?.[1]) notesExcerpt = n0[1]!.replace(/\s+/g, ' ').trim().slice(0, 1_200) || null;

  const hotels = extractHotelsDeterministic(text, titleHint);

  return {
    title: title || undefined,
    mainDestination: mainDest,
    durationDays,
    durationNights,
    indicativePrice: indicativePrice ?? null,
    currency: indicativePrice != null ? currency : null,
    description: null,
    departureText,
    servicesExcerpt,
    notesExcerpt,
    hotels: hotels.length > 0 ? hotels : undefined,
  };
}

function findBestDurationNearFicha(t: string): [number, number] | null {
  const head = t.slice(0, 20_000);
  const re = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/g;
  let m: RegExpExecArray | null;
  let best: [number, number] | null = null;
  while ((m = re.exec(head)) !== null) {
    const a = parseInt(m[1]!, 10);
    const b = parseInt(m[2]!, 10);
    if (a < 2 || a > 45 || b < 0 || b > 40) continue;
    best = [a, b];
    if (/\b(?:7|11|13|14)\s*\/\s*(?:5|8|10|11)\b/.test(m[0]!)) {
      return best;
    }
  }
  return best;
}

function cleanTitleHint(s: string): string {
  return s
    .replace(/\s*20\d{2}\s*\/\s*20?\d{2,4}\s*/gi, ' ')
    .replace(/D[ÍI]A\s*1.*/i, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

/**
 * Fusión: el modelo gana en campos rellenados; el determinista rellena nulls.
 */
export function mergeDeterministicWithAi(
  det: DeterministicFicha,
  ai: TripAiExtract,
  titleSeg: string,
): TripAiExtract {
  const dT = det.title && isValidProductTitle(det.title) ? det.title : null;
  const aT = ai.title && isValidProductTitle(ai.title) ? ai.title : null;
  const sT = isValidProductTitle(titleSeg) ? titleSeg : null;
  const t =
    dT ??
    aT ??
    sT ??
    (ai.title && ai.title.length > 2 && !looksLikeGarbageTitle(ai.title) ? ai.title : null) ??
    'Viaje (sin título)';
  const mainDest = dT ? (det.mainDestination ?? ai.mainDestination) : (ai.mainDestination ?? det.mainDestination ?? null);
  const departures: TripAiExtract['departures'] = det.departureText
    ? [
        {
          departureText: det.departureText,
          startDate: ai.departures[0]?.startDate ?? null,
          endDate: ai.departures[0]?.endDate ?? null,
          weekdays: ai.departures[0]?.weekdays ?? null,
          order: 0,
        },
      ]
    : ai.departures;

  const detF = (det.hotels && det.hotels.length > 0 ? det.hotels : [])
    .filter(
      (h) =>
        h.hotelName && maxHotelPersistenceConfidence(h.hotelName) >= MIN_HOTEL_CONFIDENCE,
    )
    .map((h, i) => ({ ...h, order: h.order ?? i }));
  const aiF = (ai.hotels || []).filter(
    (h) => h.hotelName && maxHotelPersistenceConfidence(h.hotelName) >= MIN_HOTEL_CONFIDENCE,
  );
  const hotels: TripAiExtract['hotels'] = [];
  const seen = new Set<string>();
  for (const h of detF) {
    const k = normKey(h.hotelName!);
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    hotels.push({ ...h, order: hotels.length });
  }
  for (const h of aiF) {
    const k = normKey(h.hotelName!);
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    hotels.push({ ...h, order: hotels.length });
  }

  return {
    ...ai,
    title: t,
    mainDestination: mainDest,
    description: ai.description ? cleanRepeatedCatalogHeaders(String(ai.description)) : ai.description,
    durationDays: ai.durationDays ?? det.durationDays ?? null,
    durationNights: ai.durationNights ?? det.durationNights ?? null,
    indicativePrice: ai.indicativePrice ?? det.indicativePrice ?? null,
    currency: ai.currency ?? (det.indicativePrice != null ? det.currency ?? 'EUR' : null),
    services:
      ai.services.length > 0
        ? ai.services
        : det.servicesExcerpt
          ? [{ type: 'INCLUDED' as const, text: det.servicesExcerpt, order: 0 }]
          : [],
    departures,
    hotels,
    observations:
      ai.observations.length > 0
        ? ai.observations
        : det.notesExcerpt
          ? [{ text: det.notesExcerpt, order: 0 }]
          : [],
  };
}

function looksLikeGarbageTitle(s: string): boolean {
  if (/D[ÍI]A\s*\d/i.test(s) && s.length < 30) return true;
  if (/HOTELES\s+EN/i.test(s)) return true;
  if (s.length > 5 && s === s.toUpperCase() && /BANYAN|HYATT|RITZ|VICEROY|PARADISUS/i.test(s) && !/DE\s+LUJO|ENCANTOS/i.test(s)) {
    return true;
  }
  return false;
}
