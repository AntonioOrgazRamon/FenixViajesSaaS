import type { TravelSearchIntent } from './travel-search.schema';
import { travelSearchIntentZ, travelStyleAxisZ } from './travel-search.schema';

function readTravel(o: Record<string, unknown>): Record<string, unknown> | null {
  const t = o.travel;
  if (t && typeof t === 'object' && !Array.isArray(t)) return t as Record<string, unknown>;
  return null;
}

/** Une snapshots en orden (los últimos tienen prioridad en campos detectados). */
export function buildTravelSearchIntentFromSnapshots(snapshots: unknown[]): TravelSearchIntent {
  const acc: TravelSearchIntent = {};

  for (const snap of snapshots) {
    if (snap === null || snap === undefined) continue;
    if (typeof snap !== 'object' || Array.isArray(snap)) continue;

    const o = snap as Record<string, unknown>;
    const tr = readTravel(o) ?? {};

    const dest =
      (typeof tr.destination === 'string' && tr.destination.trim()) ||
      (typeof o.destination === 'string' && o.destination.trim());
    if (dest) acc.destination = dest.slice(0, 300);

    const durRaw =
      (typeof tr.durationDays === 'number' && tr.durationDays) ||
      (typeof o.durationDays === 'number' && o.durationDays) ||
      (typeof tr.days === 'number' && tr.days);
    if (typeof durRaw === 'number' && durRaw >= 1 && durRaw <= 365) {
      acc.durationDays = Math.floor(durRaw);
    }

    const budgetRaw =
      (typeof tr.budgetPerPerson === 'number' && tr.budgetPerPerson) ||
      (typeof tr.budgetMax === 'number' && tr.budgetMax) ||
      (typeof tr.budget === 'number' && tr.budget) ||
      (typeof o.budgetPerPerson === 'number' && o.budgetPerPerson) ||
      (typeof o.budgetMax === 'number' && o.budgetMax);
    if (typeof budgetRaw === 'number' && budgetRaw > 0 && budgetRaw <= 1_000_000) {
      acc.budgetPerPerson = budgetRaw;
    }

    const td =
      (typeof tr.travelDate === 'string' && tr.travelDate.trim()) ||
      (typeof o.travelDate === 'string' && o.travelDate.trim()) ||
      (typeof tr.approximateStartDate === 'string' && tr.approximateStartDate.trim());
    if (td && !Number.isNaN(Date.parse(td))) {
      acc.approximateStartDate = td.slice(0, 40);
    }

    const monthRaw =
      (typeof tr.month === 'number' && tr.month) || (typeof o.month === 'number' && o.month);
    if (typeof monthRaw === 'number' && monthRaw >= 1 && monthRaw <= 12) {
      acc.month = Math.floor(monthRaw);
    }

    const seats =
      (typeof tr.seats === 'number' && tr.seats) ||
      (typeof tr.travelers === 'number' && tr.travelers) ||
      (typeof o.seats === 'number' && o.seats) ||
      (typeof o.travelers === 'number' && o.travelers);
    if (typeof seats === 'number' && seats >= 1 && seats <= 500) {
      acc.travelers = Math.floor(seats);
    }

    const travelType =
      (typeof tr.travelType === 'string' && tr.travelType.trim()) ||
      (typeof o.travelType === 'string' && o.travelType.trim());
    if (travelType) acc.travelType = travelType.slice(0, 120);

    if (Array.isArray(tr.tags)) {
      const tags = tr.tags.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 80));
      if (tags.length) acc.tags = tags.slice(0, 40);
    }
    if (Array.isArray(o.tags)) {
      const tags = o.tags.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 80));
      if (tags.length) acc.tags = tags.slice(0, 40);
    }

    const prefsSource =
      (Array.isArray(tr.preferences) && tr.preferences) ||
      (Array.isArray(o.preferences) && o.preferences);
    if (prefsSource) {
      const preferences = prefsSource
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.slice(0, 200));
      if (preferences.length) acc.preferences = preferences.slice(0, 40);
    }

    const axesSource =
      (Array.isArray(tr.travelStyleAxes) && tr.travelStyleAxes) ||
      (Array.isArray(o.travelStyleAxes) && o.travelStyleAxes);
    if (axesSource) {
      const cleaned = axesSource
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim())
        .filter(Boolean);
      const ax = travelStyleAxisZ.array().max(24).safeParse(cleaned);
      if (ax.success) acc.travelStyleAxes = ax.data;
    }

    const msg = typeof o.message === 'string' && o.message.trim();
    if (msg && msg.length > 3 && (!acc.preferences || acc.preferences.length < 6)) {
      acc.preferences = [...(acc.preferences ?? []), `Nota del cliente: ${msg.slice(0, 180)}`].slice(0, 40);
    }
  }

  const parsed = travelSearchIntentZ.safeParse(acc);
  return parsed.success ? parsed.data : acc;
}
