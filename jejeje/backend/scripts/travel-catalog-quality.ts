/**
 * Informe de calidad del catálogo por tenant → docs/TRAVEL_CATALOG_QUALITY.md
 *
 * npm run travel:catalog-quality -- --companyId=<uuid>
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../src/infrastructure/db';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1)?.trim();
}

type Tier = 'Excelente' | 'Bueno' | 'Mejorable' | 'Pobre';

function tier(row: {
  indicativePrice: unknown;
  hotels: number;
  itineraryDays: { title: string | null; description: string | null }[];
  highlights: { text: string }[];
  tripDestinations: number;
}): Tier {
  const priceOk = row.indicativePrice != null;
  const hotelsOk = row.hotels > 0;
  const richIt = row.itineraryDays.filter(
    (d) => (d.title?.trim().length ?? 0) > 3 || (d.description?.trim().length ?? 0) > 10,
  ).length;
  const hl = row.highlights.filter((h) => h.text?.trim().length > 10).length;

  if (!row.tripDestinations || richIt < 2 || hl < 1) return 'Pobre';
  if (priceOk && hotelsOk && richIt >= 5 && hl >= 3) return 'Excelente';
  if ((priceOk || hotelsOk) && richIt >= 3 && hl >= 2) return 'Bueno';
  return 'Mejorable';
}

async function main() {
  const companyId = arg('--companyId');
  if (!companyId) {
    console.error('Uso: npm run travel:catalog-quality -- --companyId=<uuid>');
    process.exit(1);
  }

  const company = await prisma.company.findFirst({ where: { id: companyId }, select: { name: true } });
  const trips = await prisma.travelTrip.findMany({
    where: { companyId },
    select: {
      id: true,
      title: true,
      status: true,
      mainDestination: true,
      durationDays: true,
      indicativePrice: true,
      currency: true,
      currency: true,
      importSlug: true,
      tripDestinations: { select: { destinationId: true } },
      tripGeoPlaces: { select: { geoPlaceId: true } },
      hotels: { select: { id: true } },
      itineraryDays: { select: { title: true, description: true } },
      highlights: { select: { text: true } },
    },
    orderBy: { title: 'asc' },
  });

  const counts = {
    total: trips.length,
    APPROVED: trips.filter((t) => t.status === 'APPROVED').length,
    PENDING_REVIEW: trips.filter((t) => t.status === 'PENDING_REVIEW').length,
    sin_precio: trips.filter((t) => t.indicativePrice == null).length,
    sin_hoteles: trips.filter((t) => !t.hotels.length).length,
    sin_ciudad_destino: 0 as number,
    sin_pais_destino: 0 as number,
  };

  const tripIds = trips.map((t) => t.id);
  const destRows = await prisma.travelTripDestination.findMany({
    where: { tripId: { in: tripIds } },
    include: { destination: { select: { type: true } } },
  });
  const byTrip = new Map<string, Set<string>>();
  for (const r of destRows) {
    if (!byTrip.has(r.tripId)) byTrip.set(r.tripId, new Set());
    byTrip.get(r.tripId)!.add(r.destination.type);
  }
  for (const t of trips) {
    const types = byTrip.get(t.id);
    if (!types?.has('CITY')) counts.sin_ciudad_destino++;
    if (!types?.has('COUNTRY')) counts.sin_pais_destino++;
  }

  const tiers: Record<Tier, number> = { Excelente: 0, Bueno: 0, Mejorable: 0, Pobre: 0 };
  const lines: string[] = [];
  lines.push(`# Calidad de catálogo — ${company?.name ?? companyId}`);
  lines.push('');
  lines.push(`Generado: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Agregados');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(counts, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## Por viaje');
  lines.push('');
  lines.push('| Estado | Tier | Título | Precio | Hoteles | It.days | Highlights |');
  lines.push('|--------|------|--------|--------|---------|---------|------------|');

  for (const t of trips) {
    const ti = tier({
      indicativePrice: t.indicativePrice,
      hotels: t.hotels.length,
      itineraryDays: t.itineraryDays,
      highlights: t.highlights,
      tripDestinations: t.tripDestinations.length,
    });
    tiers[ti]++;
    const price =
      t.indicativePrice != null ? `${Number(t.indicativePrice)} ${t.currency ?? ''}`.trim() : '—';
    lines.push(
      `| ${t.status} | ${ti} | ${t.title.replace(/\|/g, '/').slice(0, 55)} | ${price} | ${t.hotels.length} | ${t.itineraryDays.length} | ${t.highlights.length} |`,
    );
  }

  lines.push('');
  lines.push('## Distribución tier (heurística interna)');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(tiers, null, 2));
  lines.push('```');

  const repoRoot = path.join(process.cwd(), '..');
  const outPath = path.join(repoRoot, 'docs', 'TRAVEL_CATALOG_QUALITY.md');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('Escrito:', outPath);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
