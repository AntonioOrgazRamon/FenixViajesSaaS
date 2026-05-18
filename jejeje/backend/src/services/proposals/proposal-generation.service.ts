import type { Lead, TravelTrip } from '@prisma/client';
import {
  type TravelSearchIntent,
  type TravelSearchResponse,
  type TravelSearchResultItem,
  TRAVEL_SEARCH_SCHEMA_VERSION,
  criteriaAppliedFromIntent,
} from '../travel/travel-search.schema';
import {
  TravelSearchService,
  mapTripRowDbToSearchRow,
  travelSearchTripSelect,
} from '../travel/travel-search.service';
import { runTravelRecommendation } from '../recommendation/pipeline';
import { reorderWithDiversity } from '../recommendation/diversity.engine';
import { pickCommercialSlots } from '../recommendation/slots.engine';
import { buildTravelSearchIntentFromSnapshots } from '../travel/proposal-intent.mapper';
import type { ProposalTripInput } from '../../modules/proposals/proposal.schema';
import type { TripCardVm, ProposalHtmlViewModel } from './proposal-html-template';
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
    response.picks = pickCommercialSlots(response.ranked, rowsById);
  }

  return {
    ...response,
    schemaVersion: TRAVEL_SEARCH_SCHEMA_VERSION,
    criteriaApplied: criteriaAppliedFromIntent(intent),
    totalCandidates: trips.length,
  };
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
): TripCardVm {
  const priceNum = trip.indicativePrice != null ? Number(trip.indicativePrice) : null;
  const priceLine = formatMoney(priceNum, trip.currency);

  const highlights = trip.highlights.map((h) => h.text.trim()).filter(Boolean).slice(0, 5);

  const contribHint = scored?.contributions
    ?.slice(0, 2)
    .map((c) => `${c.factor} ${c.raw}/${c.weight}`)
    .join(' · ');
  const scoreLine = scored
    ? `${scored.score}/100 · ${scored.matchState}${contribHint ? ` · ${contribHint}` : ''} · ${scored.reasons.slice(0, 2).join(' · ')}`
    : null;

  const subtitleParts = [trip.season?.trim(), trip.description?.trim()?.slice(0, 160)].filter(Boolean);

  const matches = scored?.matches?.length ? [...scored.matches] : [];
  const misses = scored?.misses?.length ? [...scored.misses] : [];
  const commercialPitch =
    scored?.commercialAngle?.trim() ||
    'Revisar encaje con la intención del cliente usando el scoring y el dossier del viaje en catálogo.';

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
    commercialPitch,
    matches,
    misses,
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

export type GenerationPayload = {
  lead: Lead;
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
    if (intent.approximateStartDate) intentLines.push(`Fecha / mes deseado: ${intent.approximateStartDate}`);
    if (intent.travelers) intentLines.push(`Viajeros: ${intent.travelers}`);
    if (intent.travelType) intentLines.push(`Tipo de viaje: ${intent.travelType}`);
    if (intent.tags?.length) intentLines.push(`Etiquetas: ${intent.tags.join(', ')}`);
    if (intent.preferences?.length) intentLines.push(`Preferencias: ${intent.preferences.join('; ')}`);
    if (!intentLines.length) {
      intentLines.push('Sin criterios estructurados en CRM; se usó el catálogo completo para rankear.');
    }

    const align = aggregateAlignment(search.picks);

    let deterministicReasons = [
      ...rec.reasons,
      `Ángulo comercial (recomendada): ${rec.commercialAngle}`,
      ...(budget.tripId !== rec.tripId
        ? [`Perfil presupuesto (${budget.score}/100): ${budget.commercialAngle}`]
        : []),
      ...(luxury.tripId !== rec.tripId
        ? [`Perfil premium (${luxury.score}/100): ${luxury.commercialAngle}`]
        : []),
      ...(alternative.tripId !== rec.tripId
        ? [`Alternativa complementaria (${alternative.score}/100): ${alternative.commercialAngle}`]
        : []),
    ].slice(0, 12);

    let commercialIntro: string | null =
      'Gracias por confiar en nosotros para diseñar su próximo viaje. A continuación encontrará cuatro perfiles del catálogo oficial: una recomendación prioritaria, una opción orientada al presupuesto, una propuesta de mayor rango y una alternativa complementaria, con scoring determinista y trazas auditables.';

    let recommendationBullets = deterministicReasons.slice(0, 6);

    let nextStep =
      'Contactar al cliente para confirmar opción preferida o matices (fechas, hoteles, servicios). Registrar acuerdos en el CRM y solicitar disponibilidad formal a proveedor antes de cotización cerrada.';

    if (search.fallbackHints.length) {
      recommendationBullets = [...search.fallbackHints.slice(0, 3), ...recommendationBullets].slice(0, 8);
    }

    if (payload.useAiCopy) {
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

    const viewModel: ProposalHtmlViewModel = {
      title: `Propuesta de viaje — ${payload.company.name}`,
      generatedAtLabel: `Generado el ${new Date().toLocaleString('es-ES', {
        dateStyle: 'long',
        timeStyle: 'short',
      })}`,
      companyName: payload.company.name,
      companyMetaLines,
      clientTitle: 'Datos del cliente',
      clientLines,
      intentTitle: 'Qué está buscando (resumen)',
      intentLines,
      commercialIntro,
      options: {
        recommended: tripCardVm('Opción recomendada', 'badge-rec', rec, getTrip(rec.tripId)),
        budget: tripCardVm('Perfil ajustado al presupuesto', 'badge-eco', budget, getTrip(budget.tripId)),
        luxury: tripCardVm('Perfil premium / alta gama', 'badge-prem', luxury, getTrip(luxury.tripId)),
        alternative: tripCardVm('Alternativa complementaria', 'badge-alt', alternative, getTrip(alternative.tripId)),
      },
      reasonsTitle: 'Motivos de la recomendación (visión general)',
      reasons: recommendationBullets,
      nextStepTitle: 'Siguiente paso para el vendedor',
      nextStepBody: nextStep,
      footerNote:
        'Documento generado automáticamente. Precios y disponibilidad son orientativos hasta confirmación con proveedores. Las condiciones contractuales definitivas se formalizarán en la reserva.',
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
