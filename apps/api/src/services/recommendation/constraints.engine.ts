import { intentEffectiveBudgetPerPerson, type TravelSearchIntent } from '../travel/travel-search.schema';
import type { TravelTripSearchRow } from '../travel/travel-search.scoring';
import type { ConstraintEvaluation, ConstraintViolation, RecommendationPolicy } from './types';
import { normalizeKey } from '../travel/travel-search.scoring';

export type ConstraintContext = {
  destinationPoints: number;
  numericPrice: number | null;
  /** Si la intención incluye destino explícito. */
  explicitDestination: boolean;
  /** Umbral mínimo de puntos de destino para el pool principal. */
  mainPoolDestMin: number;
};

function providerBlocked(provider: string | null | undefined, blocked: string[]): boolean {
  const k = normalizeKey(provider ?? '');
  if (!k || !blocked.length) return false;
  return blocked.some((b) => k === b || k.includes(b) || b.includes(k));
}

/**
 * Evalúa restricciones por viaje. HARD → eligible=false excluye del ranking principal.
 * Las violaciones SOFT se traducen en penalty aplicado después del score base.
 */
export function evaluateConstraints(
  intent: TravelSearchIntent,
  trip: TravelTripSearchRow,
  policy: RecommendationPolicy,
  ctx: ConstraintContext,
): ConstraintEvaluation {
  const violations: ConstraintViolation[] = [];
  let eligible = true;
  let softPenaltyTotal = 0;

  const blocked = policy.blockedProviders ?? [];
  if (providerBlocked(trip.provider, blocked)) {
    violations.push({
      code: 'PROVIDER_BLACKLIST',
      kind: 'POLICY',
      message: `Proveedor no permitido por política de la empresa (${trip.provider ?? '—'}).`,
      messageCustomer: 'Esta opción no está disponible por política comercial de la agencia.',
    });
    eligible = false;
  }

  const ratioLimit = policy.maxBudgetHardRatio ?? 1.55;
  const budgetCap = intentEffectiveBudgetPerPerson(intent);
  if (
    budgetCap != null &&
    ctx.numericPrice != null &&
    ctx.numericPrice > budgetCap * ratioLimit
  ) {
    violations.push({
      code: 'BUDGET_OVERFLOW_HARD',
      kind: 'HARD',
      message: `Precio orientativo muy por encima del presupuesto (> ${Math.round(ratioLimit * 100)}%).`,
      messageCustomer:
        'Precio estimado muy por encima del presupuesto indicado; descartado del ranking principal.',
    });
    eligible = false;
  }

  if (ctx.explicitDestination && ctx.destinationPoints < ctx.mainPoolDestMin) {
    violations.push({
      code: 'DESTINATION_MISMATCH_HARD',
      kind: 'HARD',
      message: 'Destino del catálogo no encaja con el solicitado (umbral principal).',
      messageCustomer:
        'Este circuito no coincide con el destino pedido; no se muestra como recomendación principal.',
    });
    eligible = false;
  }

  // SOFT: presupuesto algo por encima pero no catastrófico
  if (
    eligible &&
    budgetCap != null &&
    ctx.numericPrice != null &&
    ctx.numericPrice > budgetCap * 1.15 &&
    ctx.numericPrice <= budgetCap * ratioLimit
  ) {
    violations.push({
      code: 'BUDGET_SOFT_STRETCH',
      kind: 'SOFT',
      message: 'Precio orientativo por encima del presupuesto (ajuste comercial).',
      penaltyPoints: 6,
    });
    softPenaltyTotal += 6;
  }

  if (eligible && intent.durationDays != null && trip.durationDays != null) {
    const diff = Math.abs(trip.durationDays - intent.durationDays);
    if (diff >= 6) {
      violations.push({
        code: 'DURATION_SOFT_DRIFT',
        kind: 'SOFT',
        message: `Duración del circuito se aleja ${diff} días de la intención.`,
        penaltyPoints: 4,
      });
      softPenaltyTotal += 4;
    }
  }

  return { eligible, violations, softPenaltyTotal };
}
