/**
 * Métricas agregadas geo (reutilizable por geo-report / geo-audit / geo-normalize).
 */
import prisma from '../src/infrastructure/db';
import { normalizeKey } from '../src/services/travel/travel-search.scoring';

export async function fetchGeoMetrics(companyId: string) {
  const [
    totalDestinations,
    totalGeoPlaces,
    totalTravelTripDestinations,
    totalTripGeoPlaces,
    approvedTripsWithoutGeo,
    geoParentNullNonMacro,
    geoEmptyNormalizedKey,
    countriesNoContinentParent,
    citiesNoCountryParent,
    regionsNoCountryParent,
    islandsNoParent,
    attractionsNoCityLikeParent,
    mainDestMismatchSample,
  ] = await Promise.all([
    prisma.destination.count({ where: { companyId } }),
    prisma.geoPlace.count({ where: { companyId } }),
    prisma.travelTripDestination.count({
      where: { trip: { companyId } },
    }),
    prisma.tripGeoPlace.count({
      where: { trip: { companyId } },
    }),
    prisma.travelTrip.count({
      where: { companyId, status: 'APPROVED', tripGeoPlaces: { none: {} } },
    }),
    prisma.geoPlace.count({
      where: { companyId, parentId: null, kind: { notIn: ['CONTINENT', 'MACRO_REGION'] } },
    }),
    prisma.geoPlace.count({
      where: { companyId, normalizedKey: '' },
    }),
    prisma.geoPlace.count({
      where: {
        companyId,
        kind: 'COUNTRY',
        OR: [{ parentId: null }, { parent: { kind: { notIn: ['CONTINENT', 'MACRO_REGION'] } } }],
      },
    }),
    prisma.geoPlace.count({
      where: {
        companyId,
        kind: 'CITY',
        OR: [{ parentId: null }, { parent: { kind: { notIn: ['COUNTRY', 'REGION', 'AREA', 'MACRO_REGION', 'ISLAND'] } } }],
      },
    }),
    prisma.geoPlace.count({
      where: {
        companyId,
        kind: 'REGION',
        OR: [{ parentId: null }, { parent: { kind: { notIn: ['COUNTRY', 'MACRO_REGION', 'AREA'] } } }],
      },
    }),
    prisma.geoPlace.count({
      where: {
        companyId,
        kind: 'ISLAND',
        OR: [{ parentId: null }],
      },
    }),
    prisma.geoPlace.count({
      where: {
        companyId,
        kind: { in: ['ATTRACTION', 'POI'] },
        OR: [{ parentId: null }],
      },
    }),
    prisma.tripGeoPlace.findMany({
      where: { trip: { companyId, status: 'APPROVED' }, role: 'PRIMARY' },
      take: 120,
      include: {
        trip: { select: { id: true, mainDestination: true } },
        geoPlace: { select: { canonicalName: true } },
      },
    }),
  ]);

  const places = await prisma.geoPlace.findMany({
    where: { companyId },
    select: { id: true, canonicalName: true, kind: true, normalizedKey: true },
  });
  const byNameKey = new Map<string, typeof places>();
  for (const p of places) {
    const k = normalizeKey(p.canonicalName);
    if (!k) continue;
    const arr = byNameKey.get(k) ?? [];
    arr.push(p);
    byNameKey.set(k, arr);
  }
  let duplicatedNameCandidates = 0;
  const dupExamples: { key: string; ids: string[]; kinds: string[] }[] = [];
  for (const [k, arr] of byNameKey) {
    if (arr.length > 1) {
      duplicatedNameCandidates++;
      if (dupExamples.length < 15) {
        dupExamples.push({
          key: k,
          ids: arr.map((x) => x.id),
          kinds: [...new Set(arr.map((x) => x.kind))],
        });
      }
    }
  }

  let wrongKindHeuristic = 0;
  const wrongExamples: string[] = [];
  const countryLikeNames = new Set(
    [
      'japon',
      'japan',
      'vietnam',
      'viet-nam',
      'tailandia',
      'thailand',
      'francia',
      'france',
      'italia',
      'italy',
      'maldivas',
      'maldives',
      'argentina',
      'mexico',
      'estados-unidos',
      'united-states',
      'usa',
      'eeuu',
      'reino-unido',
      'united-kingdom',
      'uk',
    ].map((s) => normalizeKey(s)),
  );
  for (const p of places) {
    const nk = normalizeKey(p.canonicalName);
    if (countryLikeNames.has(nk) && !['COUNTRY', 'REGION'].includes(p.kind)) {
      wrongKindHeuristic++;
      if (wrongExamples.length < 12) wrongExamples.push(`${p.id} "${p.canonicalName}" as ${p.kind}`);
    }
  }

  let mainMismatchCount = 0;
  const mismatchExamples: string[] = [];
  for (const l of mainDestMismatchSample) {
    const md = l.trip.mainDestination?.trim();
    if (!md) continue;
    const a = normalizeKey(md);
    const b = normalizeKey(l.geoPlace.canonicalName);
    if (!a || !b) continue;
    if (!(a.includes(b) || b.includes(a))) {
      mainMismatchCount++;
      if (mismatchExamples.length < 15) {
        mismatchExamples.push(`trip ${l.trip.id} main="${md}" primary="${l.geoPlace.canonicalName}"`);
      }
    }
  }

  return {
    companyId,
    totals: {
      destinations: totalDestinations,
      geoPlaces: totalGeoPlaces,
      travelTripDestinations: totalTravelTripDestinations,
      tripGeoPlaces: totalTripGeoPlaces,
    },
    quality: {
      approvedTripsWithoutTripGeoPlace: approvedTripsWithoutGeo,
      geoPlacesWithoutParent_nonMacroKinds: geoParentNullNonMacro,
      geoPlaces_emptyNormalizedKey: geoEmptyNormalizedKey,
      countries_without_continentLike_parent_heuristic: countriesNoContinentParent,
      regions_without_countryLike_parent_heuristic: regionsNoCountryParent,
      cities_without_countryLike_parent_heuristic: citiesNoCountryParent,
      islands_without_parent: islandsNoParent,
      attractions_poi_without_parent: attractionsNoCityLikeParent,
      duplicatedNameCandidates_same_normalizeKey: duplicatedNameCandidates,
      wrongKind_heuristicExamples: wrongKindHeuristic,
      primaryGeo_vs_mainDestination_mismatch_among_sample: mainMismatchCount,
    },
    samples: {
      duplicateNormalizeKeyExamples: dupExamples,
      wrongKindHeuristicExamples: wrongExamples,
      mainDestinationMismatchExamples: mismatchExamples,
    },
  };
}
