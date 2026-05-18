import { createHash } from 'crypto';
import type { TravelSearchIntent } from '../../travel/travel-search.schema';
import { inferBudgetTierLabel } from './intent-tier.util';

function monthNameEs(m: number): string | null {
  const names = [
    '',
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  return m >= 1 && m <= 12 ? names[m]! : null;
}

/**
 * Query textual única para embedding de la intención (sin inventar datos).
 */
export function buildIntentEmbeddingQuery(intent: TravelSearchIntent): {
  query: string;
  queryHash: string;
  metadata: Record<string, unknown>;
} {
  const parts: string[] = [];

  if (intent.destination?.trim()) {
    parts.push(`destino ${intent.destination.trim()}`);
  }
  if (intent.durationDays != null) {
    parts.push(`duración aproximada ${intent.durationDays} días`);
  }
  if (intent.travelStyleAxes?.length) {
    parts.push(`estilos: ${intent.travelStyleAxes.join(', ')}`);
  }
  if (intent.travelType?.trim()) {
    parts.push(`tipo ${intent.travelType.trim()}`);
  }
  if (intent.tags?.length) {
    parts.push(`etiquetas: ${intent.tags.join(', ')}`);
  }
  if (intent.preferences?.length) {
    parts.push(`preferencias: ${intent.preferences.join('; ')}`);
  }
  const tier = inferBudgetTierLabel(intent.budgetPerPerson);
  if (tier) {
    parts.push(`presupuesto orientativo (gama) ${tier}`);
  }
  if (intent.month != null) {
    const mn = monthNameEs(intent.month);
    if (mn) parts.push(`mes deseado ${mn}`);
  } else if (intent.approximateStartDate?.trim()) {
    parts.push(`fecha referencia ${intent.approximateStartDate.trim()}`);
  }
  if (intent.travelers != null) {
    parts.push(`grupo ${intent.travelers} viajeros`);
  }

  const query =
    parts.length > 0
      ? `Intención de viaje: ${parts.join('. ')}.`
      : 'Intención de viaje: criterios generales; explorar catálogo premium.';

  const queryHash = createHash('sha256').update(query, 'utf8').digest('hex');
  return {
    query,
    queryHash,
    metadata: {
      hasDestination: Boolean(intent.destination?.trim()),
      fieldsUsed: parts.length,
    },
  };
}
