/**
 * FASE 3 — Extracción a JSON estructurado (catálogo turístico) y fusión con TripAiExtract.
 */

import type { TripAiExtract } from './trip-ai.schemas';
import type { StructuredTripCatalog } from './trip-structured-catalog.schema';
import { structuredTripCatalogZ } from './trip-structured-catalog.schema';
import { extractDeterministicFicha } from './trip-deterministic-extraction.service';
import { extractMainDestinationFromTitle, extractTitleLineCandidate } from './trip-segmentation-icarion';
import { segmentTouristicDocument } from './trip-document-blocks.service';
import { extractCleanHotelsFromBlocks, filterHotelsForPersistence, normKey, normalizeHotelName } from './trip-hotels-extract.service';

const RE_ITIN_CUT =
  /\b(SERVICIOS\s+INCLUIDOS|HOTELES(?:\s*\(|\s+EN)?|PRECIO\s+ORIENTATIVO|SALIDAS|EXPERIENCIAS\s+(?:DESTACADAS|OPCIONALES))\b/i;
const RE_NEW_FICHA_HEAD =
  /(?:^|\n)\s*[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9\s,'\-]{6,80}\n[^\n]{4,140}\n\s*\d{1,2}\s*\/\s*\d{1,2}\b/m;

function cutAtTripTailNoise(s: string): string {
  const cands: number[] = [];
  const m1 = s.search(RE_ITIN_CUT);
  if (m1 >= 0) cands.push(m1);
  const m2 = s.search(RE_NEW_FICHA_HEAD);
  if (m2 >= 0) cands.push(m2);
  if (cands.length === 0) return s.trim();
  return s.slice(0, Math.min(...cands)).trim();
}

function parseItineraryFromBlock(mainTripBlock: string): StructuredTripCatalog['itineraryDays'] {
  if (!mainTripBlock.trim()) return [];
  const s = mainTripBlock;
  const re = /\bD[ÍI]A(S)?\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?/gi;
  const hits: { idx: number; end: number; d: number; d2?: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const d = parseInt(m[2]!, 10);
    const d2 = m[3] != null ? parseInt(m[3]!, 10) : undefined;
    hits.push({ idx: m.index, end: m.index + m[0]!.length, d, d2 });
  }
  if (hits.length === 0) return [];
  const out: StructuredTripCatalog['itineraryDays'] = [];
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i]!;
    const next = hits[i + 1];
    const body0 = s.slice(h.end, next ? next.idx : s.length).trim();
    const body = cutAtTripTailNoise(body0);
    const lines = body.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const first = lines[0] ?? '';
    const rest = lines.slice(1).join('\n') || (first.length > 1 ? body.slice(first.length).trim() : '');
    const defTitle = h.d2 != null ? `Días ${h.d}–${h.d2}` : `Día ${h.d}`;
    out.push({
      dayNumber: h.d,
      title: first ? first.slice(0, 500) : defTitle,
      description: first ? (rest || null) : body || null,
      order: i,
    });
  }
  return out;
}

