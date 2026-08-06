/**
 * FASE 2 — Segmentar el ficha de un viaje en bloques lógicos sin mezclar.
 */

const RE_SERVICIOS = /SERVICIOS\s+INCLUIDOS/i;
const RE_SALIDAS = /\bSALIDAS(?:\s+20\d{2}\s*\/\s*20?\d{2,4})?/i;
const RE_TENER = /A\s+TENER\s+EN\s+CUENTA/i;
const RE_PRECI0 = /PRECIO\s+ORIENTATIVO/i;
const RE_HOTELES = /\bHOTELES\b/i;
/** Primer ancla de itinerario: Día 1, Días 2, etc. */
const RE_DIA = /\bD[ÍI]A(S)?\s*(\d{1,2}|\d{1,2}\s*[-–]\s*\d{1,2})/i;

function sliceBetween(
  s: string,
  start: RegExp,
  endMarkers: { re: RegExp; from: number }[],
  from = 0,
): string {
  const sub = s.slice(from);
  const m = sub.match(start);
  if (!m || m.index === undefined) return '';
  const a = from + m.index + m[0]!.length;
  let b = s.length;
  for (const { re, from: fr } of endMarkers) {
    const i = s.slice(Math.max(a, fr)).search(re);
    if (i >= 0) b = Math.min(b, Math.max(a, fr) + i);
  }
  return s.slice(a, b).trim();
}

/**
 * Convierte texto ficha (ya profundamente limpio) en bloques. Si falta sección, string vacío.
 */
export function segmentTouristicDocument(t: string): {
  descriptionBlock: string;
  mainTripBlock: string;
  servicesBlock: string;
  departuresBlock: string;
  hotelsTableBlock: string;
  hotelDescriptionsBlock: string;
  observationsBlock: string;
} {
  const text = t.replace(/\r\n/g, '\n');
  const d1 = text.search(RE_DIA);
  const svcI = text.search(RE_SERVICIOS);
  const salI = text.search(RE_SALIDAS);
  const descriptionBlock = d1 > 0 ? text.slice(0, d1).replace(/\n{2,}/g, '\n').trim() : '';
  let mainEnd = text.length;
  if (d1 >= 0) {
    const candidates = [svcI, salI].filter((i) => i > d1);
    mainEnd = candidates.length > 0 ? Math.min(...candidates) : text.length;
  }
  let mainTripBlock =
    d1 >= 0 && mainEnd > d1 ? text.slice(d1, mainEnd).trim() : '';
  if (!mainTripBlock && d1 >= 0) {
    const tail = text.slice(d1);
    const cut = tail.search(RE_SERVICIOS) >= 0 ? tail.split(RE_SERVICIOS)[0]! : tail;
    mainTripBlock = (cut.split(RE_SALIDAS)[0] ?? cut).trim();
  }

  const servicesBlock = sliceBetween(
    text,
    RE_SERVICIOS,
    [
      { re: RE_SALIDAS, from: 0 },
      { re: RE_TENER, from: 0 },
      { re: RE_PRECI0, from: 0 },
    ],
  );

  const afterSalidasStart = text.search(RE_SALIDAS);
  let departuresBlock = '';
  if (afterSalidasStart >= 0) {
    departuresBlock = sliceBetween(
      text,
      new RegExp(`SALIDAS(?:\\s+20\\d{2}\\s*\\/\\s*20?\\d{2,4})?`, 'i'),
      [
        { re: RE_TENER, from: 0 },
        { re: RE_PRECI0, from: 0 },
        { re: RE_HOTELES, from: 0 },
        { re: RE_DIA, from: afterSalidasStart + 20 },
      ],
      afterSalidasStart,
    );
  }

  const hIdx = text.search(new RegExp(`HOTELES\\s*(?:\\([^)]*\\))?`, 'i'));
  const tenerAfterH = hIdx >= 0 ? text.slice(hIdx).search(RE_TENER) : -1;
  const precioAfterH = hIdx >= 0 ? text.slice(hIdx).search(RE_PRECI0) : -1;
  let hEnd = text.length;
  if (hIdx >= 0) {
    if (tenerAfterH > 0) hEnd = Math.min(hEnd, hIdx + tenerAfterH);
    if (precioAfterH > 0) hEnd = Math.min(hEnd, hIdx + precioAfterH);
  }
  const rawHoteles = hIdx >= 0 ? text.slice(hIdx, hEnd) : '';
  const { table, longForm } = splitHotelsTableVsDescriptions(rawHoteles);
  return {
    descriptionBlock,
    mainTripBlock: mainTripBlock || '',
    servicesBlock,
    departuresBlock,
    hotelsTableBlock: table,
    hotelDescriptionsBlock: longForm,
    observationsBlock: sliceBetween(
      text,
      RE_TENER,
      [
        { re: RE_PRECI0, from: 0 },
        { re: RE_SALIDAS, from: 0 },
        { re: new RegExp(`^\\s*NOTAS\\s+IMPORTANTES`, 'im'), from: 0 },
      ],
    ),
  };
}

/**
 * Separa líneas tipo "Ciudad — Hotel" / bullet de párrafos de marketing del hotel
 */
function splitHotelsTableVsDescriptions(hBlock: string): { table: string; longForm: string } {
  if (!hBlock.trim()) {
    return { table: '', longForm: '' };
  }
  const lines = hBlock.split(/\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const table: string[] = [];
  const prose: string[] = [];
  for (const l of lines) {
    if (!l || l.length < 3) continue;
    if (RE_HOTELES.test(l) && l.length < 120) {
      table.push(l);
      continue;
    }
    if (l.length > 140) {
      prose.push(l);
      continue;
    }
    if (/\b(RESORT|HOTEL|&|BY|SPA)\b/i.test(l) && l.length < 120) {
      table.push(l);
      continue;
    }
    if (l.length < 100 && (/\b(CANCÚN|PLAYA|PUNTA|BAV|LA\s*ROMA|CAP\s*CANA)\b/i.test(l) || l.includes('—') || l.includes('–') || l.includes(' - '))) {
      table.push(l);
      continue;
    }
    if (l.length > 90 && /\b(ubicación|disfrutar|disfrute|jardín|playa|ideal)\b/i.test(l)) {
      prose.push(l);
    } else {
      table.push(l);
    }
  }
  return {
    table: table.join('\n'),
    longForm: prose.join('\n\n'),
  };
}

export class TripDocumentBlocksService {
  segment(cleanedText: string) {
    return segmentTouristicDocument(cleanedText);
  }
}
