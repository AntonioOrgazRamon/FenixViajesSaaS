/**
 * Comparación geo OFF (prod default) vs geo ON simulado (geoStagingBypass).
 * No modifica .env: usa `TravelSearchService` con `geoStagingBypass: true`.
 *
 * npm run qa:geo-compare -- --companyId=<uuid>
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import { TravelSearchService } from '../src/services/travel/travel-search.service';
import type { TravelSearchIntent } from '../src/services/travel/travel-search.schema';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1)?.trim();
}

const DESTINATIONS = [
  'Asia',
  'Japón',
  'Tokio',
  'Patagonia',
  'Buenos Aires',
  'Montevideo',
  'Iguazú',
  'Maldivas',
];

async function main() {
  const companyId = arg('--companyId');
  if (!companyId) {
    console.error('Uso: npm run qa:geo-compare -- --companyId=<uuid>');
    process.exit(1);
  }

  const approved = await prisma.travelTrip.count({ where: { companyId, status: 'APPROVED' } });
  if (!approved) {
    console.error('Sin viajes APPROVED.');
    process.exit(2);
  }

  const svc = new TravelSearchService();

  for (const d of DESTINATIONS) {
    const intent: TravelSearchIntent = { destination: d, durationDays: 10, budgetPerPerson: 3500 };
    const tOff = Date.now();
    const off = await svc.searchByIntent(companyId, intent, { telemetryVerbose: true });
    const msOff = Date.now() - tOff;

    const tOn = Date.now();
    const on = await svc.searchByIntent(companyId, intent, { geoStagingBypass: true, telemetryVerbose: true });
    const msOn = Date.now() - tOn;

    const ids = async (r: typeof off) =>
      r.ranked.slice(0, 5).map((x) => {
        return x.tripId;
      });

    const title = async (tid: string) =>
      (await prisma.travelTrip.findFirst({ where: { id: tid }, select: { title: true } }))?.title ?? tid;

    const offTop = await Promise.all((await ids(off)).map(async (id) => `${(await title(id)).slice(0, 55)}`));
    const onTop = await Promise.all((await ids(on)).map(async (id) => `${(await title(id)).slice(0, 55)}`));

    console.log('\n===', d, '===');
    console.log({
      tiempo_ms_geo_off: msOff,
      tiempo_ms_geo_staging_on: msOn,
      match_off: off.matchState,
      match_on: on.matchState,
      relaxed_off: off.relaxedAlternatives,
      relaxed_on: on.relaxedAlternatives,
      telemetry_geo_prefilter_off: off.debug?.telemetry
        ? (off.debug.telemetry as { counts?: { geoPrefilterActive?: boolean } }).counts?.geoPrefilterActive
        : undefined,
      telemetry_geo_prefilter_on: on.debug?.telemetry
        ? (on.debug.telemetry as { counts?: { geoPrefilterActive?: boolean } }).counts?.geoPrefilterActive
        : undefined,
    });
    console.log('TOP5 OFF:', offTop);
    console.log('TOP5 ON (staging bypass):', onTop);
    const sameOrder = offTop.every((t, i) => t === onTop[i]);
    if (sameOrder) console.log('→ Ranking top5 idéntico (geo no cambió orden en este caso).');
    else console.log('→ Ranking top5 cambió con contexto geo.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