function parseServicesList(servicesBlock: string): StructuredTripCatalog['services'] {
  if (!servicesBlock.trim()) return [];
  const t = servicesBlock.replace(/^\s*:\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const byBullet = t.split(/\n/).flatMap((line) => {
    const x = line.replace(/^[·•\-\*]\s*/, '').trim();
    return x ? [x] : [];
  });
  const use = byBullet.length > 1 ? byBullet : t.split(/;|\.(?=\s)/).map((x) => x.trim()).filter((x) => x.length > 2);
  return use.slice(0, 60).map((text, i) => ({ text, order: i }));
}

function parseDepartureList(departuresBlock: string): StructuredTripCatalog['departures'] {
  const t = departuresBlock.replace(/\s+/g, ' ').trim();
  if (t.length < 3) return [];
  return [{ text: t.slice(0, 1_200), order: 0 }];
}

function parseObservations(obsBlock: string): StructuredTripCatalog['observations'] {
  const t = obsBlock.replace(/\s+/g, ' ').trim();
  if (t.length < 10) return [];
  const parts = t.split(/(?<=[.!?])\s+/).filter((p) => p.length > 8);
  return (parts.length > 0 ? parts : [t])
    .slice(0, 20)
    .map((text, i) => ({ text: text.slice(0, 2_000), order: i }));
}

function buildDescriptions(descriptionBlock: string): { short: string | null; semantic: string | null } {
  if (!descriptionBlock.trim()) {
    return { short: null, semantic: null };
  }
  const cleaned = descriptionBlock
    .replace(/(?:^|\n)\s*[A-ZÁÉÍÓÚÑ]+\s+20\d{2}\s*\/\s*20?\d{2,4}\s*/g, '\n')
    .replace(/\b[A-ZÁÉÍÓÚÑ]+\s+20\d{2}\s*\/\s*20?\d{2,4}\b/g, ' ')
    .replace(/\b([A-ZÁÉÍÓÚÑ]{3,}\s+20\d{2}\s*\/\s*20?\d{2,4})\1+\b/g, '$1')
    .trim();
  const p = cleaned.split(/\n\n+/);
  const first = (p[0] ?? '').replace(/\s+/g, ' ').trim();
  const short = first.length > 400 ? `${first.slice(0, 397).trimEnd()}…` : first;
  return {
    short: short || null,
    semantic: descriptionBlock.replace(/\s+/g, ' ').trim() || null,
  };
}

function scoreStructured(
  s: Pick<
    StructuredTripCatalog,
    | 'itineraryDays'
    | 'services'
    | 'hotels'
    | 'departures'
    | 'observations'
    | 'shortDescription'
    | 'durationDays'
    | 'durationNights'
  >,
): number {
  let c = 0.2;
  if (s.itineraryDays.length > 0) c += Math.min(0.25, 0.04 * s.itineraryDays.length);
  if (s.services.length > 0) c += 0.12;
  if (s.hotels.length > 0) c += Math.min(0.15, 0.02 * s.hotels.length);
  if (s.departures.length > 0) c += 0.08;
  if (s.observations.length > 0) c += 0.05;
  if (s.shortDescription && s.shortDescription.length > 30) c += 0.1;
  if (s.durationDays != null) c += 0.1;
  if (s.durationNights != null) c += 0.04;
  return Math.min(0.92, Math.round(c * 100) / 100);
}

type Blocks = ReturnType<typeof segmentTouristicDocument>;

/**
 * FASE 3: rellena el JSON canónico a partir de bloques + texto ficha.
 */
export function extractStructuredTripCatalog(
  blocks: Blocks,
  titleHint: string,
  cleanedFullText: string,
): StructuredTripCatalog {
  const det = extractDeterministicFicha(cleanedFullText, titleHint);
  const { short, semantic } = buildDescriptions(blocks.descriptionBlock);
  const itineraryDays = parseItineraryFromBlock(blocks.mainTripBlock);
  const title = extractTitleLineCandidate(cleanedFullText) || titleHint.slice(0, 500) || 'Viaje';
  const mainDestination = extractMainDestinationFromTitle(cleanedFullText, title) || null;
  const fromBlocksServices = parseServicesList(blocks.servicesBlock);
  const fromBlocksDeps = parseDepartureList(blocks.departuresBlock);
  const services =
    fromBlocksServices.length > 0
      ? fromBlocksServices
      : det.servicesExcerpt
        ? det.servicesExcerpt
            .split(/\.(?=\s|[A-Z])/)
            .map((x) => x.trim())
            .filter((x) => x.length > 2)
            .slice(0, 40)
            .map((text, i) => ({ text, order: i }))
        : [];
  const departures =
    fromBlocksDeps.length > 0
      ? fromBlocksDeps
      : det.departureText
        ? [{ text: det.departureText, order: 0 }]
        : [];
  const cleanHotels = extractCleanHotelsFromBlocks({
    hotelsTableBlock: blocks.hotelsTableBlock,
    hotelDescriptionsBlock: blocks.hotelDescriptionsBlock,
    fullSegmentText: cleanedFullText,
    title,
    mainDestination: mainDestination ?? undefined,
  });
  const asRows = cleanHotels.hotels.map((h, i) => ({
    category: h.category ?? null,
    city: h.city,
    hotelName: h.hotelName,
    order: i,
  }));
  const visualWhitelistNormKeys = new Set(
    asRows
      .map((h) => h.hotelName ?? '')
      .filter(Boolean)
      .map((x) => normKey(normalizeHotelName(x))),
  );
  const hotelPass = filterHotelsForPersistence(asRows, { visualWhitelistNormKeys });
  const hotels: StructuredTripCatalog['hotels'] = hotelPass.kept.map((h, i) => ({
    city: h.city,
    category: h.category ?? null,
    hotelName: h.hotelName,
    order: i,
  }));
  const observations = parseObservations(blocks.observationsBlock);

  const out: StructuredTripCatalog = {
    title,
    mainDestination,
    shortDescription: short,
    semanticDescription: semantic,
    durationDays: det.durationDays ?? null,
    durationNights: det.durationNights ?? null,
    itineraryDays,
    services,
    departures,
    hotels,
    observations,
    confidenceScore: 0,
  };
  out.confidenceScore = scoreStructured({
    ...out,
    shortDescription: out.shortDescription,
    durationDays: out.durationDays,
    durationNights: out.durationNights,
  });
  if (out.hotels.length === 0) {
    out.confidenceScore = Math.max(0, Math.min(0.99, out.confidenceScore - 0.1));
  }
  return structuredTripCatalogZ.parse(out);
}

/**
 * Fusión: el JSON estructurado **prioriza** listas (itinerario, hoteles, observaciones) cuando aporta contenido
 * fiable; el resto se mantiene desde el merge det+ia previo.
 */
export function mergeStructuredIntoTripExtract(
  st: StructuredTripCatalog,
  merged: TripAiExtract,
): TripAiExtract {
  const descriptionParts = [st.shortDescription, st.semanticDescription]
    .filter((x) => x != null && x.trim() !== '') as string[];
  const desc =
    descriptionParts.length > 0
      ? descriptionParts.join('\n\n')
      : merged.description;

  const itinerary =
    st.itineraryDays.length > 0
      ? st.itineraryDays.map((d) => ({
          dayNumber: d.dayNumber,
          title: d.title ?? null,
          description: d.description ?? null,
          meals: null,
          accommodation: null,
          order: d.order,
        }))
      : merged.itineraryDays;

  const services =
    st.services.length > 0
      ? st.services.map((s) => ({
          type: 'INCLUDED' as const,
          text: s.text,
          order: s.order,
        }))
      : merged.services;

  const departures =
    st.departures.length > 0
      ? st.departures.map((d) => ({
          departureText: d.text,
          startDate: merged.departures[0]?.startDate ?? null,
          endDate: merged.departures[0]?.endDate ?? null,
          weekdays: merged.departures[0]?.weekdays ?? null,
          order: d.order,
        }))
      : merged.departures;

  const fromExtract = filterHotelsForPersistence(merged.hotels);
  const pre =
    st.hotels.length > 0
      ? st.hotels.map((h) => ({
          category: h.category ?? null,
          city: h.city,
          hotelName: h.hotelName,
          order: h.order,
        }))
      : fromExtract.kept.map((h, i) => ({
          category: h.category,
          city: h.city,
          hotelName: h.hotelName,
          order: i,
        }));
  const preWhitelistNormKeys = new Set(
    pre
      .map((h) => h.hotelName ?? '')
      .filter(Boolean)
      .map((x) => normKey(normalizeHotelName(x))),
  );
  const finalH = filterHotelsForPersistence(pre, { visualWhitelistNormKeys: preWhitelistNormKeys });
  const hotels = finalH.kept.map((h, i) => ({
    category: h.category,
    city: h.city,
    hotelName: h.hotelName,
    order: i,
  }));

  const observations =
    st.observations.length > 0
      ? st.observations.map((o) => ({ text: o.text, order: o.order }))
      : merged.observations;

  const baseConf =
    st.confidenceScore > 0.25 ? Math.max(st.confidenceScore, merged.confidence ?? 0) : (merged.confidence ?? null);
  const newConf =
    hotels.length === 0
      ? baseConf != null
        ? Math.min(baseConf, 0.35)
        : 0.22
      : baseConf;

  return {
    ...merged,
    title: st.title && st.title.length > 2 ? st.title : merged.title,
    mainDestination: st.mainDestination ?? merged.mainDestination,
    description: desc ?? merged.description,
    durationDays: st.durationDays ?? merged.durationDays ?? null,
    durationNights: st.durationNights ?? merged.durationNights ?? null,
    itineraryDays: itinerary,
    services,
    departures,
    hotels,
    observations,
    confidence: newConf,
  };
}

export class TripStructuredCatalogExtractService {
  extract(
    blocks: Blocks,
    title: string,
    cleanedFull: string,
  ) {
    return extractStructuredTripCatalog(blocks, title, cleanedFull);
  }
  merge(st: StructuredTripCatalog, base: TripAiExtract) {
    return mergeStructuredIntoTripExtract(st, base);
  }
}
