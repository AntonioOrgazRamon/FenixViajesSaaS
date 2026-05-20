import type { NormalizedTravelPhoto, TravelImageSearchProvider } from './travel-media.types';

type PexelsSearchResponse = {
  photos?: Array<{
    id: number;
    width?: number;
    height?: number;
    url?: string;
    src?: { original?: string; large2x?: string; large?: string; medium?: string; tiny?: string };
    photographer?: string;
    photographer_url?: string;
    alt?: string;
  }>;
};

function toPhoto(q: string, row: NonNullable<PexelsSearchResponse['photos']>[0]): NormalizedTravelPhoto | null {
  const url = row.src?.large2x || row.src?.large || row.src?.original;
  if (!url) return null;
  const thumb = row.src?.medium || row.src?.tiny || null;
  const tags = row.alt ? [row.alt.slice(0, 120)] : null;
  return {
    sourceProvider: 'PEXELS',
    providerAssetId: String(row.id),
    queryUsed: q,
    imageUrl: url,
    thumbnailUrl: thumb,
    width: typeof row.width === 'number' ? row.width : null,
    height: typeof row.height === 'number' ? row.height : null,
    photographerName: row.photographer ?? null,
    photographerUrl: row.photographer_url ?? null,
    locationHint: null,
    tags,
    metadataJson: { provider: 'pexels', id: row.id, url: row.url },
  };
}

export function createPexelsProvider(apiKey: string): TravelImageSearchProvider {
  return {
    name: 'pexels',
    async searchLandscapes(query: string, perPage: number): Promise<NormalizedTravelPhoto[]> {
      const url = new URL('https://api.pexels.com/v1/search');
      url.searchParams.set('query', query);
      url.searchParams.set('per_page', String(Math.min(30, Math.max(1, perPage))));
      url.searchParams.set('orientation', 'landscape');

      const res = await fetch(url.toString(), {
        headers: { Authorization: apiKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Pexels HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }
      const json = (await res.json()) as PexelsSearchResponse;
      const rows = json.photos ?? [];
      const out: NormalizedTravelPhoto[] = [];
      for (const row of rows) {
        const p = toPhoto(query, row);
        if (p) out.push(p);
      }
      return out;
    },
  };
}
