import type { DestinationKind, GeoPlace, GeoPlaceKind, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../infrastructure/db';
import { normalizeKey, tokenize } from '../travel/travel-search.scoring';
import { buildGeoNormalizedKey } from './geo-normalize';

/** Expande raíces geográficas: ancestros + descendientes (BFS acotado por profundidad). */
export async function expandGeoPlaceClosure(
  companyId: string,
  rootIds: string[],
  maxDepth: number,
): Promise<Set<string>> {
  const out = new Set(rootIds.filter(Boolean));
  if (!out.size) return out;

  let frontier = [...out];
  let depth = 0;
  while (frontier.length && depth < maxDepth) {
    const rows = await prisma.geoPlace.findMany({
      where: { companyId, id: { in: frontier } },
      select: { parentId: true },
    });
    const next: string[] = [];
    for (const r of rows) {
      if (r.parentId && !out.has(r.parentId)) {
        out.add(r.parentId);
        next.push(r.parentId);
      }
    }
    frontier = next;
    depth++;
  }

  frontier = [...rootIds];
  depth = 0;
  while (frontier.length && depth < maxDepth) {
    const children = await prisma.geoPlace.findMany({
      where: { companyId, parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = [];
    for (const c of children) {
      if (!out.has(c.id)) {
        out.add(c.id);
        frontier.push(c.id);
      }
    }
    depth++;
  }

  return out;
}

export async function loadParentMapSubset(
  companyId: string,
  seedIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  let frontier = [...new Set(seedIds)].filter(Boolean);
  const queued = new Set<string>(frontier);
  let iterations = 0;

  while (frontier.length && iterations++ < 120) {
    const rows = await prisma.geoPlace.findMany({
      where: { companyId, id: { in: frontier } },
      select: { id: true, parentId: true },
    });
    frontier = [];
    for (const r of rows) {
      map.set(r.id, r.parentId ?? null);
      const pid = r.parentId;
      if (pid && !map.has(pid) && !queued.has(pid)) {
        queued.add(pid);
        frontier.push(pid);
      }
    }
  }
  return map;
}

export function ancestorChainFromParentMap(placeId: string, parentMap: Map<string, string | null>): string[] {
  const out: string[] = [];
  let cur = parentMap.get(placeId) ?? null;
  const guard = new Set<string>();
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    out.push(cur);
    cur = parentMap.get(cur) ?? null;
  }
  return out;
}

export class GeoPlaceService {
  async findByNormalizedKeys(
    companyId: string,
    keys: string[],
    take = 50,
  ): Promise<GeoPlace[]> {
    const uniq = [...new Set(keys.filter(Boolean))];
    if (!uniq.length) return [];
    return prisma.geoPlace.findMany({
      where: { companyId, normalizedKey: { in: uniq } },
      take,
    });
  }

  async searchByLooseText(companyId: string, text: string, take = 48): Promise<GeoPlace[]> {
    const raw = text.trim();
    if (!raw.length) return [];
    const nk = normalizeKey(raw);
    const toks = tokenize(raw).slice(0, 12);
    const or: Prisma.GeoPlaceWhereInput[] = [
      { canonicalName: { contains: raw.slice(0, 120) } },
      { normalizedKey: { contains: nk } },
    ];
    for (const t of toks) {
      or.push({ normalizedKey: { contains: t } });
      or.push({ canonicalName: { contains: t } });
    }
    return prisma.geoPlace.findMany({
      where: { companyId, OR: or },
      take,
      orderBy: [{ kind: 'asc' }, { canonicalName: 'asc' }],
    });
  }

  /** Resolver intención textual → filas GeoPlace candidatas (ambigüedad posible → revisión manual). */
  async resolveIntentToGeoPlaces(companyId: string, destinationText: string): Promise<GeoPlace[]> {
    const loose = await this.searchByLooseText(companyId, destinationText);
    const head = destinationText.split(',')[0]?.trim() || destinationText;
    const nkCountry = buildGeoNormalizedKey(head, 'COUNTRY');
    const nkCity = buildGeoNormalizedKey(head, 'CITY');
    const nkRegion = buildGeoNormalizedKey(head, 'REGION');
    const exactish = await this.findByNormalizedKeys(companyId, [nkCountry, nkCity, nkRegion]);
    const byId = new Map<string, GeoPlace>();
    for (const p of [...exactish, ...loose]) byId.set(p.id, p);
    return [...byId.values()];
  }

  async upsertGeoPlace(params: {
    companyId: string;
    kind: GeoPlaceKind;
    canonicalName: string;
    parentId?: string | null;
    externalRef?: string | null;
    legacyDestinationId?: string | null;
    id?: string;
  }): Promise<GeoPlace> {
    const normalizedKey = buildGeoNormalizedKey(params.canonicalName, params.kind);
    const id = params.id ?? uuidv4();
    return prisma.geoPlace.upsert({
      where: {
        companyId_normalizedKey_kind: {
          companyId: params.companyId,
          normalizedKey,
          kind: params.kind,
        },
      },
      create: {
        id,
        companyId: params.companyId,
        kind: params.kind,
        canonicalName: params.canonicalName.slice(0, 255),
        normalizedKey,
        parentId: params.parentId ?? undefined,
        externalRef: params.externalRef ?? undefined,
        legacyDestinationId: params.legacyDestinationId ?? undefined,
      },
      update: {
        canonicalName: params.canonicalName.slice(0, 255),
        parentId: params.parentId === undefined ? undefined : params.parentId,
        externalRef: params.externalRef === undefined ? undefined : params.externalRef,
        legacyDestinationId: params.legacyDestinationId === undefined ? undefined : params.legacyDestinationId,
      },
    });
  }

  async batchAncestorIdsForPlaces(
    companyId: string,
    placeIds: string[],
  ): Promise<Map<string, string[]>> {
    const uniq = [...new Set(placeIds)].filter(Boolean);
    const map = new Map<string, string[]>();
    if (!uniq.length) return map;
    const parentMap = await loadParentMapSubset(companyId, uniq);
    for (const id of uniq) {
      map.set(id, ancestorChainFromParentMap(id, parentMap));
    }
    return map;
  }

  async listDescendantIds(companyId: string, rootId: string, maxDepth = 8): Promise<string[]> {
    const closure = await expandGeoPlaceClosure(companyId, [rootId], maxDepth);
    closure.delete(rootId);
    return [...closure];
  }

  async listAncestorIds(companyId: string, placeId: string): Promise<string[]> {
    const m = await this.batchAncestorIdsForPlaces(companyId, [placeId]);
    return m.get(placeId) ?? [];
  }
}
