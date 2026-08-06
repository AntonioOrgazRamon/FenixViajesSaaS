/** Contratos UI ↔ GET /travel/trips/library (+ detail). */
export type TravelLibraryQualityFlags = {
  noPrice: boolean;
  noHotels: boolean;
  noImage: boolean;
  noItinerary: boolean;
  noGeo: boolean;
  importWarning?: boolean;
};

export type TravelLibraryMetrics = {
  totalTrips: number;
  approved: number;
  pendingReview: number;
  draftRejected: number;
  countryCount: number;
  withoutPrice: number;
  withoutPrimaryImage: number;
};

export type TravelLibraryItem = {
  id: string;
  title: string;
  mainDestination: string | null;
  countries: string[];
  cities: string[];
  durationDays: number | null;
  priceFrom: number | null;
  currency: string | null;
  status: string;
  importSlug: string | null;
  heroImage: string | null;
  mediaCount: number;
  qualityFlags: TravelLibraryQualityFlags;
  styles: string[];
  createdAt: string;
  updatedAt: string;
};

export type TravelLibraryListPayload = {
  metrics: TravelLibraryMetrics;
  items: TravelLibraryItem[];
  page: number;
  pageSize: number;
  total: number;
};
