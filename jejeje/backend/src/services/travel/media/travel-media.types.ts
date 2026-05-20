import type { TravelMediaSourceProvider } from '@prisma/client';

export type NormalizedTravelPhoto = {
  sourceProvider: TravelMediaSourceProvider;
  providerAssetId: string;
  queryUsed: string;
  /** URL HTTPS lista para <img> / PDF (Unsplash `regular`, Pexels `large`/`large2x`). */
  imageUrl: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  photographerName: string | null;
  photographerUrl: string | null;
  locationHint: string | null;
  tags: string[] | null;
  metadataJson: Record<string, unknown>;
};

export type TravelImageSearchProvider = {
  name: 'unsplash' | 'pexels';
  searchLandscapes(query: string, perPage: number): Promise<NormalizedTravelPhoto[]>;
};
