/**
 * QA enriquecimiento de media (Unsplash/Pexels → TravelMediaAsset).
 *
 * Requiere: DATABASE_URL, QA_COMPANY_ID
 * Opcional: QA_TRIP_ID (UUID de un TravelTrip APPROVED); si falta, lista los últimos viajes y assets.
 * API: UNSPLASH_ACCESS_KEY y/o PEXELS_API_KEY (+ TRAVEL_MEDIA_* en .env)
 *
 * npm run qa:travel-media
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import { TravelMediaEnrichmentService } from '../src/services/travel/media/travel-media-enrichment.service';
import { config } from '../src/common/config';

async function main() {
  const companyId = process.env.QA_COMPANY_ID?.trim();
  const tripIdEnv = process.env.QA_TRIP_ID?.trim();

  if (!companyId) {
    console.error('Define QA_COMPANY_ID en el entorno.');
    process.exit(1);
  }

  const hasUnsplash = !!config.UNSPLASH_ACCESS_KEY?.trim();
  const hasPexels = !!config.PEXELS_API_KEY?.trim();

  console.log('--- QA travel media ---');
  console.log('TRAVEL_MEDIA_ENABLED:', config.TRAVEL_MEDIA_ENABLED);
  console.log('TRAVEL_MEDIA_PROVIDER:', config.TRAVEL_MEDIA_PROVIDER);
  console.log('TRAVEL_MEDIA_MAX_IMAGES:', config.TRAVEL_MEDIA_MAX_IMAGES);
  console.log('keys:', { unsplash: hasUnsplash, pexels: hasPexels });

  if (!config.TRAVEL_MEDIA_ENABLED) {
    console.warn('TRAVEL_MEDIA_ENABLED es false; runForTrip saldrá sin API.');
  }
  if (!hasUnsplash && !hasPexels) {
    console.warn('Sin UNSPLASH_ACCESS_KEY ni PEXELS_API_KEY no habrá llamadas a proveedores.');
  }

  if (tripIdEnv) {
    const t0 = Date.now();
    await new TravelMediaEnrichmentService().runForTrip(companyId, tripIdEnv);
    const ms = Date.now() - t0;
    console.log('runForTrip_ms:', ms);

    const assets = await prisma.travelMediaAsset.findMany({
      where: { companyId, tripId: tripIdEnv },
      orderBy: { orderIndex: 'asc' },
      select: {
        orderIndex: true,
        isPrimary: true,
        sourceProvider: true,
        imageUrl: true,
        width: true,
        height: true,
        photographerName: true,
        queryUsed: true,
      },
    });
    const job = await prisma.travelMediaJob.findFirst({
      where: { companyId, tripId: tripIdEnv },
      orderBy: { startedAt: 'desc' },
      select: {
        status: true,
        providerUsed: true,
        assetsCreated: true,
        errorMessage: true,
        querySummary: true,
        startedAt: true,
        finishedAt: true,
      },
    });
    console.log('latest_job:', job);
    console.log('assets_count:', assets.length);
    assets.forEach((a, i) => {
      console.log(
        `  [${i}] primary=${a.isPrimary} ${a.sourceProvider} ${a.width}x${a.height} q="${a.queryUsed.slice(0, 50)}…"`,
      );
      console.log(`      url: ${a.imageUrl.slice(0, 90)}…`);
    });
  } else {
    const trips = await prisma.travelTrip.findMany({
      where: { companyId, status: 'APPROVED' },
      orderBy: { updatedAt: 'desc' },
      take: 12,
      select: {
        id: true,
        title: true,
        mainDestination: true,
        updatedAt: true,
      },
    });
    const counts = await prisma.travelMediaAsset.groupBy({
      by: ['tripId'],
      where: { companyId },
      _count: { _all: true },
    });
    const countByTrip = new Map(counts.map((c) => [c.tripId, c._count._all]));

    console.log('Últimos viajes APPROVED (sin QA_TRIP_ID no se ejecuta enrichment):');
    for (const t of trips) {
      const n = countByTrip.get(t.id) ?? 0;
      console.log(`  ${t.id}  assets=${n}  ${t.title} — ${t.mainDestination ?? ''}`);
    }
    console.log('\nPara ejecutar: QA_TRIP_ID=<uuid> npm run qa:travel-media');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
