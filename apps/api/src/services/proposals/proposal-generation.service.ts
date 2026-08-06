import type { Lead, LeadTravelProfile, TravelTrip } from '@prisma/client';
import {
  type TravelSearchIntent,
  type TravelSearchResponse,
  type TravelSearchResultItem,
  TRAVEL_SEARCH_SCHEMA_VERSION,
  criteriaAppliedFromIntent,
  intentEffectiveBudgetPerPerson,
} from '../travel/travel-search.schema';
import {
  TravelSearchService,
  mapTripRowDbToSearchRow,
  travelSearchTripSelect,
} from '../travel/travel-search.service';
import { runTravelRecommendation } from '../recommendation/pipeline';
import { reorderWithDiversity } from '../recommendation/diversity.engine';
import { pickCommercialSlots } from '../recommendation/slots.engine';
import { COMMERCIAL_SCORE_TOLERANCE } from '../recommendation/constants';
import { buildTravelSearchIntentFromSnapshots } from '../travel/proposal-intent.mapper';
import type { ProposalTripInput } from '../../modules/proposals/proposal.schema';
import type { TripCardVm, ProposalHtmlViewModel, ProposalConfidenceSection } from './proposal-html-template';
import { renderTravelProposalHtml } from './proposal-html-template';
import { generateProposalCommercialCopy } from './proposal-copy-ai.service';
import { htmlToPdfBuffer } from './proposal-pdf.service';
import prisma from '../../infrastructure/db';
import { ValidationError } from '../../common/errors/AppError';
import { logger } from '../../common/logger';
import {
  finalizeProposalVersionGeneration,
  type FinalizeProposalVersionParams,
} from './proposal-version-finalize.service';
import { attachPremiumUxToResponse } from '../recommendation/recommendation-premium-ux';
import { getPrimaryHeroImageByTripIds } from '../travel/media/travel-media-resolve';
import { tripTypeCustomerLabel } from '../travel/lead-travel-profile.mapper';

export type CompanyProposalBranding = {
  name: string;
  slug?: string;
};

function reasonsFromJson(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean);
  }
  if (typeof v === 'string') return [v.trim()].filter(Boolean);
  return [];
}

