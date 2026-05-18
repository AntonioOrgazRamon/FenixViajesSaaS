/**
 * Jerarquía geo inicial conservadora: crea macrozonas y enlaza padres solo con coincidencia única.
 *
 * Sin flags destructivas: no borra ni fusiona nodos.
 *
 * Uso:
 *   npm run geo:seed-hierarchy -- --companyId=<uuid>           # dry-run (solo plan)
 *   npm run geo:seed-hierarchy -- --companyId=<uuid> --apply   # crea macro + enlaces seguros
 */
import 'dotenv/config';
import type { GeoPlaceKind } from '@prisma/client';
import prisma from '../src/infrastructure/db';
import { buildGeoNormalizedKey } from '../src/services/geo/geo-normalize';
import { normalizeKey } from '../src/services/travel/travel-search.scoring';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

const EXTERNAL_REF = 'geo-seed-hierarchy:v1';

const CONTINENTS: { name: string }[] = [
  { name: 'Asia' },
  { name: 'Europa' },
  { name: 'América del Norte' },
  { name: 'América del Sur' },
  { name: 'Oceanía' },
  { name: 'África' },
];

type PlaceKinds = GeoPlaceKind[];

function nkSet(aliases: string[]): Set<string> {
  const s = new Set<string>();
  for (const a of aliases) {
    const k = normalizeKey(a);
    if (k) s.add(k);
  }
  return s;
}

async function upsertPlace(
  companyId: string,
  canonicalName: string,
  kind: GeoPlaceKind,
  parentId: string | null,
): Promise<{ id: string }> {
  const normalizedKey = buildGeoNormalizedKey(canonicalName, kind);
  const row = await prisma.geoPlace.upsert({
    where: {
      companyId_normalizedKey_kind: { companyId, normalizedKey, kind },
    },
    create: {
      companyId,
      kind,
      canonicalName: canonicalName.slice(0, 255),
      normalizedKey,
      parentId: parentId ?? undefined,
      externalRef: EXTERNAL_REF,
    },
    update: {
      parentId: parentId === undefined ? undefined : parentId,
      externalRef: EXTERNAL_REF,
    },
  });
  return row;
}

async function findContinentId(companyId: string, name: string): Promise<string | null> {
  const nk = buildGeoNormalizedKey(name, 'CONTINENT');
  const r = await prisma.geoPlace.findFirst({
    where: { companyId, kind: 'CONTINENT', normalizedKey: nk },
    select: { id: true },
  });
  return r?.id ?? null;
}

function matchesAliases(row: { canonicalName: string; kind: GeoPlaceKind }, keys: Set<string>, kinds: PlaceKinds): boolean {
  if (!kinds.includes(row.kind)) return false;
  return keys.has(normalizeKey(row.canonicalName));
}

export type HierarchySeedPlan = {
  ensures: { kind: string; name: string; parent?: string }[];
  links: { geoPlaceId: string; name: string; newParentId: string; reason: string }[];
  skippedAmbiguous: { reason: string; aliasKeys: string[]; hits: number }[];
  skippedMissing: { reason: string; aliasKeys: string[] }[];
};

