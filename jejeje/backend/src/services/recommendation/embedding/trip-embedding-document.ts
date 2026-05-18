import { createHash } from 'crypto';
import type { TravelTripSearchRow } from '../../travel/travel-search.scoring';
import { tripCorpus, tripPriceBucket } from '../scoring.engine';

function clampLines(parts: string[], maxLines: number): string {
  return parts
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .join('\n');
}

function priceTierLabel(trip: TravelTripSearchRow): string | null {
  if (trip.budgetTier && trip.budgetTier !== 'UNKNOWN') {
    return `price_tier:${trip.budgetTier}`;
  }
  const p = trip.indicativePrice != null ? parseFloat(trip.indicativePrice) : null;
  if (p == null || !Number.isFinite(p)) return null;
  const b = tripPriceBucket(p);
  return `price_bucket:${b}`;
}

/**
 * Documento estable para embedding del viaje (sin IDs ni datos sensibles).
 */
export function buildTripEmbeddingDocument(trip: TravelTripSearchRow): {
  content: string;
  contentHash: string;
  metadata: Record<string, unknown>;
} {
  const destSecondary = trip.tripDestinations
    .map((d) => d.destination.name.trim())
    .filter(Boolean)
    .slice(0, 12);

  const highlights = trip.highlights.map((h) => h.text.trim()).filter(Boolean).slice(0, 10);
  const included = trip.services
    .filter((s) => s.type === 'INCLUDED')
    .map((s) => s.text.trim())
    .filter(Boolean)
    .slice(0, 12);

  const hotels = trip.hotels
    .map((h) => [h.hotelName, h.city, h.category].filter(Boolean).join(', '))
    .filter(Boolean)
    .slice(0, 8);

  const itin = trip.itineraryDays
    .slice(0, 14)
    .map((d) => [d.title, d.description].filter(Boolean).join(' — '))
    .filter(Boolean);

  const styles = [...(trip.styleAxes ?? [])].sort().join(', ');
  const family = trip.styleAxes?.includes('FAMILY') ? 'family_friendly' : null;
  const honeymoon = trip.styleAxes?.includes('HONEYMOON') ? 'honeymoon' : null;

  const lines: string[] = [
    `title: ${trip.title?.trim() || 'viaje'}`,
    trip.mainDestination?.trim() ? `main_destination: ${trip.mainDestination.trim()}` : null,
    destSecondary.length ? `other_destinations: ${destSecondary.join('; ')}` : null,
    trip.durationDays != null ? `duration_days: ${trip.durationDays}` : null,
    trip.season?.trim() ? `season: ${trip.season.trim()}` : null,
    trip.luxuryLevel && trip.luxuryLevel !== 'UNKNOWN' ? `luxury_level: ${trip.luxuryLevel}` : null,
    trip.pace && trip.pace !== 'UNKNOWN' ? `pace: ${trip.pace}` : null,
    trip.exclusivity && trip.exclusivity !== 'UNKNOWN' ? `exclusivity: ${trip.exclusivity}` : null,
    trip.climatePreference && trip.climatePreference !== 'UNKNOWN' ? `climate: ${trip.climatePreference}` : null,
    priceTierLabel(trip),
    styles ? `travel_styles: ${styles}` : null,
    family,
    honeymoon,
    highlights.length ? `highlights:\n${clampLines(highlights, 10)}` : null,
    included.length ? `services_included:\n${clampLines(included, 12)}` : null,
    hotels.length ? `hotels:\n${clampLines(hotels, 8)}` : null,
    itin.length ? `itinerary_summary:\n${clampLines(itin, 14)}` : null,
    trip.description?.trim() ? `description: ${trip.description.trim().slice(0, 2500)}` : null,
  ].filter(Boolean) as string[];

  const content = lines.join('\n');
  const contentHash = createHash('sha256').update(content, 'utf8').digest('hex');

  const metadata = {
    mainDestination: trip.mainDestination,
    durationDays: trip.durationDays,
    luxuryLevel: trip.luxuryLevel,
    budgetTier: trip.budgetTier,
    styleAxes: trip.styleAxes ?? [],
    contentLength: content.length,
    corpusFingerprint: createHash('sha256').update(tripCorpus(trip).slice(0, 8000), 'utf8').digest('hex').slice(0, 16),
  };

  return { content, contentHash, metadata };
}
