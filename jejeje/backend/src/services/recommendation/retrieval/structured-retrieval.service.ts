import { TripBudgetTier } from '@prisma/client';
import type { TravelSearchIntent } from '../../travel/travel-search.schema';
import type { TravelTripSearchRow, DestinationPointsGeoOpts } from '../../travel/travel-search.scoring';
import { tokenize } from '../../travel/travel-search.scoring';
import { destinationPoints, inferAxesFromKeywords, tripCorpus } from '../scoring.engine';
import type { TravelStyleAxis } from '@prisma/client';

function monthFromIntent(intent: TravelSearchIntent): number | null {
  if (intent.month != null) return intent.month;
  if (intent.approximateStartDate) {
    const d = new Date(intent.approximateStartDate);
    const m = d.getUTCMonth() + 1;
    if (m >= 1 && m <= 12) return m;
  }
  return null;
}

function budgetTierFromIntentAmount(amount: number | undefined): TripBudgetTier | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  if (amount < 1200) return TripBudgetTier.VALUE;
  if (amount < 2500) return TripBudgetTier.MID;
  if (amount < 4500) return TripBudgetTier.UPPER_MID;
  if (amount < 8000) return TripBudgetTier.PREMIUM;
  return TripBudgetTier.ULTRA_PREMIUM;
}

export type StructuredHit = {
  tripId: string;
  structuredScore: number;
  structuredRank: number;
  provenance: 'structured_soft';
};

/**
 * Señal estructurada 0–1: duración, tier presupuesto, estilo, calendario, destino relativo.
 */
export function structuredRetrieve(
  intent: TravelSearchIntent,
  trips: TravelTripSearchRow[],
  geoOpts?: DestinationPointsGeoOpts,
): StructuredHit[] {
  const intentMonth = monthFromIntent(intent);
  const intentTier = budgetTierFromIntentAmount(intent.budgetPerPerson);
  const intentAxes = new Set(
    (intent.travelStyleAxes?.length ? intent.travelStyleAxes : inferAxesFromKeywords(intent)) as TravelStyleAxis[],
  );
  const intentText = [
    intent.travelType,
    ...(intent.tags ?? []),
    ...(intent.preferences ?? []),
  ]
    .filter(Boolean)
    .join(' ');
  const intentTok = new Set(tokenize(intentText));

  const scored = trips.map((trip) => {
    let s = 0;
    let parts = 0;

    if (intent.destination?.trim()) {
      s += destinationPoints(intent.destination, trip, geoOpts) / 30;
      parts += 1;
    }

    if (intent.durationDays != null && trip.durationDays != null) {
      const diff = Math.abs(trip.durationDays - intent.durationDays);
      s += Math.max(0, 1 - diff / 14);
      parts += 1;
    } else if (intent.durationDays != null) {
      s += 0.35;
      parts += 1;
    }

    if (intentTier && trip.budgetTier && trip.budgetTier !== TripBudgetTier.UNKNOWN) {
      const order = [
        TripBudgetTier.UNKNOWN,
        TripBudgetTier.VALUE,
        TripBudgetTier.MID,
        TripBudgetTier.UPPER_MID,
        TripBudgetTier.PREMIUM,
        TripBudgetTier.ULTRA_PREMIUM,
      ];
      const ia = order.indexOf(intentTier);
      const ta = order.indexOf(trip.budgetTier);
      const dist = Math.abs(ia - ta);
      s += Math.max(0, 1 - dist * 0.22);
      parts += 1;
    } else if (intent.budgetPerPerson != null) {
      s += 0.25;
      parts += 1;
    }

    if (intentAxes.size && trip.styleAxes?.length) {
      let hit = 0;
      for (const a of intentAxes) {
        if (trip.styleAxes.includes(a)) hit++;
      }
      s += hit / intentAxes.size;
      parts += 1;
    }

    if (intentMonth != null) {
      let ok = false;
      for (const dep of trip.departures) {
        const sd = dep.startDate;
        if (sd && sd.getUTCMonth() + 1 === intentMonth) ok = true;
      }
      if (!ok && trip.season?.trim()) {
        const k = trip.season.toLowerCase();
        const monthNames: Record<number, string[]> = {
          1: ['enero'],
          2: ['febrero'],
          3: ['marzo'],
          4: ['abril'],
          5: ['mayo'],
          6: ['junio'],
          7: ['julio'],
          8: ['agosto'],
          9: ['septiembre', 'setiembre'],
          10: ['octubre'],
          11: ['noviembre'],
          12: ['diciembre'],
        };
        const hints = monthNames[intentMonth] ?? [];
        if (hints.some((h) => k.includes(h))) ok = true;
      }
      s += ok ? 1 : 0.25;
      parts += 1;
    }

    if (intent.travelType?.trim() || intent.tags?.length || intent.preferences?.length) {
      const tripTok = tokenize(tripCorpus(trip));
      let inter = 0;
      for (const t of tripTok) if (intentTok.has(t)) inter++;
      const j = tripTok.length ? Math.min(1, inter / Math.max(6, tripTok.length * 0.15)) : 0;
      s += j;
      parts += 1;
    }

    const raw = parts > 0 ? s / parts : 0.5;
    return { id: trip.id, score: raw };
  });

  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored.map((r, idx) => ({
    tripId: r.id,
    structuredScore: r.score,
    structuredRank: idx + 1,
    provenance: 'structured_soft' as const,
  }));
}
