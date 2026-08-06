/** Escape determinístico para incrustar texto en HTML (plantilla fija, datos variables). */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Atributo HTML doble-comillas: solo escapar comillas que rompen el atributo (URLs). */
export function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export type TripCardVm = {
  label: string;
  badgeClass: string;
  title: string;
  subtitle: string | null;
  destination: string | null;
  durationDays: number | null;
  priceLine: string | null;
  highlights: string[];
  /** Resumen legible para cliente (sin factores técnicos tipo raw/weight). */
  scoreLine: string | null;
  /** Mensajes humanos “por qué encaja” (contribuciones positivas + coincidencias). */
  whyFitLines: string[];
  /** Motivo comercial determinístico (ángulo del scorer). */
  commercialPitch: string;
  matches: string[];
  misses: string[];
  /** Imagen hero cacheada en BD (Unsplash/Pexels). */
  heroImageUrl?: string | null;
  heroImageAlt?: string | null;
};

export type ProposalConfidenceSection = { headline: string; text: string };

export type ProposalHtmlViewModel = {
  title: string;
  generatedAtLabel: string;
  companyName: string;
  companyMetaLines: string[];
  /** Hero opcional bajo el encabezado (opción recomendada). */
  documentHeroImageUrl?: string | null;
  documentHeroAlt?: string | null;
  clientTitle: string;
  clientLines: string[];
  /** Resumen contractual de negocio (perfil de viaje del CRM), opcional. */
  keyClientDataTitle: string;
  keyClientDataLines: string[];
  intentTitle: string;
  intentLines: string[];
  executiveSummaryTitle: string;
  executiveSummaryBody: string;
  whyRecommendedTitle: string;
  whyRecommendedLines: string[];
  confidenceStripTitle: string;
  confidenceSections: ProposalConfidenceSection[];
  informationGapsTitle: string;
  informationGapsLines: string[];
  riskLine: string;
  valueAnchorTitle: string;
  valueAnchorLines: string[];
  geoContextLine: string | null;
  similarAlternativesTitle: string;
  similarAlternativesBody: string;
  considerationsTitle: string;
  considerationLines: string[];
  commercialIntro: string | null;
  optionsSectionTitle: string;
  optionsIntro: string;
  proposalOptions: TripCardVm[];
  reasonsTitle: string;
  reasons: string[];
  nextStepTitle: string;
  nextStepBody: string;
  footerNote: string;
};

