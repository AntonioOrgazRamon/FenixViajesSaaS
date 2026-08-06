import prisma from '../../infrastructure/db';
import type { TravelTripSearchRow, TripGeoPlaceLinkRow } from '../travel/travel-search.scoring';
import { GeoPlaceService } from './geo-place.service';

/**
 * Rellena `tripGeoPlaces` + ancestros para scoring geo (una consulta batch por request).
 */
export async function enrichTripSearchRowsWithGeoPlaces(
  companyId: string,
  rows: TravelTripSearchRow[],
): Promise<void> {
  if (!rows.length) return;

  const ids = rows.map((r) => r.id);
  const links = await prisma.tripGeoPlace.findMany({
    where: { tripId: { in: ids } },
    include: {
      geoPlace: { select: { id: true, normalizedKey: true, kind: true } },
    },
    orderBy: [{ tripId: 'asc' }, { orderIndex: 'asc' }],
  });

  if (!links.length) {
    for (const r of rows) r.tripGeoPlaces = [];
    return;
  }

  const geoSvc = new GeoPlaceService();
  const placeIds = [...new Set(links.map((l) => l.geoPlaceId))];
  const ancestors = await geoSvc.batchAncestorIdsForPlaces(companyId, placeIds);

  const byTrip = new Map<string, TripGeoPlaceLinkRow[]>();
  for (const l of links) {
    const row: TripGeoPlaceLinkRow = {
      geoPlaceId: l.geoPlace.id,
      normalizedKey: l.geoPlace.normalizedKey,
      kind: l.geoPlace.kind,
      role: l.role,
      ancestorIds: ancestors.get(l.geoPlace.id) ?? [],
    };
    const arr = byTrip.get(l.tripId) ?? [];
    arr.push(row);
    byTrip.set(l.tripId, arr);
  }

  for (const r of rows) {
    r.tripGeoPlaces = byTrip.get(r.id) ?? [];
  }
}
