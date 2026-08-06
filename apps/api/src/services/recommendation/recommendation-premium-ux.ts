import type {
  RecommendationMatchState,
  TravelPremiumConfidencePanel,
  TravelSearchCriteriaApplied,
  TravelSearchIntent,
  TravelSearchResponse,
  TravelSearchResultItem,
  TravelTrustSummary,
  TravelPremiumUx,
} from '../travel/travel-search.schema';

function uniqueTrimmed(lines: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const s = raw.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

function missingCriteriaLines(criteria: TravelSearchCriteriaApplied): string[] {
  const lines: string[] = [];
  if (!criteria.destination) lines.push('No se indicó un destino concreto (la búsqueda es más amplia).');
  if (!criteria.durationDays) lines.push('Falta duración orientativa en días.');
  if (!criteria.budgetPerPerson) lines.push('Falta presupuesto orientativo (por persona o total).');
  if (!criteria.calendar) lines.push('No hay mes ni fecha aproximada para calendario/temporada.');
  if (!criteria.travelers) lines.push('No se indicó número de viajeros.');
  if (!criteria.travelType) lines.push('No se describió el tipo de viaje en texto estructurado.');
  if (!criteria.tagsOrPreferences) lines.push('No hay etiquetas ni preferencias libres.');
  if (!criteria.travelStyleAxes) lines.push('No se seleccionaron ejes de estilo (playa, cultura, etc.).');
  return lines;
}

function geoLineFromItem(top: TravelSearchResultItem | undefined): string | null {
  const dest = top?.contributions.find((c) => c.factor === 'destination');
  if (!dest?.explanationCustomer) return null;
  const m = dest.explanationCustomer.match(/geo:\s*([^\.]+(?:\.[^\.]+)?)/i);
  if (!m) return null;
  const tail = m[1]?.trim();
  if (!tail) return null;
  return `Contexto geográfico: ${tail.charAt(0).toUpperCase()}${tail.slice(1)}`;
}

function matchQualityCopy(matchState: RecommendationMatchState, g: number | null): { headline: string; body: string } {
  const pct = g != null ? Math.round(g * 100) : null;
  switch (matchState) {
    case 'STRONG_MATCH':
      return {
        headline: 'Calidad del matching: alta',
        body:
          pct != null
            ? `El mejor clasificado concentra varios criterios alineados y la confianza global es del ${pct}% (según la información disponible).`
            : 'El mejor clasificado concentra varios criterios alineados según la información disponible.',
      };
    case 'WEAK_MATCH':
      return {
        headline: 'Calidad del matching: moderada',
        body:
          'Hay coincidencias útiles, pero parte de los criterios queda solo parcialmente cubierta o depende de supuestos débiles.',
      };
    case 'NO_MATCH':
      return {
        headline: 'Calidad del matching: limitada',
        body:
          'No hay un encaje claro frente a todos los criterios; las opciones son referencias cercanas dentro del catálogo actual.',
      };
    case 'NEEDS_CLARIFICATION':
      return {
        headline: 'Calidad del matching: pendiente de datos',
        body:
          'Faltan datos clave del cliente para cerrar el encaje; las opciones son orientativas hasta completar la intención.',
      };
    default:
      return { headline: 'Calidad del matching', body: '—' };
  }
}

function catalogCoverageCopy(ts: TravelTrustSummary): { headline: string; body: string } {
  const ratioPct = Math.round(ts.catalogEligibleRatio * 100);
  if (ts.catalogTripCount <= 0) {
    return {
      headline: 'Cobertura de catálogo',
      body: 'No hay circuitos aprobados evaluables en este momento.',
    };
  }
  if (ratioPct >= 55) {
    return {
      headline: 'Cobertura de catálogo',
      body: `Catálogo de ${ts.catalogTripCount} circuito(s) aprobado(s); una parte relevante entró en la comparativa final (${ratioPct}% del universo rankeado).`,
    };
  }
  return {
    headline: 'Cobertura de catálogo',
    body: `Catálogo de ${ts.catalogTripCount} circuito(s) aprobado(s); el filtrado previo redujo el conjunto comparado (≈${ratioPct}% del catálogo en el ranking final).`,
  };
}

function confidenceCopy(g: number | null, ts: TravelTrustSummary): { headline: string; body: string } {
  const pct = g != null ? Math.round(g * 100) : null;
  const compPct = Math.round(ts.intentCompleteness * 100);
  if (pct == null) {
    return {
      headline: 'Nivel de confianza',
      body: `No hay una confianza numérica consolidada; la intención está ${compPct}% completa respecto al máximo de criterios modelados.`,
    };
  }
  if (pct >= 72) {
    return {
      headline: 'Nivel de confianza',
      body: `Confianza global ${pct}% con intención ${compPct}% completa: la recomendación es sólida si los datos del cliente son correctos.`,
    };
  }
  if (pct >= 48) {
    return {
      headline: 'Nivel de confianza',
      body: `Confianza global ${pct}% e intención ${compPct}% completa: útil como punto de partida; conviene validar matices con el cliente.`,
    };
  }
  return {
    headline: 'Nivel de confianza',
    body: `Confianza global ${pct}% e intención ${compPct}% completa: hay incertidumbre relevante; priorizar preguntas aclaratorias antes de cerrar mensaje comercial.`,
  };
}

function partialRiskLine(matchState: RecommendationMatchState): string {
  switch (matchState) {
    case 'STRONG_MATCH':
      return 'Riesgo de recomendación parcial: bajo si los datos del cliente son fiables.';
    case 'WEAK_MATCH':
      return 'Riesgo de recomendación parcial: medio — algunos criterios pueden requerir ajuste o contraoferta.';
    case 'NO_MATCH':
      return 'Riesgo de recomendación parcial: alto — tratar las opciones como referencias, no como compromiso de encaje total.';
    case 'NEEDS_CLARIFICATION':
      return 'Riesgo de recomendación parcial: alto hasta recibir datos que falten en la intención.';
    default:
      return 'Riesgo de recomendación parcial: evaluar caso a caso.';
  }
}

function humanReasoning(params: {
  intent: TravelSearchIntent;
  matchState: RecommendationMatchState;
  top?: TravelSearchResultItem;
  relaxedAlternatives: boolean;
  strengths: string[];
  tradeoffs: string[];
}): string {
  const { matchState, top, relaxedAlternatives, strengths, tradeoffs } = params;
  const dest = params.intent.destination?.trim();
  const prefix = dest ? `Para «${dest}», ` : '';

  if (matchState === 'STRONG_MATCH' && top) {
    return `${prefix}el circuito priorizado concentra varias coincidencias claras con lo solicitado.${relaxedAlternatives ? ' Se aplicó un modo de alternativas más flexible en destino.' : ''}`;
  }
  if (matchState === 'WEAK_MATCH' && top) {
    const s =
      strengths.slice(0, 2).join(' ') ||
      'hay coincidencias parciales que pueden servir como conversación inicial con el cliente';
    const t = tradeoffs.slice(0, 1).join(' ');
    return `${prefix}no encontramos una coincidencia perfecta en todos los frentes; ${s}.${t ? ` ${t}` : ''}`;
  }
  if (matchState === 'NO_MATCH' && top) {
    return `${prefix}no encontramos un encaje claro con todos los criterios; la opción mostrada es la más cercana disponible hoy en catálogo, con limitaciones explícitas.`;
  }
  if (matchState === 'NEEDS_CLARIFICATION') {
    return `${prefix}antes de hablar de encaje fino conviene completar datos del cliente; las referencias sirven para orientar la conversación.`;
  }
  return `${prefix}evalúe las coincidencias y brechas listadas antes del discurso comercial.`;
}

function pickStrengths(top: TravelSearchResultItem | undefined): string[] {
  if (!top) return [];
  const fromMatches = top.matches.map((m) => m.trim()).filter(Boolean);
  const fromContrib = top.contributions
    .filter((c) => c.weight > 0 && c.contribution >= c.weight * 0.5 && c.factor !== 'dossier_completeness')
    .map((c) => c.explanationCustomer.trim())
    .filter(Boolean);
  return uniqueTrimmed([...fromMatches, ...fromContrib], 10);
}

function pickTradeoffs(
  top: TravelSearchResultItem | undefined,
  validationIssues: TravelSearchResponse['validationIssues'],
  fallbackHints: string[],
): string[] {
  const fromMisses = top?.misses.map((m) => m.trim()).filter(Boolean) ?? [];
  const fromViolations =
    top?.constraintViolations?.map((v) => v.message.trim()).filter(Boolean) ?? [];
  const fromVal = validationIssues
    .filter((i) => i.severity === 'WARN' || i.severity === 'CLARIFICATION')
    .map((i) => (i.messageCustomer ?? i.message).trim())
    .filter(Boolean);
  const hints = fallbackHints.map((h) => h.trim()).filter(Boolean);
  return uniqueTrimmed([...fromMisses, ...fromViolations, ...fromVal, ...hints], 12);
}

function whyBullets(top: TravelSearchResultItem | undefined): string[] {
  if (!top) return [];
  const lines: string[] = [];
  for (const c of top.contributions) {
    if (c.weight <= 0) continue;
    const ratio = c.contribution / c.weight;
    if (ratio < 0.42) continue;
    lines.push(c.explanationCustomer.trim());
  }
  const merged = [...top.matches, ...lines];
  return uniqueTrimmed(merged, 8);
}

function slotCommercialLabel(kind: 'recommended' | 'budget' | 'luxury' | 'alternative'): string {
  switch (kind) {
    case 'recommended':
      return 'la opción prioritaria';
    case 'budget':
      return 'la opción más económica dentro del pool';
    case 'luxury':
      return 'la propuesta premium';
    case 'alternative':
      return 'esta alternativa';
    default:
      return 'esta opción';
  }
}

/** Narrativa comercial cuando un slot encaja con `explicitPreferredDestination` (una línea por lugar citado). */
function commercialPreferenceNotesFromPicks(
  intent: TravelSearchIntent,
  picks: TravelSearchResponse['picks'],
): string[] {
  if (!intent.preferredDestinations?.length) return [];
  /** Prioridad: alternativa primero (suele ser donde forzamos el segundo país nombrado). */
  const slots: { kind: 'recommended' | 'budget' | 'luxury' | 'alternative'; item: TravelSearchResultItem | null }[] =
    [
      { kind: 'alternative', item: picks.alternative },
      { kind: 'recommended', item: picks.recommended },
      { kind: 'luxury', item: picks.luxury },
      { kind: 'budget', item: picks.budget },
    ];
  const seenNames = new Set<string>();
  const out: string[] = [];
  for (const { kind, item } of slots) {
    if (!item) continue;
    const c = item.contributions.find((x) => x.factor === 'explicitPreferredDestination');
    if (!c || c.weight <= 0 || c.contribution < c.weight * 0.42) continue;
    const m = c.explanationCustomer.match(/«([^»]+)»/);
    const name = m?.[1]?.trim();
    if (!name) continue;
    const nk = name.toLowerCase();
    if (seenNames.has(nk)) continue;
    seenNames.add(nk);
    if (kind === 'alternative') {
      out.push(`Incluimos esta alternativa porque el cliente mencionó explícitamente ${name}.`);
    } else {
      out.push(`Incluimos ${slotCommercialLabel(kind)} porque el cliente mencionó explícitamente ${name}.`);
    }
  }
  return out.slice(0, 8);
}

function similarAlternativesSummary(picks: TravelSearchResponse['picks'], rankedLen: number): string {
  const ids = new Set(
    [picks.recommended, picks.budget, picks.luxury, picks.alternative]
      .filter(Boolean)
      .map((x) => x!.tripId),
  );
  const slotCount = ids.size;
  if (rankedLen <= 1) {
    return 'No hay alternativas adicionales destacadas en este resultado; considere ampliar criterios o revisar catálogo.';
  }
  return `Además de la opción prioritaria, el sistema ha reservado hasta ${slotCount} perfiles comerciales distintos (presupuesto / premium / alternativa) cuando el catálogo lo permite, para comparar matices sin perder coherencia.`;
}

export function buildTravelPremiumConfidencePanel(params: {
  matchState: RecommendationMatchState;
  globalConfidence: number | null;
  trustSummary: TravelTrustSummary;
  criteriaApplied: TravelSearchCriteriaApplied;
  validationIssues: TravelSearchResponse['validationIssues'];
}): TravelPremiumConfidencePanel {
  const mq = matchQualityCopy(params.matchState, params.globalConfidence);
  const cat = catalogCoverageCopy(params.trustSummary);
  const conf = confidenceCopy(params.globalConfidence, params.trustSummary);
  const missing = missingCriteriaLines(params.criteriaApplied);
  const extraGaps = params.validationIssues
    .filter((i) => i.severity === 'INFO')
    .map((i) => (i.messageCustomer ?? i.message).trim())
    .filter(Boolean)
    .slice(0, 4);
  const informationGaps = uniqueTrimmed([...missing, ...extraGaps], 12);

  return {
    matchQualityHeadline: mq.headline,
    matchQualityBody: mq.body,
    catalogCoverageHeadline: cat.headline,
    catalogCoverageBody: cat.body,
    confidenceHeadline: conf.headline,
    confidenceBody: conf.body,
    missingInformation: informationGaps,
    partialRecommendationRisk: partialRiskLine(params.matchState),
  };
}

/** Narrativa premium determinista (sin LLM): demo / PDF / API. */
export function buildTravelPremiumUx(
  intent: TravelSearchIntent,
  ctx: {
    criteriaApplied: TravelSearchCriteriaApplied;
    matchState: RecommendationMatchState;
    globalConfidence: number | null;
    trustSummary: TravelTrustSummary;
    validationIssues: TravelSearchResponse['validationIssues'];
    fallbackHints: string[];
    relaxedAlternatives: boolean;
    ranked: TravelSearchResultItem[];
    picks: TravelSearchResponse['picks'];
  },
): TravelPremiumUx {
  const top = ctx.ranked[0];
  const strengths = pickStrengths(top);
  const tradeoffs = pickTradeoffs(top, ctx.validationIssues, ctx.fallbackHints);
  const panel = buildTravelPremiumConfidencePanel({
    matchState: ctx.matchState,
    globalConfidence: ctx.globalConfidence,
    trustSummary: ctx.trustSummary,
    criteriaApplied: ctx.criteriaApplied,
    validationIssues: ctx.validationIssues,
  });

  const reasoning = humanReasoning({
    intent,
    matchState: ctx.matchState,
    top,
    relaxedAlternatives: ctx.relaxedAlternatives,
    strengths,
    tradeoffs,
  });

  return {
    humanReadableReasoning: reasoning,
    whyRecommendedBullets: whyBullets(top),
    topStrengths: strengths,
    mainTradeoffs: tradeoffs.length ? tradeoffs : ['Sin brechas destacadas por el motor más allá de la variabilidad habitual del catálogo.'],
    commercialPreferenceNotes: commercialPreferenceNotesFromPicks(intent, ctx.picks),
    geoContextLine: geoLineFromItem(top),
    confidencePanel: panel,
    similarAlternativesSummary: similarAlternativesSummary(ctx.picks, ctx.ranked.length),
  };
}

export function attachPremiumUxToResponse(intent: TravelSearchIntent, response: TravelSearchResponse): TravelSearchResponse {
  return {
    ...response,
    premiumUx: buildTravelPremiumUx(intent, {
      criteriaApplied: response.criteriaApplied,
      matchState: response.matchState,
      globalConfidence: response.globalConfidence,
      trustSummary: response.trustSummary,
      validationIssues: response.validationIssues,
      fallbackHints: response.fallbackHints,
      relaxedAlternatives: response.relaxedAlternatives,
      ranked: response.ranked,
      picks: response.picks,
    }),
  };
}
