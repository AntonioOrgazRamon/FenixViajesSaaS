/** Escape determinístico para incrustar texto en HTML (plantilla fija, datos variables). */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  scoreLine: string | null;
  /** Motivo comercial determinístico (p. ej. `commercialAngle` del scorer). */
  commercialPitch: string;
  /** Coincidencias con la intención del cliente para ESTE viaje. */
  matches: string[];
  /** Gaps / diferencias para ESTE viaje. */
  misses: string[];
};

export type ProposalHtmlViewModel = {
  title: string;
  generatedAtLabel: string;
  companyName: string;
  /** Líneas extra bajo el nombre (slug, contacto interno, etc.) — determinísticas. */
  companyMetaLines: string[];
  clientTitle: string;
  clientLines: string[];
  intentTitle: string;
  intentLines: string[];
  commercialIntro: string | null;
  options: {
    recommended: TripCardVm;
    budget: TripCardVm;
    luxury: TripCardVm;
    alternative: TripCardVm;
  };
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

function tripCard(vm: TripCardVm): string {
  const highlights =
    vm.highlights.length > 0
      ? `<ul class="hl">${vm.highlights.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`
      : '<p class="muted">Sin destacados en catálogo.</p>';

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
      <div class="card-head">
        <span class="badge ${escapeHtml(vm.badgeClass)}">${escapeHtml(vm.label)}</span>
        <h3>${escapeHtml(vm.title)}</h3>
        ${vm.subtitle ? `<p class="sub">${escapeHtml(vm.subtitle)}</p>` : ''}
      </div>
      <dl class="facts">
        <div><dt>Destino</dt><dd>${vm.destination ? escapeHtml(vm.destination) : '—'}</dd></div>
        <div><dt>Duración</dt><dd>${vm.durationDays != null ? escapeHtml(String(vm.durationDays)) + ' días' : '—'}</dd></div>
        <div><dt>Precio orientativo</dt><dd>${vm.priceLine ? escapeHtml(vm.priceLine) : '—'}</dd></div>
        <div><dt>Scoring</dt><dd>${vm.scoreLine ? escapeHtml(vm.scoreLine) : '—'}</dd></div>
      </dl>
      <div class="hl-wrap">
        <p class="hl-title">Destacados del catálogo</p>
        ${highlights}
      </div>
      <div class="card-foot">
        <p class="pitch"><span class="pitch-label">Motivo comercial</span> ${escapeHtml(vm.commercialPitch)}</p>
        <div class="mini-two-col">
          <div class="mini-panel">
            <p class="mini-title">Coincidencias con lo buscado</p>
            ${matchBlock}
          </div>
          <div class="mini-panel">
            <p class="mini-title">Diferencias / a revisar</p>
            ${missBlock}
          </div>
        </div>
      </div>
    </article>
  `;
}

/**
 * Documento HTML único: responsive en pantalla y optimizado para impresión (@media print).
 * La estructura de secciones es fija; solo cambian datos escapados y textos del modelo.
 */
export function renderTravelProposalHtml(vm: ProposalHtmlViewModel): string {
  const intro = vm.commercialIntro
    ? `<section class="block intro"><p>${escapeHtml(vm.commercialIntro)}</p></section>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(vm.title)}</title>
  <style>
    :root {
      --ink: #0f172a;
      --muted: #475569;
      --line: #e2e8f0;
      --bg: #f8fafc;
      --card: #ffffff;
      --accent: #0ea5e9;
      --accent2: #0369a1;
      --ok: #059669;
      --warn: #d97706;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
      color: var(--ink);
      background: var(--bg);
      line-height: 1.55;
      font-size: 15px;
    }
    .wrap { max-width: 1080px; margin: 0 auto; padding: 28px 20px 48px; }
    header.doc {
      background: linear-gradient(120deg, var(--accent2), var(--accent));
      color: #fff;
      padding: 28px 24px;
      border-radius: 14px;
      box-shadow: 0 12px 40px rgba(14, 165, 233, 0.25);
    }
    header.doc h1 { margin: 0 0 8px; font-size: 26px; letter-spacing: -0.02em; }
    header.doc .meta { opacity: 0.92; font-size: 14px; }
    .company { font-weight: 600; margin-top: 10px; font-size: 15px; }
    .company-meta { margin-top: 8px; font-size: 13px; opacity: 0.92; line-height: 1.4; }
    section.block {
      margin-top: 22px;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 18px 20px;
    }
    section.block h2 {
      margin: 0 0 12px;
      font-size: 17px;
      letter-spacing: -0.01em;
      border-bottom: 1px solid var(--line);
      padding-bottom: 10px;
    }
    .muted { color: var(--muted); margin: 0; }
    .grid-3 {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      margin-top: 8px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px 16px 16px;
      background: #fff;
      display: flex;
      flex-direction: column;
      min-height: 100%;
    }
    .card-head h3 { margin: 8px 0 4px; font-size: 17px; line-height: 1.25; }
    .card-head .sub { margin: 0; color: var(--muted); font-size: 14px; }
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 999px;
      color: #fff;
    }
    .badge-rec { background: #047857; }
    .badge-eco { background: #2563eb; }
    .badge-prem { background: #7c3aed; }
    .badge-alt { background: #0f766e; }
    dl.facts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 12px;
      margin: 12px 0 0;
      font-size: 13px;
    }
    dl.facts dt { color: var(--muted); font-weight: 600; }
    dl.facts dd { margin: 0; }
    .hl-wrap { margin-top: 12px; flex: 1; }
    .hl-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0 0 6px; }
    .hl { margin: 0; padding-left: 18px; font-size: 13px; color: #334155; }
    .micro { font-size: 12px; margin: 4px 0 0; }
    .card-foot {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
    }
    .pitch { margin: 0 0 12px; font-size: 13px; line-height: 1.45; color: #1e293b; }
    .pitch-label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--accent2);
      margin-bottom: 4px;
    }
    .mini-two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    @media (max-width: 520px) {
      .mini-two-col { grid-template-columns: 1fr; }
    }
    .mini-panel {
      background: #f1f5f9;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 12px;
    }
    .mini-title {
      margin: 0 0 6px;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
    }
    .mini-panel ul { margin: 0; padding-left: 16px; }
    ul { margin: 0; padding-left: 18px; }
    li { margin-bottom: 4px; }
    .intro p { margin: 0; font-size: 15px; }
    footer.note {
      margin-top: 28px;
      font-size: 12px;
      color: var(--muted);
      text-align: center;
    }
    @media print {
      body { background: #fff; font-size: 11pt; }
      .wrap { padding: 0; max-width: none; }
      header.doc { border-radius: 0; box-shadow: none; page-break-after: avoid; }
      section.block { break-inside: avoid; border-radius: 8px; }
      .card { break-inside: avoid; }
      .grid-3 { display: block; }
      .card { margin-bottom: 12px; page-break-inside: avoid; }
    }
    @page { margin: 14mm; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="doc">
      <h1>${escapeHtml(vm.title)}</h1>
      <div class="meta">${escapeHtml(vm.generatedAtLabel)}</div>
      <div class="company">${escapeHtml(vm.companyName)}</div>
    </header>

    <section class="block">
      <h2>${escapeHtml(vm.clientTitle)}</h2>
      ${bulletList(vm.clientLines)}
    </section>

    <section class="block">
      <h2>${escapeHtml(vm.intentTitle)}</h2>
      ${bulletList(vm.intentLines)}
    </section>

    ${intro}

    <section class="block">
      <h2>Opciones presentadas</h2>
      <p class="muted">Cuatro perfiles (recomendada, presupuesto, premium y alternativa). Cada tarjeta resume scoring determinista, coincidencias y brecha frente a la intención.</p>
      <div class="grid-3">
        ${tripCard(vm.options.recommended)}
        ${tripCard(vm.options.budget)}
        ${tripCard(vm.options.luxury)}
        ${tripCard(vm.options.alternative)}
      </div>
    </section>

    <section class="block">
      <h2>${escapeHtml(vm.reasonsTitle)}</h2>
      <p class="muted">Resumen transversal (la comparativa detallada está en cada tarjeta de opción).</p>
      ${bulletList(vm.reasons)}
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