function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const cur = currency?.trim() || 'EUR';
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toFixed(0)} ${cur}`;
  }
}

/**
 * Una sola ejecución del pipeline por generación: catálogo implícito → `TravelSearchService.searchByIntent`
 * (un `runTravelRecommendation`); viajes explícitos en body → un `runTravelRecommendation` con esas filas.
 * El HTML/PDF reutilizan esa misma respuesta; no hay segunda pasada de recomendación en este servicio.
 */
async function resolveSearch(
  companyId: string,
  intent: TravelSearchIntent,
  explicitTrips: ProposalTripInput[] | undefined,
  persist?: { leadId: string; userId?: string },
): Promise<TravelSearchResponse> {
  const travelSearch = new TravelSearchService();

  if (!explicitTrips?.length) {
    return travelSearch.searchByIntent(companyId, intent, {
      persistRecommendation: persist,
    });
  }

  const ids = explicitTrips.map((t) => t.travelTripId);
  const trips = await prisma.travelTrip.findMany({
    where: { id: { in: ids }, companyId, status: 'APPROVED' },
    select: travelSearchTripSelect,
  });
  if (trips.length !== ids.length) {
    throw new ValidationError(
      'Todos los viajes deben existir, estar aprobados y pertenecer a la empresa',
    );
  }

  const tripById = new Map(trips.map((t) => [t.id, t]));
  const rows = ids.map((id) => mapTripRowDbToSearchRow(tripById.get(id)!));

  const company = await prisma.company.findFirst({
    where: { id: companyId },
    select: { recommendationPolicy: true },
  });

  const { response } = await runTravelRecommendation({
    companyId,
    intent,
    rows,
    options: {
      companyPolicyJson: company?.recommendationPolicy ?? undefined,
      persist,
    },
  });

  let rankingTouched = false;
  for (const input of explicitTrips) {
    const item = response.ranked.find((i) => i.tripId === input.travelTripId);
    if (!item) continue;
    if (input.score != null && input.score >= 0) {
      item.score = Math.min(100, input.score);
      rankingTouched = true;
    }
    const extra = reasonsFromJson(input.reasons);
    if (extra.length) {
      item.reasons = [...item.reasons, ...extra.map((r) => `Entrada manual: ${r}`)].slice(0, 18);
    }
  }

  if (rankingTouched) {
    response.ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.tripId.localeCompare(b.tripId);
    });
    const rowsById = new Map(rows.map((r) => [r.id, r]));
    response.ranked = reorderWithDiversity(rowsById, response.ranked);
    response.picks = pickCommercialSlots(response.ranked, rowsById, COMMERCIAL_SCORE_TOLERANCE, intent);
  }

  return attachPremiumUxToResponse(intent, {
    ...response,
    schemaVersion: TRAVEL_SEARCH_SCHEMA_VERSION,
    criteriaApplied: criteriaAppliedFromIntent(intent),
    totalCandidates: trips.length,
  });
}

function matchStateCustomerLabel(ms: TravelSearchResultItem['matchState']): string {
  switch (ms) {
    case 'STRONG_MATCH':
      return 'Encaje alto';
    case 'WEAK_MATCH':
      return 'Encaje moderado';
    case 'NO_MATCH':
      return 'Encaje limitado';
    case 'NEEDS_CLARIFICATION':
      return 'Requiere aclaraciones';
    default:
      return ms;
  }
}

function buildTripWhyFitLines(scored: TravelSearchResultItem | null | undefined): string[] {
  if (!scored) return [];
  const fromContrib = scored.contributions
    .filter(
      (c) =>
        c.weight > 0 &&
        c.contribution >= c.weight * 0.45 &&
        c.factor !== 'dossier_completeness',
    )
    .map((c) => c.explanationCustomer.trim())
    .filter(Boolean);
  const merged = [...scored.matches.map((m) => m.trim()).filter(Boolean), ...fromContrib];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of merged) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
    if (out.length >= 6) break;
  }
  return out;
}

function proposalConfidenceSectionsFromPremium(pux: TravelSearchResponse['premiumUx']): ProposalConfidenceSection[] {
  const cp = pux.confidencePanel;
  return [
    { headline: cp.matchQualityHeadline, text: cp.matchQualityBody },
    { headline: cp.catalogCoverageHeadline, text: cp.catalogCoverageBody },
    { headline: cp.confidenceHeadline, text: cp.confidenceBody },
  ];
}

function tripCardVm(
  label: string,
  badgeClass: string,
  scored: TravelSearchResultItem | null | undefined,
  trip: Pick<
    TravelTrip,
    'title' | 'mainDestination' | 'durationDays' | 'indicativePrice' | 'currency' | 'season' | 'description'
  > & {
    highlights: { text: string }[];
  },
  heroImageUrl?: string | null,
): TripCardVm {
  const priceNum = trip.indicativePrice != null ? Number(trip.indicativePrice) : null;
  const priceLine = formatMoney(priceNum, trip.currency);

  const highlights = trip.highlights.map((h) => h.text.trim()).filter(Boolean).slice(0, 5);

  const confPct =
    scored?.confidence != null ? `${Math.round(scored.confidence * 100)}%` : 'n/d';
  const adjustmentNote =
    scored?.rawScore != null && scored.rawScore !== scored.score
      ? ' Ajuste aplicado por cobertura parcial de criterios.'
      : '';
  const scoreLine = scored
    ? `${matchStateCustomerLabel(scored.matchState)} · confianza ${confPct}.${adjustmentNote}`
    : null;

  const whyFitLines = buildTripWhyFitLines(scored);

  const subtitleParts = [trip.season?.trim(), trip.description?.trim()?.slice(0, 160)].filter(Boolean);

  const matches = scored?.matches?.length ? [...scored.matches] : [];
  const misses = scored?.misses?.length ? [...scored.misses] : [];
  let commercialPitch =
    scored?.commercialAngle?.trim() ||
    'Revisar encaje con la intención del cliente usando el scoring y el dossier del viaje en catálogo.';
  if (scored?.matchState === 'NO_MATCH') {
    commercialPitch = `${commercialPitch} Encaje débil frente a los criterios: validar expectativas antes de prometer ajuste total.`;
  }

  const hero =
    heroImageUrl && heroImageUrl.startsWith('https://') ? heroImageUrl : null;
  const heroAlt = trip.mainDestination ? `${trip.title} — ${trip.mainDestination}` : trip.title;

  return {
    label,
    badgeClass,
    title: trip.title,
    subtitle: subtitleParts.length ? subtitleParts.join(' · ') : null,
    destination: trip.mainDestination,
    durationDays: trip.durationDays,
    priceLine,
    highlights: highlights.length
      ? highlights
      : ['Consultar condiciones y servicios incluidos en el dossier del viaje.'],
    scoreLine,
    whyFitLines,
    commercialPitch,
    matches,
    misses,
    heroImageUrl: hero,
    heroImageAlt: heroAlt,
  };
}

function aggregateAlignment(picks: TravelSearchResponse['picks']): { matches: string[]; gaps: string[] } {
  const items = [picks.recommended, picks.budget, picks.luxury, picks.alternative].filter(
    Boolean,
  ) as TravelSearchResultItem[];
  const matches = new Set<string>();
  const gaps = new Set<string>();
  for (const it of items) {
    it.matches.forEach((m) => matches.add(m));
    it.misses.forEach((m) => gaps.add(m));
  }
  return {
    matches: [...matches].slice(0, 12),
    gaps: [...gaps].slice(0, 12),
  };
}

function buildLimitationLines(search: TravelSearchResponse): string[] {
  const fromVal = search.validationIssues
    .filter((i) => i.severity === 'WARN' || i.severity === 'CLARIFICATION')
    .map((i) => (i.messageCustomer ?? i.message).trim())
    .filter(Boolean);
  const hints = search.fallbackHints.map((h) => h.trim()).filter(Boolean);
  return [...new Set([...fromVal, ...hints])].slice(0, 14);
}

function deriveCommercialIntroForMatchState(search: TravelSearchResponse): string {
  switch (search.matchState) {
    case 'STRONG_MATCH':
      return 'Estas opciones encajan muy bien con lo que busca el cliente.';
    case 'WEAK_MATCH':
      return 'Hemos encontrado opciones parcialmente alineadas, aunque algunos criterios podrían requerir ajustes.';
    case 'NO_MATCH':
      return 'No hemos encontrado circuitos que encajen claramente con todos los criterios solicitados. Las opciones mostradas son las más cercanas dentro del catálogo actual.';
    case 'NEEDS_CLARIFICATION':
      return 'La intención necesita aclaraciones antes de comprometer encaje. Las referencias de catálogo sirven como punto de partida, no como promesa de cumplimiento total de criterios.';
    default:
      return '';
  }
}

function deriveOptionsSectionCopy(
  search: TravelSearchResponse,
  optionCount: number,
): { title: string; intro: string } {
  const n = optionCount;
  if (search.matchState === 'NO_MATCH' || search.matchState === 'NEEDS_CLARIFICATION') {
    return {
      title: 'Referencias de catálogo (transparencia)',
      intro:
        n <= 1
          ? 'Mostramos solo la mejor aproximación disponible para no simular un catálogo amplio que encaje donde no hay encaje claro.'
          : `Con encaje global débil mostramos solo ${n} referencias como máximo; cada tarjeta incluye score, confianza y brechas explícitas.`,
    };
  }
  if (search.matchState === 'WEAK_MATCH') {
    return {
      title: 'Opciones presentadas',
      intro:
        'Cuatro perfiles del catálogo (recomendada, presupuesto, premium y alternativa) con scoring determinista. Contraste la confianza global con la de cada tarjeta antes del mensaje comercial.',
    };
  }
  return {
    title: 'Opciones presentadas',
    intro:
      'Cuatro perfiles del catálogo oficial (recomendada, presupuesto, premium y alternativa). Cada tarjeta resume scoring, confianza, coincidencias y brechas frente a la intención.',
  };
}

function buildProposalOptionCards(
  search: TravelSearchResponse,
  rec: TravelSearchResultItem,
  budget: TravelSearchResultItem,
  luxury: TravelSearchResultItem,
  alternative: TravelSearchResultItem,
  getTrip: (id: string) => Pick<
    TravelTrip,
    'title' | 'mainDestination' | 'durationDays' | 'indicativePrice' | 'currency' | 'season' | 'description'
  > & { highlights: { text: string }[] },
  heroes: Map<string, string>,
): TripCardVm[] {
  const limit =
    search.matchState === 'NO_MATCH' || search.matchState === 'NEEDS_CLARIFICATION';

  const cards: TripCardVm[] = [
    tripCardVm(
      limit ? 'Mejor aproximación en catálogo' : 'Opción recomendada',
      'badge-rec',
      rec,
      getTrip(rec.tripId),
      heroes.get(rec.tripId) ?? null,
    ),
  ];

  if (!limit) {
    return [
      ...cards,
      tripCardVm('Perfil ajustado al presupuesto', 'badge-eco', budget, getTrip(budget.tripId), heroes.get(budget.tripId) ?? null),
      tripCardVm('Perfil premium / alta gama', 'badge-prem', luxury, getTrip(luxury.tripId), heroes.get(luxury.tripId) ?? null),
      tripCardVm(
        'Alternativa complementaria',
        'badge-alt',
        alternative,
        getTrip(alternative.tripId),
        heroes.get(alternative.tripId) ?? null,
      ),
    ];
  }

  const threshold = Math.max(30, rec.score - 15);
  for (const x of [budget, luxury, alternative]) {
    if (x.tripId === rec.tripId) continue;
    if (x.score >= threshold) {
      cards.push(
        tripCardVm('Referencia adicional (encaje limitado)', 'badge-alt', x, getTrip(x.tripId), heroes.get(x.tripId) ?? null),
      );
      break;
    }
  }
  return cards;
}

function buildKeyClientTravelLines(
  profile: LeadTravelProfile | null | undefined,
  intent: TravelSearchIntent,
): string[] {
  const lines: string[] = [];
  const dest =
    profile?.destinationText?.trim() ||
    (Array.isArray(profile?.preferredDestinations)
      ? (profile!.preferredDestinations as unknown[]).filter((x): x is string => typeof x === 'string').join(' / ')
      : '') ||
    intent.destination?.trim();
  if (dest) lines.push(`Destino: ${dest}`);

  const act = profile?.activitiesText?.trim();
  if (act) lines.push(`Intereses / actividades: ${act.slice(0, 300)}${act.length > 300 ? '…' : ''}`);
  else if (intent.preferences?.length)
    lines.push(`Intereses / preferencias: ${intent.preferences.slice(0, 4).join('; ')}`);

  const dateBits = [
    profile?.travelDateText?.trim(),
    profile?.travelDateFrom ? profile.travelDateFrom.toISOString().slice(0, 10) : null,
    profile?.travelDateTo ? profile.travelDateTo.toISOString().slice(0, 10) : null,
    intent.approximateStartDate?.trim(),
  ].filter(Boolean);
  if (dateBits.length) lines.push(`Fecha / periodo: ${[...new Set(dateBits as string[])].join(' · ')}`);
  if (profile?.flexibleDates) lines.push('Fechas flexibles: sí');

  const cur = profile?.budgetCurrency?.trim() || 'EUR';
  if (profile?.budgetAmount != null && profile.budgetType && profile.budgetType !== 'UNKNOWN') {
    const amt = formatMoney(Number(profile.budgetAmount), cur);
    if (amt) {
      const scope =
        profile.budgetType === 'PER_PERSON' ? 'por persona' : profile.budgetType === 'TOTAL' ? 'total del viaje' : '';
      lines.push(`Presupuesto: ${amt}${scope ? ` (${scope})` : ''}`);
    }
  } else {
    const eff = intentEffectiveBudgetPerPerson(intent);
    const ib = formatMoney(eff ?? null, cur);
    if (ib) lines.push(`Presupuesto orientativo: ${ib}`);
  }

  const tripLabel =
    profile?.tripType && profile.tripType !== 'UNKNOWN' ? tripTypeCustomerLabel(profile.tripType) : null;
  if (tripLabel) lines.push(`Tipo de viaje: ${tripLabel}`);
  else if (intent.travelType?.trim()) lines.push(`Tipo de viaje: ${intent.travelType.trim()}`);

  const dep =
    [profile?.departureAirportText?.trim(), profile?.departureAirportCode?.trim()].filter(Boolean).join(' · ') ||
    intent.departureAirport?.trim();
  if (dep) lines.push(`Aeropuerto / salida: ${dep}`);

  const dur = profile?.durationDays ?? intent.durationDays;
  if (dur != null && dur >= 1) lines.push(`Duración orientativa: ${dur} días`);

  return lines;
}

export type GenerationPayload = {
  lead: Lead & { travelProfile?: LeadTravelProfile | null };
  company: CompanyProposalBranding;
  intentSnapshots: unknown[];
  explicitTrips?: ProposalTripInput[];
  useAiCopy: boolean;
  /** Usuario que dispara la generación (auditoría de runs de recomendación). */
  recommendationPersistUserId?: string;
};

export class ProposalGenerationService {
  async generate(payload: GenerationPayload): Promise<{
    html: string;
    pdfBuffer: Buffer | null;
    intent: TravelSearchIntent;
    search: TravelSearchResponse;
    viewModel: ProposalHtmlViewModel;
  }> {
    const companyId = payload.lead.companyId;
    const intent = buildTravelSearchIntentFromSnapshots(payload.intentSnapshots);

    const search = await resolveSearch(companyId, intent, payload.explicitTrips, {
      leadId: payload.lead.id,
      userId: payload.recommendationPersistUserId,
    });

    const rec = search.picks.recommended;
    if (!rec) {
      throw new ValidationError(
        'No hay viajes aprobados en catálogo para generar la propuesta. Importe o apruebe circuitos antes de continuar.',
      );
    }

    const budget = search.picks.budget ?? rec;
    const luxury = search.picks.luxury ?? rec;
    const alternative = search.picks.alternative ?? budget;

    const tripIds = [...new Set([rec.tripId, budget.tripId, luxury.tripId, alternative.tripId])];

    const tripsDb = await prisma.travelTrip.findMany({
      where: { id: { in: tripIds }, companyId },
      include: {
        highlights: { orderBy: { orderIndex: 'asc' }, take: 8 },
      },
    });

    const tripMap = new Map(tripsDb.map((t) => [t.id, t]));
    const getTrip = (id: string) => {
      const t = tripMap.get(id);
      if (!t) throw new ValidationError('Viaje de propuesta no encontrado tras generación');
      return t;
    };

    const heroes = await getPrimaryHeroImageByTripIds(companyId, tripIds);

    const lead = payload.lead;
    const clientLines = [
      lead.fullName || [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Cliente sin nombre',
      lead.email ? `Email: ${lead.email}` : null,
      lead.phone ? `Teléfono: ${lead.phone}` : null,
      lead.country ? `País: ${lead.country}` : null,
      lead.companyName ? `Organización: ${lead.companyName}` : null,
    ].filter((x): x is string => Boolean(x));

    const intentLines: string[] = [];
    if (intent.destination) intentLines.push(`Destino deseado: ${intent.destination}`);
    if (intent.durationDays) intentLines.push(`Duración orientativa: ${intent.durationDays} días`);
    if (intent.budgetPerPerson) {
      intentLines.push(
        `Presupuesto orientativo por persona: ${intent.budgetPerPerson} (moneda según catálogo)`,
      );
    }
    if (intent.totalBudget) {
      intentLines.push(
        `Presupuesto total orientativo: ${intent.totalBudget} (comparar con precios publicados en catálogo)`,
      );
    }
    if (intent.approximateStartDate) intentLines.push(`Fecha / mes deseado: ${intent.approximateStartDate}`);
    if (intent.travelers) intentLines.push(`Viajeros: ${intent.travelers}`);
    if (intent.travelType) intentLines.push(`Tipo de viaje: ${intent.travelType}`);
    if (intent.departureAirport) intentLines.push(`Salida / aeropuerto: ${intent.departureAirport}`);
    if (intent.tags?.length) intentLines.push(`Etiquetas: ${intent.tags.join(', ')}`);
    if (intent.preferences?.length) intentLines.push(`Preferencias: ${intent.preferences.join('; ')}`);
    if (!intentLines.length) {
      intentLines.push('Sin criterios estructurados en CRM; se usó el catálogo completo para rankear.');
    }

    const keyClientDataLines = buildKeyClientTravelLines(lead.travelProfile ?? null, intent);

    const align = aggregateAlignment(search.picks);

    const honestyIntro = deriveCommercialIntroForMatchState(search);
    let commercialIntro: string | null = honestyIntro;

    let deterministicReasons = [
      ...search.premiumUx.whyRecommendedBullets,
      ...search.premiumUx.topStrengths.slice(0, 5),
      `Mensaje comercial sugerido (prioritaria): ${rec.commercialAngle}`,
    ].slice(0, 14);

    let recommendationBullets = deterministicReasons.slice(0, 8);

    let nextStep =
      'Contrastar con el cliente las brechas listadas en cada tarjeta (presupuesto, duración, destino). Registrar acuerdos en el CRM y solicitar disponibilidad formal antes de cotización cerrada.';

    if (search.fallbackHints.length) {
      recommendationBullets = [...search.fallbackHints.slice(0, 4), ...recommendationBullets].slice(0, 10);
    }

    const proposalOptions = buildProposalOptionCards(search, rec, budget, luxury, alternative, getTrip, heroes);
    const optionsCopy = deriveOptionsSectionCopy(search, proposalOptions.length);

    const skipAiIntro = search.matchState === 'NO_MATCH' || search.matchState === 'NEEDS_CLARIFICATION';

    if (payload.useAiCopy && !skipAiIntro) {
      try {
        const ai = await generateProposalCommercialCopy({
          companyId: payload.lead.companyId,
          userId: payload.recommendationPersistUserId,
          leadId: payload.lead.id,
          companyName: payload.company.name,
          clientSummary: clientLines.join(' · '),
          intentSummary: intentLines.join(' · '),
          tripTitles: {
            recommended: getTrip(rec.tripId).title,
            budget: getTrip(budget.tripId).title,
            luxury: getTrip(luxury.tripId).title,
            alternative: getTrip(alternative.tripId).title,
          },
          deterministicReasons,
          alignmentMatches: align.matches,
          alignmentGaps: align.gaps,
        });
        if (ai) {
          commercialIntro = ai.commercialIntro;
          recommendationBullets = ai.recommendationBullets.length ? ai.recommendationBullets : recommendationBullets;
          nextStep = ai.nextStep;
        }
      } catch (e) {
        logger.warn({ err: e }, 'IA de copy comercial no disponible; se usa texto determinístico');
      }
    }

    const companyMetaLines = [
      ...(payload.company.slug?.trim() ? [`Identificador de empresa: ${payload.company.slug.trim()}`] : []),
    ];

    const limitationLines = buildLimitationLines(search);
    const considerationLines = [...new Set([...search.premiumUx.mainTradeoffs, ...limitationLines])].slice(0, 20);

    const pux = search.premiumUx;
    const cp = pux.confidencePanel;

    const docHeroUrl = heroes.get(rec.tripId) ?? null;
    const primaryTrip = getTrip(rec.tripId);
    const docHeroAlt = primaryTrip.mainDestination
      ? `${primaryTrip.title} — ${primaryTrip.mainDestination}`
      : primaryTrip.title;

    const viewModel: ProposalHtmlViewModel = {
      title: `Propuesta de viaje — ${payload.company.name}`,
      generatedAtLabel: `Generado el ${new Date().toLocaleString('es-ES', {
        dateStyle: 'long',
        timeStyle: 'short',
      })}`,
      companyName: payload.company.name,
      companyMetaLines,
      documentHeroImageUrl: docHeroUrl?.startsWith('https://') ? docHeroUrl : null,
      documentHeroAlt: docHeroAlt,
      clientTitle: 'Datos del cliente',
      clientLines,
      keyClientDataTitle: keyClientDataLines.length ? 'Datos clave del viaje (negocio)' : '',
      keyClientDataLines,
      intentTitle: 'Entendimiento del cliente',
      intentLines,
      executiveSummaryTitle: 'Resumen ejecutivo',
      executiveSummaryBody: pux.humanReadableReasoning,
      whyRecommendedTitle: 'Por qué recomendamos esta dirección',
      whyRecommendedLines: pux.whyRecommendedBullets,
      confidenceStripTitle: 'Confianza del matching',
      confidenceSections: proposalConfidenceSectionsFromPremium(pux),
      informationGapsTitle: 'Información faltante o débil',
      informationGapsLines: cp.missingInformation,
      riskLine: cp.partialRecommendationRisk,
      valueAnchorTitle: 'Qué creemos que más valor aporta',
      valueAnchorLines: pux.topStrengths.length ? pux.topStrengths : ['Refinar con el cliente sobre prioridades (presupuesto, ritmo, estilo).'],
      geoContextLine: pux.geoContextLine,
      similarAlternativesTitle: 'Alternativas similares',
      similarAlternativesBody: pux.similarAlternativesSummary,
      considerationsTitle: 'Aspectos a tener en cuenta',
      considerationLines,
      commercialIntro,
      optionsSectionTitle: optionsCopy.title,
      optionsIntro: optionsCopy.intro,
      proposalOptions,
      reasonsTitle: 'Notas para el equipo comercial',
      reasons: recommendationBullets,
      nextStepTitle: 'Siguiente paso para el vendedor',
      nextStepBody: nextStep,
      footerNote:
        'Documento generado automáticamente. Precios y disponibilidad son orientativos hasta confirmación con proveedores. Las condiciones contractuales definitivas se formalizarán en la reserva. La notificación por correo al equipo puede completarse en segundo plano.',
    };

    const html = renderTravelProposalHtml(viewModel);

    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await htmlToPdfBuffer(html);
    } catch {
      pdfBuffer = null;
    }

    return { html, pdfBuffer, intent, search, viewModel };
  }

  /**
   * Tras persistir `Proposal` + `ProposalVersion` en BD: notificación a vendedores y estado `SENT_TO_SELLER`.
   */
  finalizeAndNotifySellers(params: FinalizeProposalVersionParams) {
    return finalizeProposalVersionGeneration(params);
  }
}
