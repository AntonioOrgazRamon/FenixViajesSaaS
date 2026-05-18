/**
 * Migra Destination + TravelTripDestination → GeoPlace + TripGeoPlace (ID GeoPlace = ID Destination).
 *
 * Uso:
 *   npm run geo:backfill -- --companyId=<uuid>
 *   npm run geo:backfill -- --allCompanies
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import { buildGeoNormalizedKey, mapDestinationKindToGeoPlaceKind } from '../src/services/geo/geo-normalize';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

async function backfillCompany(companyId: string) {
  const destinations = await prisma.destination.findMany({ where: { companyId } });
  let geoUpserts = 0;
  for (const d of destinations) {
    const kind = mapDestinationKindToGeoPlaceKind(d.type);
    const normalizedKey = buildGeoNormalizedKey(d.name, kind);
    await prisma.geoPlace.upsert({
      where: {
        companyId_normalizedKey_kind: { companyId, normalizedKey, kind },
      },
      create: {
        id: d.id,
        companyId,
        kind,
        canonicalName: d.name.slice(0, 255),
        normalizedKey,
        legacyDestinationId: d.id,
      },
      update: {
        canonicalName: d.name.slice(0, 255),
        legacyDestinationId: d.id,
      },
    });
    geoUpserts++;
  }

  const links = await prisma.travelTripDestination.findMany({
    where: { trip: { companyId } },
    orderBy: [{ tripId: 'asc' }, { orderIndex: 'asc' }, { destinationId: 'asc' }],
  });

  const byTrip = new Map<string, typeof links>();
  for (const l of links) {
    const arr = byTrip.get(l.tripId) ?? [];
    arr.push(l);
    byTrip.set(l.tripId, arr);
  }

  let tripGeoUpserts = 0;
  for (const [, ordered] of byTrip) {
    ordered.sort((a, b) => a.orderIndex - b.orderIndex || a.destinationId.localeCompare(b.destinationId));
    for (let idx = 0; idx < ordered.length; idx++) {
      const td = ordered[idx]!;
      const role = idx === 0 ? ('PRIMARY' as const) : ('STOP' as const);
      await prisma.tripGeoPlace.upsert({
        where: {
          tripId_geoPlaceId: { tripId: td.tripId, geoPlaceId: td.destinationId },
        },
        create: {
          tripId: td.tripId,
          geoPlaceId: td.destinationId,
          role,
          orderIndex: td.orderIndex,
          source: 'BACKFILL',
        },
        update: {
          role,
          orderIndex: td.orderIndex,
          source: 'BACKFILL',
        },
      });
      tripGeoUpserts++;
    }
  }

  return { companyId, geoPlacesUpserted: geoUpserts, tripGeoPlacesUpserted: tripGeoUpserts };
}

async function main() {
  const companyId = arg('--companyId')?.trim();
  const all = process.argv.includes('--allCompanies');

  if (!companyId && !all) {
    console.error('Uso: npm run geo:backfill -- --companyId=<uuid> | --allCompanies');
    process.exit(1);
  }

  try {
    if (all) {
      const companies = await prisma.company.findMany({ select: { id: true } });
      const out: unknown[] = [];
      for (const c of companies) {
        try {
          out.push(await backfillCompany(c.id));
        } catch (e) {
          out.push({ companyId: c.id, error: String(e) });
        }
      }
      console.log(JSON.stringify(out, null, 2));
      return;
    }

    console.log(JSON.stringify(await backfillCompany(companyId!), null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
