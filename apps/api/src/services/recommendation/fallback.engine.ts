import { intentEffectiveBudgetPerPerson, type TravelSearchIntent } from '../travel/travel-search.schema';
import type { CatalogStats } from './validation.engine';

/**
 * Mensajes accionables cuando no hay encaje fuerte de destino o catálogo limitado.
 */
export function buildFallbackHints(
  intent: TravelSearchIntent,
  stats: CatalogStats,
  flags: {
    noDestinationMatch: boolean;
    intentVague: boolean;
  },
): string[] {
  const hints: string[] = [];
  if (flags.noDestinationMatch && intent.destination?.trim()) {
    hints.push(
      `No hay circuitos publicados que encajen claramente con “${intent.destination.trim()}”. Valore ampliar región geográfica o temporada.`,
    );
  }
  if (flags.intentVague) {
    hints.push(
      'Conviene clarificar destino, mes aproximado y presupuesto orientativo para mejorar el ranking sin IA de caja negra.',
    );
  }
  const effB = intentEffectiveBudgetPerPerson(intent);
  if (effB != null && stats.minPrice != null && effB < stats.minPrice) {
    hints.push(
      `Ampliar presupuesto por encima de ~${Math.round(stats.minPrice)} o valorar circuitos más cortos.`,
    );
  }
  if (intent.durationDays != null && intent.durationDays > 21) {
    hints.push('Reducir duración o dividir en dos etapas puede abrir más coincidencias de catálogo.');
  }
  if (intent.month == null && !intent.approximateStartDate?.trim()) {
    hints.push('Indicar temporada o mes prioriza salidas con fechas en dossier.');
  }
  return hints;
}
