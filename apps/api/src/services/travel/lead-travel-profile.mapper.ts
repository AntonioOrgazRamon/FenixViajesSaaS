import type { LeadTravelProfile, TravelLeadTripType } from '@prisma/client';
import type { TravelSearchIntent } from './travel-search.schema';
import { buildTravelSearchIntentFromSnapshots } from './proposal-intent.mapper';

function budgetNumberFromProfile(d: LeadTravelProfile['budgetAmount']): number | null {
  if (d == null) return null;
  if (typeof d === 'number' && Number.isFinite(d)) return d;
  const n =
    typeof d === 'object' && d !== null && 'toNumber' in d && typeof (d as { toNumber: () => number }).toNumber === 'function'
      ? (d as { toNumber: () => number }).toNumber()
      : Number(d);
  return Number.isFinite(n) ? n : null;
}

function readStringArrayJson(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean);
}

export function tripTypeCustomerLabel(t: TravelLeadTripType): string | null {
  switch (t) {
    case 'VACATIONAL':
      return 'Vacacional';
    case 'HONEYMOON':
      return 'Luna de miel';
    case 'GROUP':
      return 'Grupo';
    case 'FAMILY':
      return 'Familiar';
    case 'BUSINESS':
      return 'Empresa / negocio';
    case 'OTHER':
      return 'Otro';
    default:
      return null;
  }
}

function axesForTripType(t: TravelLeadTripType): NonNullable<TravelSearchIntent['travelStyleAxes']> {
  switch (t) {
    case 'HONEYMOON':
      return ['HONEYMOON', 'WELLNESS'];
    case 'FAMILY':
      return ['FAMILY'];
    case 'GROUP':
      return ['NATURE', 'ADVENTURE'];
    case 'BUSINESS':
      return ['CITY_BREAK'];
    case 'VACATIONAL':
      return [];
    default:
      return [];
  }
}

/**
 * Snapshot JSON consumido por `buildTravelSearchIntentFromSnapshots` (último en la cadena = máxima prioridad).
 */
export function leadTravelProfileToMapperSnapshot(profile: LeadTravelProfile): Record<string, unknown> {
  const dest = profile.destinationText?.trim() || '';
  const budgetAmt = budgetNumberFromProfile(profile.budgetAmount);
  const tagList = readStringArrayJson(profile.activityTags);
  const prefs: string[] = [];
  if (profile.activitiesText?.trim()) prefs.push(profile.activitiesText.trim().slice(0, 500));
  if (profile.flexibleDates === true) prefs.push('Fechas flexibles');
  if (profile.tripType === 'GROUP') prefs.push('Viaje en grupo');

  const prefDest = readStringArrayJson(profile.preferredDestinations);

  const travel: Record<string, unknown> = {
    destination: dest || undefined,
    preferences: prefs.length ? prefs : undefined,
    tags: tagList.length ? tagList.slice(0, 40) : undefined,
  };
  const ax = axesForTripType(profile.tripType);
  if (ax.length) travel.travelStyleAxes = ax;

  const label = tripTypeCustomerLabel(profile.tripType);
  if (label) travel.travelType = label;

  if (profile.travelDateFrom) {
    travel.approximateStartDate = profile.travelDateFrom.toISOString().slice(0, 40);
    travel.month = profile.travelDateFrom.getUTCMonth() + 1;
  } else if (profile.travelDateText?.trim()) {
    travel.approximateStartDate = profile.travelDateText.trim().slice(0, 40);
    const tryParse = Date.parse(profile.travelDateText);
    if (!Number.isNaN(tryParse)) {
      travel.month = new Date(tryParse).getUTCMonth() + 1;
    }
  }

  if (
    profile.durationDays != null &&
    profile.durationDays >= 1 &&
    profile.durationDays <= 365
  ) {
    travel.durationDays = profile.durationDays;
  }

  if (budgetAmt != null && budgetAmt > 0) {
    if (profile.budgetType === 'PER_PERSON') {
      travel.budgetPerPerson = budgetAmt;
    } else if (profile.budgetType === 'TOTAL') {
      travel.totalBudget = budgetAmt;
    } else if (profile.budgetType === 'UNKNOWN') {
      // Cliente no especificó alcance; mantenemos señal como orientación por persona (heurística suave).
      travel.budgetPerPerson = budgetAmt;
    }
  }

  const depParts = [profile.departureAirportText?.trim(), profile.departureAirportCode?.trim()].filter(Boolean);
  const departureAirport = depParts.length ? depParts.join(' · ').slice(0, 120) : undefined;

  const root: Record<string, unknown> = {
    destination: dest || undefined,
    travel,
    preferredDestinations: prefDest.length ? prefDest : undefined,
    departureAirport,
  };

  if (budgetAmt != null && budgetAmt > 0 && profile.budgetType === 'TOTAL') {
    root.totalBudget = budgetAmt;
  }
  if (
    budgetAmt != null &&
    budgetAmt > 0 &&
    (profile.budgetType === 'PER_PERSON' || profile.budgetType === 'UNKNOWN')
  ) {
    root.budgetPerPerson = budgetAmt;
  }

  return root;
}

/** Facilita tests y servicios que quieren solo la intención del perfil. */
export function leadTravelProfileToTravelSearchIntent(profile: LeadTravelProfile): TravelSearchIntent {
  return buildTravelSearchIntentFromSnapshots([leadTravelProfileToMapperSnapshot(profile)]);
}
