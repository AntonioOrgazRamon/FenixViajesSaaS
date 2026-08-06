import { Prisma } from '@prisma/client';
import type { TripAiExtract } from './trip-ai.schemas';
import { cleanRepeatedCatalogHeaders } from './trip-text-cleaning.service';

/**
 * FASE 6 — Limpieza, normalización de nombres y desduplicado en memoria.
 */
export class TripNormalizationService {
  normalizeTripStrings(t: TripAiExtract): TripAiExtract {
    return {
      ...t,
      title: this.normalizeText(t.title) || t.title,
      provider: this.normalizeText(t.provider),
      season: this.normalizeText(t.season),
      mainDestination: this.normalizeText(t.mainDestination),
      description: this.normalizeText(
        t.description != null && t.description !== '' ? cleanRepeatedCatalogHeaders(t.description) : t.description,
      ),
      currency: t.currency
        ? (this.normalizeText(t.currency) || t.currency).slice(0, 3).toUpperCase()
        : null,
      destinations: t.destinations.map((d) => ({
        ...d,
        name: this.normalizeText(d.name) || d.name,
      })),
    };
  }

  normalizeText(s: string | null | undefined): string | null {
    if (s == null) return null;
    const t = s.replace(/\s+/g, ' ').trim();
    return t.length ? t : null;
  }

  normalizeNameKey(s: string): string {
    return s
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  buildPrice(d: TripAiExtract): Prisma.Decimal | null {
    if (d.indicativePrice == null) return null;
    return new Prisma.Decimal(d.indicativePrice);
  }

  /** Devuelve lista de destinos sin duplicar por (type, key) */
  dedupeDestinations(dest: TripAiExtract['destinations']): TripAiExtract['destinations'] {
    const seen = new Set<string>();
    const out: TripAiExtract['destinations'] = [];
    for (const x of dest) {
      const k = `${x.type}:${this.normalizeNameKey(x.name)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        name: this.normalizeText(x.name) || x.name,
        type: x.type,
      });
    }
    return out;
  }
}
