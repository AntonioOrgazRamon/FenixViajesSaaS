import type { Prisma } from '@prisma/client';

export type TripForMediaQuery = Prisma.TravelTripGetPayload<{
  include: {
    tripDestinations: { include: { destination: true } };
    highlights: true;
    itineraryDays: true;
  };
}>;

const BANNED = /^(hotel|vuelo|flight|ryanair|iberia|booking|marriott|hilton)\b/i;

/**
 * Queries “emocionales” basadas en destino / cultura / naturaleza — no marcas ni hoteles concretos.
 */
export function buildTravelMediaQueries(trip: TripForMediaQuery, maxDistinct = 8): string[] {
  const raw: string[] = [];

  const add = (s: string | null | undefined) => {
    const t = s?.trim();
    if (!t || t.length < 3 || t.length > 120) return;
    if (BANNED.test(t)) return;
    raw.push(t);
  };

  add(trip.mainDestination);

  for (const td of trip.tripDestinations ?? []) {
    add(td.destination?.name);
  }

  for (const day of (trip.itineraryDays ?? []).slice(0, 5)) {
    add(day.title);
    if (day.description) add(day.description.trim().slice(0, 80));
  }

  for (const h of (trip.highlights ?? []).slice(0, 4)) {
    const words = h.text.trim().split(/\s+/).slice(0, 6).join(' ');
    add(words);
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const q of raw) {
    const k = q.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(q);
    if (deduped.length >= maxDistinct) break;
  }

  const emotional: string[] = [];
  const first = deduped[0];
  if (first) {
    emotional.push(`${first} travel`);
    emotional.push(`${first} landscape`);
  }
  for (let i = 1; i < deduped.length; i++) {
    emotional.push(`${deduped[i]} nature`);
  }

  const seen2 = new Set<string>();
  const out: string[] = [];
  for (const q of emotional) {
    const k = q.toLowerCase();
    if (seen2.has(k)) continue;
    seen2.add(k);
    out.push(q);
    if (out.length >= 12) break;
  }
  return out;
}
