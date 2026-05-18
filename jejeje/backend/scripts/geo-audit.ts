/**
 * Auditoría jerárquica + duplicados semánticos (PASO 4).
 * Uso: npx ts-node --transpile-only scripts/geo-audit.ts --companyId=<uuid>
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import { normalizeKey } from '../src/services/travel/travel-search.scoring';
import { fetchGeoMetrics } from './geo-metrics';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

/** Grupos sólo informativos; no fusionar automáticamente. */
const SEMANTIC_ALIAS_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Japón', keys: ['japon', 'japan'] },
  { label: 'Maldivas', keys: ['maldivas', 'maldives'] },
  { label: 'EEUU/USA', keys: ['estados-unidos', 'united-states', 'usa', 'eeuu'] },
  { label: 'Reino Unido', keys: ['reino-unido', 'united-kingdom', 'uk'] },
  { label: 'Vietnam', keys: ['vietnam', 'viet-nam'] },
  { label: 'México', keys: ['mexico'] },
];

async function main() {
  const companyId = arg('--companyId')?.trim();
  if (!companyId) {
    console.error('Uso: --companyId=<uuid>');
    process.exit(1);
  }

  const metrics = await fetchGeoMetrics(companyId);
  const places = await prisma.geoPlace.findMany({
    where: { companyId },
    select: { id: true, canonicalName: true, kind: true, parentId: true },
  });

  const nkIndex = new Map<string, typeof places>();
  for (const p of places) {
    const k = normalizeKey(p.canonicalName);
    const arr = nkIndex.get(k) ?? [];
    arr.push(p);
    nkIndex.set(k, arr);
  }

  const semanticHits: { label: string; matches: { id: string; name: string; kind: string }[] }[] = [];
  for (const g of SEMANTIC_ALIAS_GROUPS) {
    const hits: typeof semanticHits[number]['matches'] = [];
    const keySet = new Set(g.keys);
    for (const p of places) {
      if (keySet.has(normalizeKey(p.canonicalName))) {
        hits.push({ id: p.id, name: p.canonicalName, kind: p.kind });
      }
    }
    if (hits.length) semanticHits.push({ label: g.label, matches: hits });
  }

  const flatContinents = places.filter((p) => p.kind === 'CONTINENT').length;
  const regionsNoCountry = places.filter(
    (p) =>
      p.kind === 'REGION' &&
      (!p.parentId ||
        !places.some((x) => x.id === p.parentId && ['COUNTRY', 'MACRO_REGION', 'AREA'].includes(x.kind))),
  );
  const citiesNoCountry = places.filter(
    (p) =>
      ['CITY', 'AREA'].includes(p.kind) &&
      (!p.parentId ||
        !places.some((x) => x.id === p.parentId && ['COUNTRY', 'REGION', 'MACRO_REGION', 'ISLAND'].includes(x.kind))),
  );
  const islandsNoParent = places.filter((p) => p.kind === 'ISLAND' && !p.parentId);
  const attractionsNoParent = places.filter((p) => ['ATTRACTION', 'POI'].includes(p.kind) && !p.parentId);

  const audit = {
    companyId,
    metricsSummary: metrics,
    hierarchySketch: {
      continentNodes: flatContinents,
      regions_flagged_parentAmbiguous: regionsNoCountry.length,
      cities_flagged_parentAmbiguous: citiesNoCountry.length,
      islands_without_parent: islandsNoParent.length,
      attractions_without_parent: attractionsNoParent.length,
    },
    samples: {
      regionsNeedReview: regionsNoCountry.slice(0, 12).map((p) => ({ id: p.id, name: p.canonicalName })),
      citiesNeedReview: citiesNoCountry.slice(0, 12).map((p) => ({ id: p.id, name: p.canonicalName })),
      islandsNeedReview: islandsNoParent.slice(0, 12).map((p) => ({ id: p.id, name: p.canonicalName })),
      attractionsNeedReview: attractionsNoParent.slice(0, 12).map((p) => ({ id: p.id, name: p.canonicalName })),
    },
    semanticAliasClusters: semanticHits,
    note:
      'Los grupos semánticos sólo detectan coincidencias por normalización; fusionar es manual. Ejecutar geo:seed-hierarchy --apply sólo tras revisar plan.',
  };

  console.log(JSON.stringify(audit, null, 2));
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
