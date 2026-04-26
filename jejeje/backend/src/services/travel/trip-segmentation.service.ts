import type { PageText } from './pdf-extraction.service';
import { buildIcarionSegments } from './trip-segmentation-icarion';

/**
 * FASE 4 — Heurísticas para separar un catálogo en posibles viajes (Icárion: por página real,
 * señales de ficha, no un título en mayúsculas por línea). Produce candidatos para IA / revisión.
 */
export type RawTripSegment = {
  pageStart: number;
  pageEnd: number;
  title: string;
  /** Incluye marcadores internos; útil para depuración o audit. */
  text: string;
  /** Texto sin `--- Pág. real` ni cabeceras repetidas; el que se envía a la IA. */
  rawTextForAI: string;
  kind: 'trip' | 'skip';
  skipReason?: 'index' | 'legal' | 'cover' | 'toc' | 'empty';
};

export class TripSegmentationService {
  segmentFromPages(pages: PageText[]): RawTripSegment[] {
    if (!pages.length) {
      return [];
    }
    const { segments } = buildIcarionSegments(
      pages.map((p) => ({ page: p.page, text: p.text })),
      { log: true },
    );
    return segments.map((s) => ({
      pageStart: s.pageStart,
      pageEnd: s.pageEnd,
      title: s.title,
      text: s.text,
      rawTextForAI: s.rawTextForAI,
      kind: s.kind as 'trip',
    }));
  }
}
