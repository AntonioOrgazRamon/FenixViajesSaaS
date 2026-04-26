import type { TripAiExtract } from './trip-ai.schemas';
import { cleanRepeatedCatalogHeaders } from './trip-text-cleaning.service';
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
> & { departureText?: string | null; servicesExcerpt?: string | null; notesExcerpt?: string | null };

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
const DEP_BLOCK = /SALIDAS(?:\s+20\d{2}\s*\/\s*20?\d{2,4})?\s*([\s\S]*?)(?=A\s+TENER\s+EN\s+CUENTA|PRECIO\s+ORIENTATIVO|HOTELES\s+EN|SERVICIOS|D[ÍI]A\s*1)/i;
const SVC = /SERVICIOS\s+INCLUIDOS\s*([\s\S]*?)(?=SALIDAS|A\s+TENER\s+EN\s+CUENTA|PRECIO|HOTELES\s+EN)/i;
const NOTAS = /A\s+TENER\s+EN\s+CUENTA\s*([\s\S]*?)(?=PRECIO\s+ORIENTATIVO|HOTELES\s+EN|NOTAS\s+IMPORTANTES|D[ÍI]A)/i;

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
  if (dep?.[1]) departureText = dep[1]!.replace(/\s+/g, ' ').trim().slice(0, 1_200) || null;

  let servicesExcerpt: string | null = null;
  const s = text.match(SVC);
  if (s?.[1]) servicesExcerpt = s[1]!.replace(/\s+/g, ' ').trim().slice(0, 2_000) || null;

  let notesExcerpt: string | null = null;
  const n0 = text.match(NOTAS);
  if (n0?.[1]) notesExcerpt = n0[1]!.replace(/\s+/g, ' ').trim().slice(0, 1_200) || null;

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
  return {
    ...ai,
    title: t,
    mainDestination: mainDest,
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
    departures:
      ai.departures.length > 0
        ? ai.departures
        : det.departureText
          ? [
              {
                departureText: det.departureText,
                startDate: null,
                endDate: null,
                weekdays: null,
                order: 0,
              },
            ]
          : [],
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
