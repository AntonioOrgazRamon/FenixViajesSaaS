import type { TravelSearchIntent } from '../travel/travel-search.schema';
import type { TravelTripSearchRow } from '../travel/travel-search.scoring';
import type { ValidationIssue } from './types';

export type CatalogStats = {
  count: number;
  minPrice: number | null;
  maxPrice: number | null;
  missingPriceCount: number;
};

export function computeCatalogStats(rows: TravelTripSearchRow[]): CatalogStats {
  let minP: number | null = null;
  let maxP: number | null = null;
  let missing = 0;
  for (const r of rows) {
    if (r.indicativePrice == null) {
      missing++;
      continue;
    }
    const n = parseFloat(r.indicativePrice);
    if (!Number.isFinite(n)) {
      missing++;
      continue;
    }
    minP = minP == null ? n : Math.min(minP, n);
    maxP = maxP == null ? n : Math.max(maxP, n);
  }
  return { count: rows.length, minPrice: minP, maxPrice: maxP, missingPriceCount: missing };
}

/**
 * Validaciones de intención / catálogo (no sustituyen a constraints por viaje).
 */
export function validateIntentAndCatalog(
  intent: TravelSearchIntent,
  stats: CatalogStats,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (stats.count === 0) {
    issues.push({
      code: 'CATALOG_EMPTY',
      severity: 'BLOCK',
      message: 'No hay viajes aprobados en catálogo.',
      messageCustomer: 'Aún no hay circuitos publicados; importe o apruebe viajes antes de recomendar.',
    });
    return issues;
  }

  const vague =
    !intent.destination?.trim() &&
    intent.durationDays == null &&
    intent.budgetPerPerson == null &&
    !intent.travelType?.trim() &&
    !(intent.tags?.length) &&
    !(intent.preferences?.length);
  if (vague) {
    issues.push({
      code: 'INTENT_TOO_VAGUE',
      severity: 'CLARIFICATION',
      message: 'Intención vacía o demasiado genérica.',
      messageCustomer:
        'No hay criterios suficientes (destino, duración, presupuesto o preferencias); las recomendaciones serán orientativas.',
    });
  }

  if (intent.durationDays != null && (intent.durationDays < 2 || intent.durationDays > 45)) {
    issues.push({
      code: 'DURATION_UNUSUAL',
      severity: 'WARN',
      message: `Duración ${intent.durationDays} días fuera del rango típico (2–45).`,
    });
  }

  if (
    intent.budgetPerPerson != null &&
    stats.minPrice != null &&
    intent.budgetPerPerson < stats.minPrice * 0.85
  ) {
    issues.push({
      code: 'BUDGET_BELOW_CATALOG_FLOOR',
      severity: 'WARN',
      message: `Presupuesto orientativo por debajo del mínimo del catálogo (~${Math.round(stats.minPrice)}).`,
      messageCustomer:
        'El presupuesto indicado está por debajo de los circuitos publicados; considere ampliar presupuesto u ofertas a medida.',
    });
  }

  if (stats.missingPriceCount === stats.count && intent.budgetPerPerson != null) {
    issues.push({
      code: 'CATALOG_PRICE_BLIND',
      severity: 'WARN',
      message: 'Ningún viaje tiene precio orientativo; el ajuste presupuestario será limitado.',
    });
  }

  return issues;
}
