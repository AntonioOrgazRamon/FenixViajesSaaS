/**
 * Validaciones de consistencia del modelo geo (post-backfill).
 *
 * Uso:
 *   npm run geo:validate -- --companyId=<uuid>
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import { normalizeKey } from '../src/services/travel/travel-search.scoring';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

async function validateCompany(companyId: string) {
  const issues: { code: string; severity: 'WARN' | 'INFO'; detail: string; ref?: string }[] = [];

  const approvedNoGeo = await prisma.travelTrip.findMany({
    where: {
      companyId,
      status: 'APPROVED',
      tripGeoPlaces: { none: {} },
    },
    select: { id: true, title: true },
    take: 500,
  });
  for (const t of approvedNoGeo) {
    issues.push({
      code: 'TRIP_APPROVED_WITHOUT_TRIP_GEO_PLACE',
      severity: 'WARN',
      detail: t.title.slice(0, 120),
      ref: t.id,
    });
  }

  const legacyDupRows = await prisma.$queryRaw<{ legacy_destination_id: string; c: bigint }[]>`
    SELECT legacy_destination_id, COUNT(*) AS c
    FROM geo_places
    WHERE company_id = ${companyId} AND legacy_destination_id IS NOT NULL
    GROUP BY legacy_destination_id
    HAVING COUNT(*) > 1
  `;
  if (legacyDupRows.length > 0) {
    issues.push({
      code: 'GEO_DUPLICATE_LEGACY_DESTINATION_ID',
      severity: 'WARN',
      detail: `Claves legacy duplicadas: ${legacyDupRows.length}`,
    });
  }

  const primaryLinks = await prisma.tripGeoPlace.findMany({
    where: { trip: { companyId, status: 'APPROVED' }, role: 'PRIMARY' },
    include: {
      trip: { select: { id: true, mainDestination: true } },
      geoPlace: { select: { canonicalName: true } },
    },
    take: 800,
  });
  for (const l of primaryLinks) {
    const md = l.trip.mainDestination?.trim();
    if (!md) continue;
    const a = normalizeKey(md);
    const b = normalizeKey(l.geoPlace.canonicalName);
    if (!a || !b) continue;
    if (!(a.includes(b) || b.includes(a))) {
      issues.push({
        code: 'MAIN_DESTINATION_VS_PRIMARY_GEO_MISMATCH',
        severity: 'INFO',
        detail: `trip ${l.trip.id}: main="${md}" primaryGeo="${l.geoPlace.canonicalName}"`,
        ref: l.trip.id,
      });
    }
  }

  const dupDestPerTrip = await prisma.$queryRaw<{ trip_id: string; c: bigint }[]>`
    SELECT trip_id, COUNT(*) AS c
    FROM travel_trip_destinations
    WHERE trip_id IN (SELECT id FROM travel_trips WHERE company_id = ${companyId})
    GROUP BY trip_id
    HAVING COUNT(*) > COUNT(DISTINCT destination_id)
  `;
  for (const row of dupDestPerTrip) {
    issues.push({
      code: 'TRIP_DUPLICATE_DESTINATION_ROWS',
      severity: 'WARN',
      detail: `Viaje ${row.trip_id} tiene destinos repetidos en travel_trip_destinations`,
      ref: row.trip_id,
    });
  }

  const countries = await prisma.geoPlace.findMany({
    where: { companyId, kind: 'COUNTRY' },
    include: { parent: { select: { id: true, kind: true } } },
    take: 2000,
  });
  for (const c of countries) {
    const p = c.parent;
    const okParent =
      p &&
      (p.kind === 'CONTINENT' || p.kind === 'MACRO_REGION' || p.kind === 'REGION' || p.kind === 'AREA');
    if (!okParent) {
      issues.push({
        code: 'COUNTRY_WITHOUT_CONTINENTLIKE_PARENT',
        severity: 'INFO',
        detail: `País "${c.canonicalName}" (${c.id}) sin padre continente/macro-región (manual).`,
        ref: c.id,
      });
    }
  }

  const geoWithoutParentNonMacro = await prisma.geoPlace.count({
    where: { companyId, parentId: null, kind: { notIn: ['CONTINENT', 'MACRO_REGION'] } },
  });
  if (geoWithoutParentNonMacro > 0) {
    issues.push({
      code: 'GEO_PLACES_WITHOUT_PARENT_EXCEPT_MACRO',
      severity: 'INFO',
      detail: `Lugares sin parent (no continente): ${geoWithoutParentNonMacro} (revisión manual jerárquica).`,
    });
  }

  return {
    companyId,
    summary: {
      approvedTripsWithoutGeoLink: approvedNoGeo.length,
      issuesTotal: issues.length,
    },
    issues,
  };
}

async function main() {
  const companyId = arg('--companyId')?.trim();
  if (!companyId) {
    console.error('Uso: npm run geo:validate -- --companyId=<uuid>');
    process.exit(1);
  }
  try {
    console.log(JSON.stringify(await validateCompany(companyId), null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
