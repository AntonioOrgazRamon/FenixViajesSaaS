/**
 * Auditoría read-only del catálogo travel por empresa (sin mutaciones).
 *
 * Uso:
 *   npm run travel:catalog-overview -- --companyId=<uuid>
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1)?.trim();
}

const W = 48;

function bannerLine(char = '=') {
  console.log(char.repeat(W));
}

function subLine(char = '-') {
  console.log(char.repeat(W));
}

/** "Argentina .......... 12" */
function dottedRow(label: string, value: string | number, labelWidth = 32) {
  const n = String(value).length;
  const space = Math.max(3, W - Math.min(label.length, labelWidth) - n);
  const cut = label.length > labelWidth ? `${label.slice(0, labelWidth - 1)}…` : label;
  console.log(`${cut} ${'.'.repeat(space)} ${value}`);
}

async function main() {
  const companyId = arg('--companyId');
  if (!companyId) {
    console.error('Uso: npm run travel:catalog-overview -- --companyId=<uuid>');
    process.exit(1);
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) {
    console.error(`Empresa no encontrada: ${companyId}`);
    process.exit(1);
  }

  const statusAgg = await prisma.travelTrip.groupBy({
    by: ['status'],
    where: { companyId },
    _count: { id: true },
  });

  const totalTrips = await prisma.travelTrip.count({ where: { companyId } });
  const approved = statusAgg.find((s) => s.status === 'APPROVED')?._count.id ?? 0;
  const pendingReview =
    statusAgg.find((s) => s.status === 'PENDING_REVIEW')?._count.id ?? 0;
  const draft = statusAgg.find((s) => s.status === 'DRAFT')?._count.id ?? 0;
  const rejected = statusAgg.find((s) => s.status === 'REJECTED')?._count.id ?? 0;

  const tripsWithCountryDest = await prisma.travelTripDestination.findMany({
    where: {
      trip: { companyId },
      destination: { type: 'COUNTRY' },
    },
    select: { tripId: true },
    distinct: ['tripId'],
  });
  const tripIdsWithCountry = new Set(tripsWithCountryDest.map((x) => x.tripId));
  const withoutCountryLinkWhere =
    tripIdsWithCountry.size > 0
      ? { id: { notIn: [...tripIdsWithCountry] as string[] } }
      : {};

  const tripsWithoutCountry = await prisma.travelTrip.count({
    where: {
      companyId,
      ...withoutCountryLinkWhere,
      OR: [{ mainDestination: null }, { mainDestination: '' }],
    },
  });

  const tripsMainDestWithoutCountryDest = await prisma.travelTrip.count({
    where: {
      companyId,
      ...withoutCountryLinkWhere,
      AND: [{ NOT: { mainDestination: null } }, { NOT: { mainDestination: '' } }],
    },
  });

  const tripsWithoutGeo = await prisma.travelTrip.count({
    where: { companyId, tripGeoPlaces: { none: {} } },
  });

  const tripsWithoutPrice = await prisma.travelTrip.count({
    where: { companyId, indicativePrice: null },
  });

  const tripsWithoutItinerary = await prisma.travelTrip.count({
    where: { companyId, itineraryDays: { none: {} } },
  });

  /** Requiere migración `travel_media_assets`; si no existe la tabla, se deja null. */
  let tripsWithoutImages: number | null = null;
  try {
    tripsWithoutImages = await prisma.travelTrip.count({
      where: { companyId, mediaAssets: { none: {} } },
    });
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : '';
    if (code !== 'P2021') throw e;
  }

  const approvedWithoutDestinations = await prisma.travelTrip.count({
    where: {
      companyId,
      status: 'APPROVED',
      tripDestinations: { none: {} },
    },
  });

  const approvedWithoutDestIds = await prisma.travelTrip.findMany({
    where: {
      companyId,
      status: 'APPROVED',
      tripDestinations: { none: {} },
    },
    select: { id: true, title: true },
    take: 15,
  });

  const tripsByCountry = await prisma.$queryRaw<
    Array<{ display_name: string; normalized_name: string; trip_count: bigint }>
  >`
    SELECT MIN(d.name) AS display_name,
           d.normalized_name AS normalized_name,
           COUNT(DISTINCT td.trip_id) AS trip_count
    FROM travel_trip_destinations td
    INNER JOIN destinations d ON d.id = td.destination_id
    INNER JOIN travel_trips t ON t.id = td.trip_id
    WHERE t.company_id = ${companyId}
      AND d.type = 'COUNTRY'
    GROUP BY d.normalized_name
    ORDER BY trip_count DESC, display_name ASC
  `;

  const topDestinations = await prisma.$queryRaw<
    Array<{ display_name: string; kind: string; trip_count: bigint }>
  >`
    SELECT MIN(d.name) AS display_name,
           d.type AS kind,
           COUNT(DISTINCT td.trip_id) AS trip_count
    FROM travel_trip_destinations td
    INNER JOIN destinations d ON d.id = td.destination_id
    INNER JOIN travel_trips t ON t.id = td.trip_id
    WHERE t.company_id = ${companyId}
      AND d.type IN ('CITY', 'REGION', 'AREA', 'ATTRACTION')
    GROUP BY d.normalized_name, d.type
    ORDER BY trip_count DESC, display_name ASC
    LIMIT 25
  `;

  const dupCountryNorm = await prisma.$queryRaw<
    Array<{ normalized_name: string; row_count: bigint; names: string | null }>
  >`
    SELECT d.normalized_name AS normalized_name,
           COUNT(*) AS row_count,
           GROUP_CONCAT(DISTINCT d.name ORDER BY d.name SEPARATOR ' | ') AS names
    FROM destinations d
    WHERE d.company_id = ${companyId}
      AND d.type = 'COUNTRY'
    GROUP BY d.normalized_name
    HAVING COUNT(*) > 1
  `;

  const dupGeoPlaceKeys = await prisma.$queryRaw<
    Array<{ normalized_key: string; kind: string; row_count: bigint }>
  >`
    SELECT gp.normalized_key AS normalized_key,
           gp.kind AS kind,
           COUNT(*) AS row_count
    FROM geo_places gp
    WHERE gp.company_id = ${companyId}
    GROUP BY gp.normalized_key, gp.kind
    HAVING COUNT(*) > 1
  `;

  /** Títulos repetidos (posible duplicado de negocio o re-import) */
  const duplicateTitles = await prisma.$queryRaw<
    Array<{ title: string; trip_count: bigint }>
  >`
    SELECT t.title AS title, COUNT(*) AS trip_count
    FROM travel_trips t
    WHERE t.company_id = ${companyId}
    GROUP BY t.title
    HAVING COUNT(*) > 1
    ORDER BY trip_count DESC
    LIMIT 20
  `;

  /** Mismo import_slug no vacío (>1 fila no debería ocurrir por UNIQUE; si aparece, corrupción) */
  const dupImportSlug = await prisma.$queryRaw<
    Array<{ import_slug: string; trip_count: bigint }>
  >`
    SELECT t.import_slug AS import_slug, COUNT(*) AS trip_count
    FROM travel_trips t
    WHERE t.company_id = ${companyId}
      AND t.import_slug IS NOT NULL
      AND t.import_slug <> ''
    GROUP BY t.import_slug
    HAVING COUNT(*) > 1
  `;

  const geoPlaceTotal = await prisma.geoPlace.count({ where: { companyId } });
  const tripGeoPlaceTotal = await prisma.tripGeoPlace.count({
    where: { trip: { companyId } },
  });

  const orphanGeoPlaces = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt
    FROM geo_places gp
    WHERE gp.company_id = ${companyId}
      AND NOT EXISTS (
        SELECT 1
        FROM trip_geo_places tgp
        INNER JOIN travel_trips tt ON tt.id = tgp.trip_id
        WHERE tgp.geo_place_id = gp.id
          AND tt.company_id = ${companyId}
      )
  `;
  const orphanGeoCount = Number(orphanGeoPlaces[0]?.cnt ?? 0n);

  // --- Salida principal ---
  console.log('');
  bannerLine('=');
  console.log('TRAVEL CATALOG OVERVIEW');
  bannerLine('=');
  console.log('');
  console.log(`Empresa: ${company.name}`);
  console.log(`companyId: ${companyId}`);
  console.log('');
  dottedRow('Total viajes', totalTrips);
  console.log('');
  dottedRow('APPROVED', approved);
  dottedRow('PENDING_REVIEW', pendingReview);
  if (draft || rejected) {
    dottedRow('DRAFT', draft);
    dottedRow('REJECTED', rejected);
  }

  console.log('');
  subLine('-');
  console.log('Viajes por país');
  subLine('-');
  console.log(
    '(cada fila = viajes distintos con Destination COUNTRY; un viaje puede contar en varios países)',
  );
  if (tripsByCountry.length === 0) {
    console.log('(ningún enlace a Destination tipo COUNTRY)');
  } else {
    for (const r of tripsByCountry) {
      dottedRow(String(r.display_name), Number(r.trip_count));
    }
  }

  console.log('');
  subLine('-');
  console.log('Top destinos (CITY / REGION / AREA / ATTRACTION)');
  subLine('-');
  if (topDestinations.length === 0) {
    console.log('(ningún destino no-país enlazado)');
  } else {
    for (const r of topDestinations.slice(0, 15)) {
      dottedRow(`${r.display_name} [${r.kind}]`, Number(r.trip_count));
    }
    if (topDestinations.length > 15) {
      console.log(`(consulta interna: ${topDestinations.length} grupos; mostrados 15)`);
    }
  }

  console.log('');
  subLine('-');
  console.log('Data quality');
  subLine('-');
  dottedRow('Sin precio', tripsWithoutPrice);
  dottedRow(
    'Sin imágenes',
    tripsWithoutImages === null ? 'N/A (sin tabla travel_media_assets)' : tripsWithoutImages,
  );
  dottedRow('Sin geo', tripsWithoutGeo);
  dottedRow('Sin itinerario', tripsWithoutItinerary);
  console.log('');
  console.log('Detalle adicional (no suma errores automáticos):');
  dottedRow('Sin COUNTRY y main vacío', tripsWithoutCountry);
  dottedRow('mainDestination sin país', tripsMainDestWithoutCountryDest);
  dottedRow('APPROVED sin destinos', approvedWithoutDestinations);

  console.log('');
  subLine('-');
  console.log('Geo');
  subLine('-');
  dottedRow('GeoPlace', geoPlaceTotal);
  dottedRow('TripGeoPlace', tripGeoPlaceTotal);
  dottedRow('GeoPlace huérfanos', orphanGeoCount);

  console.log('');
  subLine('-');
  console.log('Duplicados / normalización');
  subLine('-');
  if (dupCountryNorm.length === 0) {
    console.log('Destinations COUNTRY: sin normalized_name duplicado en filas distintas.');
  } else {
    console.log('ATENCIÓN: destinos COUNTRY con mismo normalized_name en varias filas:');
    for (const d of dupCountryNorm) {
      console.log(
        `  · normalized_name="${d.normalized_name}" filas=${d.row_count} nombres=${d.names}`,
      );
    }
  }
  if (dupGeoPlaceKeys.length === 0) {
    console.log('GeoPlace: sin duplicados (normalized_key + kind).');
  } else {
    console.log('ATENCIÓN: GeoPlace duplicados por (normalized_key, kind):');
    for (const g of dupGeoPlaceKeys) {
      console.log(`  · kind=${g.kind} key="${g.normalized_key}" filas=${g.row_count}`);
    }
  }
  if (duplicateTitles.length === 0) {
    console.log('Títulos de viaje: sin duplicados exactos.');
  } else {
    console.log('Títulos repetidos (mismo string exacto):');
    for (const d of duplicateTitles) {
      console.log(`  · "${d.title.slice(0, 80)}…" → ${d.trip_count} viajes`);
    }
  }
  if (dupImportSlug.length === 0) {
    console.log('import_slug: sin colisiones (esperado).');
  } else {
    console.log('CRÍTICO: mismo import_slug en más de un viaje:');
    for (const d of dupImportSlug) {
      console.log(`  · slug="${d.import_slug}" → ${d.trip_count} filas`);
    }
  }

  console.log('');
  subLine('-');
  console.log('RESUMEN RÁPIDO');
  subLine('-');
  console.log(
    `Catálogo: ${totalTrips} viajes (${approved} aprobados, ${pendingReview} pendientes revisión). ` +
      `Países distintos (COUNTRY enlazado): ${tripsByCountry.length}. ` +
      `Geo: ${geoPlaceTotal} lugares, ${tripGeoPlaceTotal} enlaces viaje↔geo.`,
  );

  const problems: string[] = [];
  if (approvedWithoutDestinations > 0) {
    problems.push(
      `${approvedWithoutDestinations} APPROVED sin filas en travel_trip_destinations (ontología incompleta).`,
    );
  }
  if (tripsWithoutPrice > 0) {
    problems.push(`${tripsWithoutPrice} viajes sin indicative_price.`);
  }
  if (tripsWithoutImages !== null && tripsWithoutImages > 0) {
    problems.push(
      `${tripsWithoutImages} viajes sin TravelMediaAsset (sin hero enriquecido aún).`,
    );
  } else if (tripsWithoutImages === null) {
    problems.push(
      'Tabla travel_media_assets ausente: aplicar migraciones para medir “Sin imágenes”.',
    );
  }
  if (tripsWithoutGeo > 0) {
    problems.push(`${tripsWithoutGeo} viajes sin TripGeoPlace.`);
  }
  if (tripsWithoutItinerary > 0) {
    problems.push(`${tripsWithoutItinerary} viajes sin itinerario (días).`);
  }
  if (tripsMainDestWithoutCountryDest > 0) {
    problems.push(
      `${tripsMainDestWithoutCountryDest} viajes con texto main_destination pero sin Destination COUNTRY.`,
    );
  }
  if (dupCountryNorm.length || dupGeoPlaceKeys.length || dupImportSlug.length) {
    problems.push('Inconsistencias de unicidad en destinations o geo_places (ver sección duplicados).');
  }
  if (duplicateTitles.length) {
    problems.push(`Títulos exactos duplicados: ${duplicateTitles.length} grupos (revisar re-imports).`);
  }
  if (orphanGeoCount > 0) {
    problems.push(`${orphanGeoCount} GeoPlace sin ningún viaje enlazado (huérfanos de catálogo).`);
  }

  console.log('');
  subLine('-');
  console.log('POSIBLES PROBLEMAS DETECTADOS');
  subLine('-');
  if (problems.length === 0) {
    console.log('Ningún indicador rojo agregado (revisa igualmente detalle manual).');
  } else {
    for (const p of problems) {
      console.log(`· ${p}`);
    }
  }

  if (approvedWithoutDestIds.length > 0) {
    console.log('');
    console.log('Muestra APPROVED sin destinos (máx 15):');
    for (const t of approvedWithoutDestIds) {
      console.log(`  ${t.id}  ${t.title.slice(0, 70)}`);
    }
  }

  console.log('');
  bannerLine('=');
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
