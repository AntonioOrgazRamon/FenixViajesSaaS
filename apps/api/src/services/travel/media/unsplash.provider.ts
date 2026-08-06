import type { NormalizedTravelPhoto, TravelImageSearchProvider } from './travel-media.types';

type UnsplashSearchResponse = {
  results?: Array<{
    id: string;
    width?: number;
    height?: number;
    urls?: { raw?: string; full?: string; regular?: string; small?: string; thumb?: string };
    user?: { name?: string; links?: { html?: string } };
    tags?: Array<{ title?: string }>;
  }>;
};

function toPhoto(q: string, row: NonNullable<UnsplashSearchResponse['results']>[0]): NormalizedTravelPhoto | null {
  const url = row.urls?.regular || row.urls?.full;
  if (!url || !row.id) return null;
  const thumb = row.urls?.small ?? row.urls?.thumb ?? null;
  const tags = Array.isArray(row.tags)
    ? row.tags.map((t) => t.title).filter((x): x is string => typeof x === 'string' && x.length > 0)
    : null;
  return {
    sourceProvider: 'UNSPLASH',
    providerAssetId: String(row.id),
    queryUsed: q,
    imageUrl: url,
    thumbnailUrl: thumb,
    width: typeof row.width === 'number' ? row.width : null,
    height: typeof row.height === 'number' ? row.height : null,
    photographerName: row.user?.name ?? null,
    photographerUrl: row.user?.links?.html ?? null,
    locationHint: null,
    tags,
    metadataJson: { provider: 'unsplash', id: row.id },
  };
}

export function createUnsplashProvider(accessKey: string): TravelImageSearchProvider {
  return {
    name: 'unsplash',
    async searchLandscapes(query: string, perPage: number): Promise<NormalizedTravelPhoto[]> {
      const url = new URL('https://api.unsplash.com/search/photos');
      url.searchParams.set('query', query);
      url.searchParams.set('per_page', String(Math.min(30, Math.max(1, perPage))));
      url.searchParams.set('orientation', 'landscape');
      url.searchParams.set('content_filter', 'high');

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Client-ID ${accessKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Unsplash HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }
      const json = (await res.json()) as UnsplashSearchResponse;
      const rows = json.results ?? [];
      const out: NormalizedTravelPhoto[] = [];
      for (const row of rows) {
        const p = toPhoto(query, row);
        if (p) out.push(p);
      }
      return out;
    },
  };
}