function bulletList(items: string[]): string {
  if (!items.length) return '<p class="muted">—</p>';
  return `<ul>${items.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
}

function safeHttpsImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const t = url.trim();
  if (!t.startsWith('https://')) return null;
  return t;
}

function tripCard(vm: TripCardVm): string {
  const heroUrl = safeHttpsImageUrl(vm.heroImageUrl ?? null);
  const heroBlock = heroUrl
    ? `<div class="card-hero"><img src="${escapeAttr(heroUrl)}" alt="${escapeHtml(vm.heroImageAlt || vm.title)}" loading="lazy" crossorigin="anonymous" referrerpolicy="no-referrer-when-downgrade" /></div>`
    : '';
  const highlights =
    vm.highlights.length > 0
      ? `<ul class="hl">${vm.highlights.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`
      : '<p class="muted">Sin destacados en catálogo.</p>';

  const whyBlock =
    vm.whyFitLines.length > 0
      ? `<div class="why-fit"><p class="why-fit-title">Por qué recomendamos esta opción</p>${bulletList(vm.whyFitLines)}</div>`
      : '';

  const matchBlock =
    vm.matches.length > 0
      ? bulletList(vm.matches)
      : '<p class="muted micro">Sin coincidencias automáticas registradas.</p>';
  const missBlock =
    vm.misses.length > 0
      ? bulletList(vm.misses)
      : '<p class="muted micro">Sin diferencias detectadas automáticamente.</p>';

  return `
    <article class="card" aria-label="${escapeHtml(vm.label)}">
      ${heroBlock}
      <div class="card-head">
        <span class="badge ${escapeHtml(vm.badgeClass)}">${escapeHtml(vm.label)}</span>
        <h3>${escapeHtml(vm.title)}</h3>
        ${vm.subtitle ? `<p class="sub">${escapeHtml(vm.subtitle)}</p>` : ''}
      </div>
      <dl class="facts">
        <div><dt>Destino</dt><dd>${vm.destination ? escapeHtml(vm.destination) : '—'}</dd></div>
        <div><dt>Duración</dt><dd>${vm.durationDays != null ? escapeHtml(String(vm.durationDays)) + ' días' : '—'}</dd></div>
        <div><dt>Precio orientativo</dt><dd>${vm.priceLine ? escapeHtml(vm.priceLine) : '—'}</dd></div>
        <div><dt>Encaje resumido</dt><dd>${vm.scoreLine ? escapeHtml(vm.scoreLine) : '—'}</dd></div>
      </dl>
      ${whyBlock}
      <div class="hl-wrap">
        <p class="hl-title">Puntos clave del viaje</p>
        ${highlights}
      </div>
      <div class="card-foot">
        <p class="pitch"><span class="pitch-label">Qué creemos que más valor aporta</span> ${escapeHtml(vm.commercialPitch)}</p>
        <div class="mini-two-col">
          <div class="mini-panel">
            <p class="mini-title">Coincidencias</p>
            ${matchBlock}
          </div>
          <div class="mini-panel">
            <p class="mini-title">Aspectos a tener en cuenta</p>
            ${missBlock}
          </div>
        </div>
      </div>
    </article>
  `;
}

function bulletOrMuted(items: string[], emptyLabel: string): string {
  if (!items.length) return `<p class="muted">${escapeHtml(emptyLabel)}</p>`;
  return bulletList(items);
}

function confidenceGrid(sections: ProposalConfidenceSection[]): string {
  if (!sections.length) return '';
  return `<div class="conf-grid">${sections
    .map(
      (s) => `
    <div class="conf-card">
      <p class="conf-card-head">${escapeHtml(s.headline)}</p>
      <p class="conf-card-body">${escapeHtml(s.text)}</p>
    </div>`,
    )
    .join('')}</div>`;
}

/**
 * Documento HTML único: responsive en pantalla y optimizado para impresión (@media print).
 */
export function renderTravelProposalHtml(vm: ProposalHtmlViewModel): string {
  const docHeroUrl = safeHttpsImageUrl(vm.documentHeroImageUrl ?? null);
  const docHeroAlt = vm.documentHeroAlt?.trim() ? vm.documentHeroAlt.trim() : vm.title;
  const docHero = docHeroUrl
    ? `<div class="doc-hero"><img src="${escapeAttr(docHeroUrl)}" alt="${escapeHtml(docHeroAlt)}" loading="eager" crossorigin="anonymous" referrerpolicy="no-referrer-when-downgrade" /></div>`
    : '';

  const intro = vm.commercialIntro
    ? `<section class="block intro ribbon"><p>${escapeHtml(vm.commercialIntro)}</p></section>`
    : '';

  const execBlock = `<section class="block exec">
      <p class="kicker">${escapeHtml(vm.executiveSummaryTitle)}</p>
      <p class="exec-lead">${escapeHtml(vm.executiveSummaryBody)}</p>
    </section>`;

  const whyBlock =
    vm.whyRecommendedLines.length > 0
      ? `<section class="block"><h2>${escapeHtml(vm.whyRecommendedTitle)}</h2>${bulletList(vm.whyRecommendedLines)}</section>`
      : '';

  const confidenceBlock = `<section class="block confidence-strip">
      <h2>${escapeHtml(vm.confidenceStripTitle)}</h2>
      <p class="muted small">Lectura determinista del motor (sin IA generativa). Pensado para demo profesional y transparencia comercial.</p>
      ${confidenceGrid(vm.confidenceSections)}
      <div class="risk-banner"><strong>Riesgo</strong> — ${escapeHtml(vm.riskLine)}</div>
    </section>`;

  const gapsBlock =
    vm.informationGapsLines.length > 0
      ? `<section class="block gaps-panel"><h2>${escapeHtml(vm.informationGapsTitle)}</h2>${bulletList(vm.informationGapsLines)}</section>`
      : '';

  const valueBlock =
    vm.valueAnchorLines.length > 0
      ? `<section class="block value-panel"><h2>${escapeHtml(vm.valueAnchorTitle)}</h2>${bulletList(vm.valueAnchorLines)}</section>`
      : '';

  const geoBlock = vm.geoContextLine
    ? `<section class="block geo-panel"><h2>Contexto geográfico</h2><p>${escapeHtml(vm.geoContextLine)}</p></section>`
    : '';

  const similarBlock = `<section class="block alt-panel"><h2>${escapeHtml(vm.similarAlternativesTitle)}</h2><p>${escapeHtml(
    vm.similarAlternativesBody,
  )}</p></section>`;

  const considerationsBlock =
    vm.considerationLines.length > 0
      ? `<section class="block considerations"><h2>${escapeHtml(vm.considerationsTitle)}</h2>${bulletList(vm.considerationLines)}</section>`
      : '';

  const optionsGrid =
    vm.proposalOptions.length > 0
      ? `<div class="grid-3">${vm.proposalOptions.map((c) => tripCard(c)).join('')}</div>`
      : '<p class="muted">Sin opciones para mostrar.</p>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(vm.title)}</title>
  <style>
    :root {
      --ink: #0c1222;
      --muted: #5c6578;
      --line: #e7e5e4;
      --bg: #fafaf9;
      --card: #ffffff;
      --accent: #0d9488;
      --accent2: #134e4a;
      --wash: #f5f5f4;
      --shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
      color: var(--ink);
      background: radial-gradient(1200px 600px at 10% -10%, rgba(13, 148, 136, 0.07), transparent),
        radial-gradient(900px 500px at 100% 0%, rgba(71, 85, 105, 0.06), transparent), var(--bg);
      line-height: 1.6;
      font-size: 15px;
    }
    .wrap { max-width: 1040px; margin: 0 auto; padding: 36px 24px 56px; }
    header.doc {
      background: linear-gradient(135deg, var(--accent2), var(--accent));
      color: #fff;
      padding: 32px 28px;
      border-radius: 18px;
      box-shadow: var(--shadow);
    }
    .doc-hero {
      margin: -32px -28px 20px;
      border-radius: 18px 18px 0 0;
      overflow: hidden;
      max-height: 220px;
    }
    .doc-hero img {
      width: 100%;
      height: 220px;
      object-fit: cover;
      display: block;
    }
    header.doc h1 {
      margin: 0 0 10px;
      font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.03em;
    }
    header.doc .meta { opacity: 0.92; font-size: 14px; }
    .company { font-weight: 600; margin-top: 12px; font-size: 15px; letter-spacing: 0.01em; }
    section.block {
      margin-top: 22px;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 22px 24px;
      box-shadow: 0 1px 0 rgba(255,255,255,0.8) inset;
    }
    section.block h2 {
      margin: 0 0 12px;
      font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
      font-size: 19px;
      letter-spacing: -0.02em;
      border-bottom: 1px solid var(--line);
      padding-bottom: 10px;
      font-weight: 600;
    }
    .kicker {
      margin: 0 0 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--accent);
    }
    .exec-lead { margin: 0; font-size: 17px; line-height: 1.55; color: #1e293b; }
    .ribbon { border-left: 4px solid var(--accent); background: linear-gradient(90deg, rgba(13,148,136,0.06), transparent); }
    .small { font-size: 13px; margin: 0 0 12px; }
    .muted { color: var(--muted); margin: 0; }
    .conf-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      margin-top: 12px;
    }
    .conf-card {
      background: var(--wash);
      border-radius: 12px;
      padding: 12px 14px;
      border: 1px solid var(--line);
    }
    .conf-card-head {
      margin: 0 0 6px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--accent2);
    }
    .conf-card-body { margin: 0; font-size: 14px; color: #334155; line-height: 1.45; }
    .risk-banner {
      margin-top: 16px;
      padding: 12px 14px;
      border-radius: 12px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      font-size: 14px;
      color: #78350f;
    }
    .gaps-panel { border-left: 4px solid #94a3b8; }
    .value-panel { border-left: 4px solid var(--accent); }
    .geo-panel { border-left: 4px solid #6366f1; background: #f8fafc; }
    .alt-panel { border-left: 4px solid #64748b; }
    .considerations { border-left: 4px solid #f59e0b; }
    .grid-3 {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      margin-top: 12px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 16px 18px 18px;
      background: #fff;
      display: flex;
      flex-direction: column;
      min-height: 100%;
      box-shadow: 0 8px 28px rgba(15, 23, 42, 0.05);
    }
    .card-hero {
      margin: -16px -18px 12px;
      border-radius: 14px 14px 0 0;
      overflow: hidden;
      max-height: 200px;
    }
    .card-hero img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      display: block;
    }
    .card-head h3 { margin: 10px 0 4px; font-size: 18px; line-height: 1.25; font-family: ui-serif, Georgia, serif; }
    .card-head .sub { margin: 0; color: var(--muted); font-size: 14px; }
    .badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 5px 11px;
      border-radius: 999px;
      color: #fff;
    }
    .badge-rec { background: #047857; }
    .badge-eco { background: #1d4ed8; }
    .badge-prem { background: #6d28d9; }
    .badge-alt { background: #0f766e; }
    dl.facts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 14px;
      margin: 12px 0 0;
      font-size: 13px;
    }
    dl.facts dt { color: var(--muted); font-weight: 600; }
    dl.facts dd { margin: 0; }
    .why-fit { margin-top: 14px; padding: 12px 14px; border-radius: 12px; background: #ecfdf5; border: 1px solid #a7f3d0; }
    .why-fit-title {
      margin: 0 0 8px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #065f46;
    }
    .why-fit ul { margin: 0; padding-left: 18px; font-size: 13px; color: #064e3b; }
    .hl-wrap { margin-top: 14px; flex: 1; }
    .hl-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0 0 8px; }
    .hl { margin: 0; padding-left: 18px; font-size: 13px; color: #334155; }
    .micro { font-size: 12px; margin: 4px 0 0; }
    .card-foot {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid var(--line);
    }
    .pitch { margin: 0 0 14px; font-size: 14px; line-height: 1.5; color: #1e293b; }
    .pitch-label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent2);
      margin-bottom: 6px;
    }
    .mini-two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    @media (max-width: 560px) {
      .mini-two-col { grid-template-columns: 1fr; }
    }
    .mini-panel {
      background: var(--wash);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 12px;
      border: 1px solid var(--line);
    }
    .mini-title {
      margin: 0 0 6px;
      font-weight: 700;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
    }
    .mini-panel ul { margin: 0; padding-left: 16px; }
    ul { margin: 0; padding-left: 18px; }
    li { margin-bottom: 6px; }
    .intro p { margin: 0; font-size: 15px; }
    footer.note {
      margin-top: 32px;
      font-size: 12px;
      color: var(--muted);
      text-align: center;
      max-width: 640px;
      margin-left: auto;
      margin-right: auto;
      line-height: 1.5;
    }
    @media print {
      body { background: #fff; font-size: 11pt; }
      .wrap { padding: 0; max-width: none; }
      header.doc { border-radius: 0; box-shadow: none; page-break-after: avoid; }
      section.block { break-inside: avoid; border-radius: 10px; }
      .card { break-inside: avoid; box-shadow: none; }
      .grid-3 { display: block; }
      .card { margin-bottom: 14px; page-break-inside: avoid; }
    }
    @page { margin: 14mm; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="doc">
      ${docHero}
      <h1>${escapeHtml(vm.title)}</h1>
      <div class="meta">${escapeHtml(vm.generatedAtLabel)}</div>
      <div class="company">${escapeHtml(vm.companyName)}</div>
    </header>

    ${execBlock}

    <section class="block">
      <h2>${escapeHtml(vm.clientTitle)}</h2>
      ${bulletList(vm.clientLines)}
    </section>

    ${
      vm.keyClientDataLines?.length
        ? `<section class="block key-client-brief"><h2>${escapeHtml(vm.keyClientDataTitle || 'Datos clave del cliente')}</h2>${bulletList(vm.keyClientDataLines)}</section>`
        : ''
    }

    <section class="block">
      <h2>${escapeHtml(vm.intentTitle)}</h2>
      ${bulletList(vm.intentLines)}
    </section>

    ${whyBlock}
    ${confidenceBlock}
    ${gapsBlock}
    ${valueBlock}
    ${geoBlock}

    ${intro}

    <section class="block">
      <h2>${escapeHtml(vm.optionsSectionTitle)}</h2>
      <p class="muted small">${escapeHtml(vm.optionsIntro)}</p>
      ${optionsGrid}
    </section>

    ${similarBlock}
    ${considerationsBlock}

    <section class="block">
      <h2>${escapeHtml(vm.reasonsTitle)}</h2>
      <p class="muted small">Notas para el equipo comercial (sin métricas internas crudas en las tarjetas).</p>
      ${bulletOrMuted(vm.reasons, 'Sin notas adicionales.')}
    </section>

    <section class="block">
      <h2>${escapeHtml(vm.nextStepTitle)}</h2>
      <p>${escapeHtml(vm.nextStepBody)}</p>
    </section>

    <footer class="note">${escapeHtml(vm.footerNote)}</footer>
  </div>
</body>
</html>`;
}
