/**
 * QA geo: baseline (sin grafo) vs geo activo vía geoStagingBypass — equivalente operativo a TRAVEL_GEO_RETRIEVAL_ENABLED=true
 * cuando el flag global está en false (sin editar .env).
 *
 * npm run qa:geo-deep -- --companyId=<uuid>
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import { TravelSearchService } from '../src/services/travel/travel-search.service';
import type { TravelSearchIntent } from '../src/services/travel/travel-search.schema';
import { config } from '../src/common/config';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1)?.trim();
}

const DESTINATIONS = [
  'Argentina',
  'Patagonia',
  'Buenos Aires',
  'Montevideo',
  'Iguazú',
  'Cono Sur',
  'América del Sur',
  'Planeta Zargoth',
];

async function main() {
  const companyId = arg('--companyId');
  if (!companyId) {
    console.error('Uso: npm run qa:geo-deep -- --companyId=<uuid>');
    process.exit(1);
  }

  const approved = await prisma.travelTrip.count({ where: { companyId, status: 'APPROVED' } });
  if (!approved) {
    console.error('Sin viajes APPROVED.');
    process.exit(2);
  }

  console.log(
    JSON.stringify({
      TRAVEL_GEO_RETRIEVAL_ENABLED_env: config.TRAVEL_GEO_RETRIEVAL_ENABLED,
      note: 'OFF = sin geoStagingBypass (respeta env). ON = geoStagingBypass:true → mismo plan/scoring que geo habilitado cuando env=false.',
    }),
  );

  const svc = new TravelSearchService();
  const baseIntent = (d: string): TravelSearchIntent => ({
    destination: d,
    durationDays: 10,
    budgetPerPerson: 3500,
  });

  for (const d of DESTINATIONS) {
    const intent = baseIntent(d);
    const tOff = Date.now();
    const off = await svc.searchByIntent(companyId, intent, { telemetryVerbose: true });
    const msOff = Date.now() - tOff;

    const tOn = Date.now();
    const on = await svc.searchByIntent(companyId, intent, {
      geoStagingBypass: true,
      telemetryVerbose: true,
    });
    const msOn = Date.now() - tOn;

    const title = async (tid: string) =>
      (await prisma.travelTrip.findFirst({ where: { id: tid }, select: { title: true } }))?.title ?? tid;

    const topTitles = async (r: typeof off) =>
      Promise.all(r.ranked.slice(0, 5).map(async (x) => (await title(x.tripId)).slice(0, 56)));

    const offTop = await topTitles(off);
    const onTop = await topTitles(on);

    let geoNotes: string[] | undefined;
    const telOn = on.debug?.telemetry as { counts?: { geoPrefilterActive?: boolean } } | undefined;
    const geoPrefilterOn = telOn?.counts?.geoPrefilterActive;

    try {
      const { TripGeoRetrievalService } = await import('../src/services/geo/trip-geo-retrieval.service');
      const plan = await new TripGeoRetrievalService().plan(companyId, d, {
        bypassFeatureFlag: !config.TRAVEL_GEO_RETRIEVAL_ENABLED,
      });
      geoNotes = plan.notes;
    } catch {
      geoNotes = ['PLAN_ERROR'];
    }

    console.log('\n===', d, '===');
    console.log({
      ms_off: msOff,
      ms_on_geoBypass: msOn,
      match_off: off.matchState,
      match_on: on.matchState,
      relaxed_off: off.relaxedAlternatives,
      relaxed_on: on.relaxedAlternatives,
      geo_plan_notes: geoNotes,
      pool_retrieval_off: (off.debug?.telemetry as { counts?: { retrievalPool?: number } })?.counts
        ?.retrievalPool,
      pool_retrieval_on: (on.debug?.telemetry as { counts?: { retrievalPool?: number } })?.counts
        ?.retrievalPool,
      geo_prefilter_active_on: geoPrefilterOn,
    });
    console.log('TOP5 OFF:', offTop);
    console.log('TOP5 ON:', onTop);
    const same = offTop.every((t, i) => t === onTop[i]);
    console.log(same ? '→ Top5 idéntico' : '→ Top5 cambió con geo');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
