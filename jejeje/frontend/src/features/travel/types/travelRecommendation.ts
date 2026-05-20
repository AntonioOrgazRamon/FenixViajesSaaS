/** Contrato alineado con backend `travel-search.schema.ts` (2.3.0). Solo tipos de lectura para UI. */

export type RecommendationMatchState = 'STRONG_MATCH' | 'WEAK_MATCH' | 'NO_MATCH' | 'NEEDS_CLARIFICATION';

export type TravelStyleAxis =
  | 'CULTURE'
  | 'BEACH'
  | 'NATURE'
  | 'ADVENTURE'
  | 'GASTRONOMY'
  | 'WELLNESS'
  | 'NIGHTLIFE'
  | 'CITY_BREAK'
  | 'CRUISE'
  | 'SAFARI'
  | 'SKI'
  | 'ROAD_TRIP'
  | 'SHOPPING'
  | 'FAMILY'
  | 'HONEYMOON'
  | 'SENIOR_FRIENDLY'
  | 'ACCESSIBILITY'
  | 'WILDLIFE'
  | 'PHOTOGRAPHY';

export type ScoreContribution = {
  factor: string;
  raw: number;
  weight: number;
  contribution: number;
  explanation: string;
  explanationCustomer: string;
  explanationSeller: string;
};

export type TravelSearchResultItem = {
  tripId: string;
  score: number;
  rawScore?: number;
  matchState: RecommendationMatchState;
  confidence: number | null;
  matchCoverageDimensions?: number;
  intentSignalBreadth?: number;
  contributions: ScoreContribution[];
  matches: string[];
  misses: string[];
  reasons: string[];
  commercialAngle: string;
  relaxedAlternative?: boolean;
};

export type TravelPremiumConfidencePanel = {
  matchQualityHeadline: string;
  matchQualityBody: string;
  catalogCoverageHeadline: string;
  catalogCoverageBody: string;
  confidenceHeadline: string;
  confidenceBody: string;
  missingInformation: string[];
  partialRecommendationRisk: string;
};

export type TravelPremiumUx = {
  humanReadableReasoning: string;
  whyRecommendedBullets: string[];
  topStrengths: string[];
  mainTradeoffs: string[];
  /** Cuando un slot refleja un destino citado por el cliente (motor determinista). */
  commercialPreferenceNotes?: string[];
  geoContextLine: string | null;
  confidencePanel: TravelPremiumConfidencePanel;
  similarAlternativesSummary: string;
};

export type TravelTrustSummary = {
  intentSignalBreadth: number;
  intentCompleteness: number;
  catalogTripCount: number;
  catalogEligibleRatio: number;
  topMatchCoverageDimensions: number | null;
  topRawScoreIfAdjusted: number | null;
};

export type ValidationIssue = {
  code: string;
  severity: 'INFO' | 'WARN' | 'CLARIFICATION' | 'BLOCK';
  message: string;
  messageCustomer?: string;
};

export type TravelSearchResponse = {
  schemaVersion: string;
  matchState: RecommendationMatchState;
  globalConfidence: number | null;
  trustSummary: TravelTrustSummary;
  premiumUx: TravelPremiumUx;
  validationIssues: ValidationIssue[];
  fallbackHints: string[];
  relaxedAlternatives: boolean;
  ranked: TravelSearchResultItem[];
  totalCandidates: number;
  scoringModelVersion: string;
  debug?: {
    telemetry?: Record<string, unknown>;
    rejectedSample?: { tripId: string; reasons: string[] }[];
  };
};

export type TravelSearchIntentForm = {
  destination: string;
  durationDays: string;
  budgetPerPerson: string;
  month: string;
  approximateStartDate: string;
  travelers: string;
  travelType: string;
  preferences: string;
  travelStyleAxes: TravelStyleAxis[];
};