export async function planSeedHierarchy(companyId: string): Promise<HierarchySeedPlan> {
  const ensures: HierarchySeedPlan['ensures'] = [];
  const links: HierarchySeedPlan['links'] = [];
  const skippedAmbiguous: HierarchySeedPlan['skippedAmbiguous'] = [];
  const skippedMissing: HierarchySeedPlan['skippedMissing'] = [];

  for (const c of CONTINENTS) {
    ensures.push({ kind: 'CONTINENT', name: c.name });
  }
  ensures.push({ kind: 'MACRO_REGION', name: 'Océano Índico', parent: 'Oceanía' });

  const allPlaces = await prisma.geoPlace.findMany({
    where: { companyId },
    select: { id: true, canonicalName: true, kind: true, parentId: true },
  });

  type Rule = {
    continentName: string;
    aliases: string[];
    kinds: PlaceKinds;
    note: string;
  };

  const countryRules: Rule[] = [
    { continentName: 'Asia', aliases: ['Japón', 'Japan'], kinds: ['COUNTRY', 'REGION'], note: 'country→Asia' },
    { continentName: 'Asia', aliases: ['Vietnam', 'Viet Nam'], kinds: ['COUNTRY', 'REGION'], note: 'Vietnam→Asia' },
    { continentName: 'Asia', aliases: ['Tailandia', 'Thailand'], kinds: ['COUNTRY', 'REGION'], note: 'Thailand→Asia' },
    {
      continentName: 'Asia',
      aliases: ['Maldivas', 'Maldives'],
      kinds: ['COUNTRY', 'REGION', 'AREA'],
      note: 'Maldives→Océano Índico (prefer macro)',
    },
    { continentName: 'Europa', aliases: ['Francia', 'France'], kinds: ['COUNTRY', 'REGION'], note: 'France→Europa' },
    { continentName: 'Europa', aliases: ['Italia', 'Italy'], kinds: ['COUNTRY', 'REGION'], note: 'Italy→Europa' },
    {
      continentName: 'América del Norte',
      aliases: ['Estados Unidos', 'United States', 'USA', 'EEUU'],
      kinds: ['COUNTRY', 'REGION'],
      note: 'USA→América del Norte',
    },
    { continentName: 'América del Sur', aliases: ['Argentina'], kinds: ['COUNTRY', 'REGION'], note: 'Argentina→América del Sur' },
    {
      continentName: 'América del Norte',
      aliases: ['México', 'Mexico'],
      kinds: ['COUNTRY', 'REGION'],
      note: 'Mexico→América del Norte',
    },
  ];

  /** Para Maldivas sólo macro Océano Índico (crear con geo:seed-hierarchy --apply antes de enlazar). */
  async function continentIdForRule(rule: Rule): Promise<string | null> {
    const maldivesKeys = nkSet(['Maldivas', 'Maldives']);
    const isMaldivesRule = rule.aliases.some((a) => maldivesKeys.has(normalizeKey(a)));
    if (isMaldivesRule) {
      const macroNk = buildGeoNormalizedKey('Océano Índico', 'MACRO_REGION');
      const macro = await prisma.geoPlace.findFirst({
        where: { companyId, kind: 'MACRO_REGION', normalizedKey: macroNk },
        select: { id: true },
      });
      return macro?.id ?? null;
    }
    return findContinentId(companyId, rule.continentName);
  }

  for (const rule of countryRules) {
    const keys = nkSet(rule.aliases);
    const hits = allPlaces.filter((p) => matchesAliases(p, keys, rule.kinds));
    const parentId = await continentIdForRule(rule);
    if (!parentId) {
      skippedMissing.push({
        reason: `Sin padre macro/continente resuelto (${rule.note})`,
        aliasKeys: [...keys],
      });
      continue;
    }
    if (hits.length === 0) {
      skippedMissing.push({ reason: `Sin GeoPlace legacy para ${rule.note}`, aliasKeys: [...keys] });
      continue;
    }
    if (hits.length > 1) {
      skippedAmbiguous.push({
        reason: rule.note,
        aliasKeys: [...keys],
        hits: hits.length,
      });
      continue;
    }
    const h = hits[0]!;
    if (h.parentId != null) {
      skippedAmbiguous.push({
        reason: `${rule.note}: ya tiene parent`,
        aliasKeys: [...keys],
        hits: 1,
      });
      continue;
    }
    links.push({
      geoPlaceId: h.id,
      name: h.canonicalName,
      newParentId: parentId,
      reason: rule.note,
    });
  }

  type CityRule = {
    cityAliases: string[];
    countryAliases: string[];
    kinds: PlaceKinds;
    note: string;
  };

  const cityRules: CityRule[] = [
    { cityAliases: ['Tokio', 'Tokyo'], countryAliases: ['Japón', 'Japan'], kinds: ['CITY', 'AREA'], note: 'Tokyo→Japan' },
    { cityAliases: ['Kioto', 'Kyoto'], countryAliases: ['Japón', 'Japan'], kinds: ['CITY', 'AREA'], note: 'Kyoto→Japan' },
    { cityAliases: ['Osaka'], countryAliases: ['Japón', 'Japan'], kinds: ['CITY', 'AREA'], note: 'Osaka→Japan' },
    { cityAliases: ['Hanoi', 'Hanói'], countryAliases: ['Vietnam', 'Viet Nam'], kinds: ['CITY', 'AREA'], note: 'Hanoi→Vietnam' },
    { cityAliases: ['Bangkok'], countryAliases: ['Tailandia', 'Thailand'], kinds: ['CITY', 'AREA'], note: 'Bangkok→Thailand' },
    { cityAliases: ['París', 'Paris'], countryAliases: ['Francia', 'France'], kinds: ['CITY', 'AREA'], note: 'Paris→France' },
    { cityAliases: ['Roma', 'Rome'], countryAliases: ['Italia', 'Italy'], kinds: ['CITY', 'AREA'], note: 'Rome→Italy' },
    {
      cityAliases: ['Nueva York', 'New York'],
      countryAliases: ['Estados Unidos', 'United States', 'USA'],
      kinds: ['CITY', 'AREA'],
      note: 'NYC→USA',
    },
    {
      cityAliases: ['Buenos Aires'],
      countryAliases: ['Argentina'],
      kinds: ['CITY', 'AREA'],
      note: 'BA→Argentina',
    },
  ];

  for (const cr of cityRules) {
    const ck = nkSet(cr.cityAliases);
    const pk = nkSet(cr.countryAliases);
    const cities = allPlaces.filter((p) => matchesAliases(p, ck, cr.kinds));
    const countries = allPlaces.filter((p) => matchesAliases(p, pk, ['COUNTRY', 'REGION']));
    if (cities.length !== 1 || countries.length !== 1) {
      if (cities.length === 0 || countries.length === 0) {
        skippedMissing.push({
          reason: cr.note,
          aliasKeys: [...new Set([...ck, ...pk])],
        });
      } else {
        skippedAmbiguous.push({
          reason: cr.note,
          aliasKeys: [...new Set([...ck, ...pk])],
          hits: cities.length + countries.length,
        });
      }
      continue;
    }
    const city = cities[0]!;
    const country = countries[0]!;
    if (city.parentId != null) {
      skippedAmbiguous.push({
        reason: `${cr.note}: ciudad ya tiene parent`,
        aliasKeys: [...ck],
        hits: 1,
      });
      continue;
    }
    links.push({
      geoPlaceId: city.id,
      name: city.canonicalName,
      newParentId: country.id,
      reason: cr.note,
    });
  }

  return { ensures, links, skippedAmbiguous, skippedMissing };
}

export async function applySeedHierarchy(companyId: string): Promise<HierarchySeedPlan> {
  for (const c of CONTINENTS) {
    await upsertPlace(companyId, c.name, 'CONTINENT', null);
  }
  const oceaniaId = await findContinentId(companyId, 'Oceanía');
  if (oceaniaId) {
    await upsertPlace(companyId, 'Océano Índico', 'MACRO_REGION', oceaniaId);
  }

  const plan = await planSeedHierarchy(companyId);

  if (plan.links.length > 0) {
    await prisma.$transaction(
      plan.links.map((link) =>
        prisma.geoPlace.update({
          where: { id: link.geoPlaceId },
          data: { parentId: link.newParentId, externalRef: EXTERNAL_REF },
        }),
      ),
    );
  }

  return plan;
}

async function main() {
  const companyId = arg('--companyId')?.trim();
  const apply = process.argv.includes('--apply');
  if (!companyId) {
    console.error('Uso: --companyId=<uuid> [--apply]');
    process.exit(1);
  }

  if (!apply) {
    console.log(JSON.stringify(await planSeedHierarchy(companyId), null, 2));
    return;
  }

  console.log(JSON.stringify(await applySeedHierarchy(companyId), null, 2));
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
