import type { Prisma } from '@prisma/client';
import { buildGeoNormalizedKey, mapDestinationKindToGeoPlaceKind } from './geo-normalize';

/**
 * Tras crear Destination + TravelTripDestination (pipeline PDF o JSON),
 * materializa GeoPlace + TripGeoPlace para scoring geo del recommendation engine.
 * Idempotente por `(companyId, normalizedKey, kind)` y `(tripId, geoPlaceId)`.
 */
export async function syncTripGeoPlacesFromDestinations(
  tx: Prisma.TransactionClient,
  companyId: string,
  tripId: string,
): Promise<void> {
  const links = await tx.travelTripDestination.findMany({
    where: { tripId, trip: { companyId } },
    include: { destination: true },
    orderBy: [{ orderIndex: 'asc' }, { destinationId: 'asc' }],
  });

  for (let idx = 0; idx < links.length; idx++) {
    const td = links[idx]!;
    const d = td.destination;
    const kind = mapDestinationKindToGeoPlaceKind(d.type);
    const normalizedKey = buildGeoNormalizedKey(d.name, kind);

    const gp = await tx.geoPlace.upsert({
      where: {
        companyId_normalizedKey_kind: {
          companyId,
          normalizedKey,
          kind,
        },
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

    const role = idx === 0 ? ('PRIMARY' as const) : ('STOP' as const);
    await tx.tripGeoPlace.upsert({
      where: { tripId_geoPlaceId: { tripId, geoPlaceId: gp.id } },
      create: {
        tripId,
        geoPlaceId: gp.id,
        role,
        orderIndex: td.orderIndex,
        source: 'IMPORT',
      },
      update: {
        role,
        orderIndex: td.orderIndex,
        source: 'IMPORT',
      },
    });
  }
}
