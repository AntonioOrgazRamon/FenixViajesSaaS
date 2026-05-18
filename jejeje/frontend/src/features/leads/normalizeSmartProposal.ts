import type {
  SmartProposalAnalysis,
  SmartProposalState,
  SmartProposalTier,
  SmartProposalTripVm,
} from '../../types/domain';

const DEFAULT_TIER: SmartProposalTier = 'recommended';

function normalizeTrip(raw: unknown): SmartProposalTripVm {
  const t = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const tierRaw = t.tier;
  const tier: SmartProposalTier =
    tierRaw === 'economic' || tierRaw === 'premium' || tierRaw === 'recommended' ? tierRaw : DEFAULT_TIER;
  return {
    id: typeof t.id === 'string' ? t.id : '',
    tier,
    title: typeof t.title === 'string' ? t.title : 'Viaje',
    mainDestination: typeof t.mainDestination === 'string' ? t.mainDestination : null,
    durationDays: typeof t.durationDays === 'number' && !Number.isNaN(t.durationDays) ? t.durationDays : null,
    indicativePrice:
      typeof t.indicativePrice === 'number' && !Number.isNaN(t.indicativePrice) ? t.indicativePrice : null,
    currency: typeof t.currency === 'string' ? t.currency : null,
    matchScore: typeof t.matchScore === 'number' && !Number.isNaN(t.matchScore) ? t.matchScore : 0,
    highlights: Array.isArray(t.highlights)
      ? t.highlights.filter((h): h is string => typeof h === 'string')
      : [],
  };
}

export function normalizeSmartAnalysis(raw: unknown): SmartProposalAnalysis {
  const a = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const intentionRaw =
    a.intention && typeof a.intention === 'object' && !Array.isArray(a.intention)
      ? (a.intention as Record<string, unknown>)
      : {};
  const conf =
    typeof intentionRaw.confidence === 'number' && !Number.isNaN(intentionRaw.confidence)
      ? intentionRaw.confidence
      : 0;
  return {
    intention: {
      summary:
        typeof intentionRaw.summary === 'string' && intentionRaw.summary.trim()
          ? intentionRaw.summary
          : 'Sin resumen de intención (datos incompletos en servidor).',
      confidence: conf,
      signals: Array.isArray(intentionRaw.signals)
        ? intentionRaw.signals.filter((s): s is string => typeof s === 'string')
        : [],
    },
    missingData: Array.isArray(a.missingData)
      ? a.missingData.filter((x): x is string => typeof x === 'string')
      : [],
    overallScore:
      typeof a.overallScore === 'number' && !Number.isNaN(a.overallScore) ? a.overallScore : 0,
    matches: Array.isArray(a.matches) ? a.matches.filter((x): x is string => typeof x === 'string') : [],
    misses: Array.isArray(a.misses) ? a.misses.filter((x): x is string => typeof x === 'string') : [],
    talkTrack: typeof a.talkTrack === 'string' ? a.talkTrack : '',
    recommendedTrips: Array.isArray(a.recommendedTrips) ? a.recommendedTrips.map(normalizeTrip) : [],
  };
}

/** Evita crashes si `intentSnapshot` u otras piezas llegan parciales desde la API. */
export function normalizeSmartProposalState(raw: unknown): SmartProposalState {
  const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const phase = s.phase === 'ready' || s.phase === 'error' || s.phase === 'none' ? s.phase : 'none';
  return {
    phase,
    proposalId: typeof s.proposalId === 'string' ? s.proposalId : null,
    proposalStatus: typeof s.proposalStatus === 'string' ? s.proposalStatus : null,
    versionNumber: typeof s.versionNumber === 'number' && !Number.isNaN(s.versionNumber) ? s.versionNumber : null,
    updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : null,
    vendorNotified: !!s.vendorNotified,
    vendorNotifiedAt: typeof s.vendorNotifiedAt === 'string' ? s.vendorNotifiedAt : null,
    lastError: typeof s.lastError === 'string' ? s.lastError : null,
    analysis: normalizeSmartAnalysis(s.analysis),
    htmlAvailable: !!s.htmlAvailable,
    pdfAvailable: !!s.pdfAvailable,
  };
}
