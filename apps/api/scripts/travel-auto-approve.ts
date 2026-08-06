/**
 * Aprobación controlada de TravelTrip (MVP datos → motor APPROVED).
 *
 * Uso:
 *   npm run travel:auto-approve -- --companyId=<uuid>
 *   npm run travel:auto-approve -- --companyId=<uuid> --dry-run
 *   npm run travel:auto-approve -- --companyId=<uuid> --force
 *
 * `--force`: aprueba **todos** los PENDING_REVIEW del tenant (sin criterios de calidad).
 *
 * Criterios (sin --force):
 * - APROBABLE: title, mainDestination, durationDays≥1, ≥1 itinerary con contenido,
 *   ≥1 highlight, ≥1 TripDestination, ≥1 TripGeoPlace, importSlug no vacío.
 * - WARNING (no bloquea): sin hoteles, luxury UNKNOWN, budgetTier UNKNOWN.
 * - NO APROBABLE: falta cualquier bloque obligatorio.
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import type { LuxuryLevel, TripBudgetTier } from '@prisma/client';
import { scheduleTravelMediaEnrichment } from '../src/services/travel/media/travel-media-enrichment.service';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1)?.trim();
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

type Verdict = 'APPROVE' | 'SKIP';

function analyzeTrip(row: {
  id: string;
  title: string;
  mainDestination: string | null;
  durationDays: number | null;
  importSlug: string | null;
  luxuryLevel: LuxuryLevel;
  budgetTier: TripBudgetTier;
  tripDestinations: { destinationId: string }[];
  tripGeoPlaces: { geoPlaceId: string }[];
  itineraryDays: { title: string | null; description: string | null }[];
  highlights: { text: string }[];
  hotels: { id: string }[];
}): { verdict: Verdict; blockers: string[]; warnings: string[] } {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!row.title?.trim()) blockers.push('MISSING_TITLE');
  if (!row.mainDestination?.trim()) blockers.push('MISSING_MAIN_DESTINATION');
  if (row.durationDays == null || row.durationDays < 1) blockers.push('MISSING_OR_INVALID_DURATION_DAYS');
  if (!row.importSlug?.trim()) blockers.push('MISSING_IMPORT_SLUG');
  if (!row.tripDestinations.length) blockers.push('NO_TRIP_DESTINATIONS');
  if (!row.tripGeoPlaces.length) blockers.push('NO_TRIP_GEO_PLACES');
  if (!row.itineraryDays.length) blockers.push('NO_ITINERARY_DAYS');

  const itineraryHasContent = row.itineraryDays.some(
    (d) => (d.title?.trim().length ?? 0) > 2 || (d.description?.trim().length ?? 0) > 4,
  );
  if (row.itineraryDays.length && !itineraryHasContent) blockers.push('ITINERARY_EMPTY_CONTENT');

  const hlOk = row.highlights.some((h) => h.text?.trim().length > 2);
  if (!row.highlights.length || !hlOk) blockers.push('NO_MEANINGFUL_HIGHLIGHTS');

  if (!row.hotels.length) warnings.push('NO_HOTELS');
  if (row.luxuryLevel === 'UNKNOWN') warnings.push('LUXURY_UNKNOWN');
  if (row.budgetTier === 'UNKNOWN') warnings.push('BUDGET_TIER_UNKNOWN');

  return {
    verdict: blockers.length ? 'SKIP' : 'APPROVE',
    blockers,
    warnings,
  };
}

async function main() {
  const companyId = arg('--companyId');
  if (!companyId) {
    console.error('Uso: npm run travel:auto-approve -- --companyId=<uuid> [--dry-run] [--force]');
    process.exit(1);
  }
  const dryRun = hasFlag('--dry-run');
  const force = hasFlag('--force');

  const trips = await prisma.travelTrip.findMany({
    where: { companyId, status: 'PENDING_REVIEW' },
    select: {
      id: true,
      title: true,
      mainDestination: true,
      durationDays: true,
      importSlug: true,
      luxuryLevel: true,
      budgetTier: true,
      tripDestinations: { select: { destinationId: true } },
      tripGeoPlaces: { select: { geoPlaceId: true } },
      itineraryDays: { select: { title: true, description: true } },
      highlights: { select: { text: true } },
      hotels: { select: { id: true } },
    },
  });

  let approved = 0;
  let skipped = 0;
  const lines: string[] = [];

  for (const t of trips) {
    const label = `${t.title.slice(0, 60)} (${t.id.slice(0, 8)}…)`;

    if (force) {
      approved++;
      lines.push(`✓ APROBAR (force) ${label}`);
      if (!dryRun) {
        await prisma.travelTrip.update({
          where: { id: t.id },
          data: { status: 'APPROVED' },
        });
        scheduleTravelMediaEnrichment(companyId, t.id);
      }
      continue;
    }

    const { verdict, blockers, warnings } = analyzeTrip(t);
    if (verdict === 'APPROVE') {
      approved++;
      lines.push(`✓ APROBAR ${label} warnings=[${warnings.join(', ')}]`);
      if (!dryRun) {
        await prisma.travelTrip.update({
          where: { id: t.id },
          data: { status: 'APPROVED' },
        });
        scheduleTravelMediaEnrichment(companyId, t.id);
      }
    } else {
      skipped++;
      lines.push(`✗ OMITIR ${label} blockers=[${blockers.join(', ')}] warnings=[${warnings.join(', ')}]`);
    }
  }

  const pendingAfter = dryRun
    ? trips.length - approved
    : await prisma.travelTrip.count({ where: { companyId, status: 'PENDING_REVIEW' } });
  const approvedTotal = await prisma.travelTrip.count({ where: { companyId, status: 'APPROVED' } });

  console.log('\n=== travel:auto-approve ===');
  console.log({
    companyId,
    dryRun,
    force,
    analyzed: trips.length,
    approvedThisRun: approved,
    skippedThisRun: skipped,
  });
  console.log('\nDetalle:');
  lines.forEach((l) => console.log(l));
  console.log('\nResumen BD:');
  console.log({
    APPROVED_total_en_tenant: approvedTotal,
    PENDING_REVIEW_restantes: pendingAfter,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
