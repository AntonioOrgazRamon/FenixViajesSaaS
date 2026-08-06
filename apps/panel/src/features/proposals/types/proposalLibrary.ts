/** Contratos UI ↔ GET /proposals/library (+ detail). */
export type ProposalLibraryMetrics = {
  total: number;
  draft: number;
  generated: number;
  sentToSeller: number;
  sentToClient: number;
  archived: number;
  leadConverted: number;
  leadLost: number;
  withPdf: number;
  withHtml: number;
  withImagesHint: number;
  estimatedValueSum: number | null;
};

export type ProposalLibraryItem = {
  id: string;
  leadId: string;
  leadName: string | null;
  leadEmail: string | null;
  leadPhone: string | null;
  leadStatus: string;
  title: string;
  status: string;
  version: number;
  estimatedValue: number | null;
  matchState: string | null;
  confidence: number | null;
  destination: string | null;
  tripCount: number;
  hasPdf: boolean;
  hasHtml: boolean;
  hasMedia: boolean;
  createdAt: string;
  generatedAt: string | null;
  sentAt: string | null;
};

export type ProposalLibraryListPayload = {
  metrics: ProposalLibraryMetrics;
  items: ProposalLibraryItem[];
  page: number;
  pageSize: number;
  total: number;
};

export type ProposalLibraryDetailTrip = {
  id: string;
  title: string | null;
  mainDestination: string | null;
  durationDays: number | null;
  indicativePrice: string | null;
  currency: string | null;
  status: string;
  score: number | null;
  reasons: unknown;
};

export type ProposalLibraryDetailPayload = {
  proposal: {
    id: string;
    companyId: string;
    leadId: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  lead: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    country: string | null;
    details: unknown;
  };
  latestVersion: {
    id: string;
    versionNumber: number;
    createdAt: string;
    pdfStoragePath: string | null;
    pdfPublicUrl: string | null;
    generatedHtml: string | null;
    intentSnapshot: unknown;
    matchState: string | null;
    confidence: number | null;
    destination: string | null;
    trips: ProposalLibraryDetailTrip[];
    artifacts: unknown[];
  } | null;
  versionHistory: Array<{
    id: string;
    versionNumber: number;
    createdAt: string;
    hasPdf: boolean;
    hasHtml: boolean;
  }>;
  activities: Array<{
    id: string;
    activityType: string;
    title: string;
    description: string | null;
    metadata: unknown;
    createdAt: string;
    actorUserId: string | null;
  }>;
};
