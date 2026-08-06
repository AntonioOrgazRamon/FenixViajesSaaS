import { config } from '../../../common/config';
import { escapeAttr, escapeHtml } from '../email.service';

export type ProposalReadyTemplateInput = {
  appName: string;
  /** Nombre comercial del lead / contacto */
  leadDisplay: string;
  clientContactLines: string[];
  /** Destino o intención en una línea */
  primaryIntentLine: string;
  budgetDurationLine: string | null;
  intentSummary: string;
  topOptionsLines: string[];
  leadUrl: string;
  /** Enlace a ficha / sección propuesta en la SPA */
  proposalAppUrl: string | null;
  proposalPdfUrl: string | null;
  recipientFirstName?: string | null;
};

function bulletList(lines: string[]): string {
  if (!lines.length) return '—';
  return lines.map((l) => `• ${l}`).join('\n');
}

/**
 * Asunto + cuerpo (texto y HTML) para avisar a vendedores de que la propuesta está lista.
 */
export function buildProposalReadyEmail(input: ProposalReadyTemplateInput): {
  subject: string;
  text: string;
  html: string;
} {
  const plainGreeting =
    input.recipientFirstName && input.recipientFirstName.trim().length > 0
      ? `Hola ${input.recipientFirstName.trim()},`
      : 'Hola,';
  const htmlGreeting =
    input.recipientFirstName && input.recipientFirstName.trim().length > 0
      ? `Hola ${escapeHtml(input.recipientFirstName.trim())},`
      : 'Hola,';

  const subject = `Propuesta lista para revisar — ${input.leadDisplay} — ${input.appName}`;
  const contactBlock =
    input.clientContactLines.length > 0 ? input.clientContactLines.join('\n') : '—';
  const budgetDur = input.budgetDurationLine ?? '—';
  const optionsText = bulletList(input.topOptionsLines);
  const proposalWeb = input.proposalAppUrl ?? input.leadUrl;
  const pdfLine = input.proposalPdfUrl
    ? `PDF / descarga:\n${input.proposalPdfUrl}`
    : 'PDF: (sin URL pública aún — abre la ficha del lead)';

  const text = `${plainGreeting}

Propuesta comercial lista para el cliente «${input.leadDisplay}».

Contacto del cliente:
${contactBlock}

Destino / intención principal:
${input.primaryIntentLine}

Duración / presupuesto orientativos:
${budgetDur}

Intención detectada (detalle):
${input.intentSummary}

Opciones recomendadas (orden por encaje):
${optionsText}

Ficha del lead:
${input.leadUrl}

Ver propuesta en la app:
${proposalWeb}

${pdfLine}

— ${input.appName}
`;

  const contactHtml =
    input.clientContactLines.length > 0
      ? `<ul>${input.clientContactLines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
      : `<p>—</p>`;

  const optionsHtml =
    input.topOptionsLines.length > 0
      ? `<ul>${input.topOptionsLines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
      : `<p>—</p>`;

  const pdfBlock = input.proposalPdfUrl
    ? `<p><a href="${escapeAttr(input.proposalPdfUrl)}">Descargar / abrir PDF de la propuesta</a></p>`
    : `<p><em>Sin enlace público al PDF — revisa la ficha del lead.</em></p>`;

  const appBlock = proposalWeb
    ? `<p><a href="${escapeAttr(proposalWeb)}">Abrir propuesta en ${escapeHtml(input.appName)}</a></p>`
    : '';

  const html = `<p>${htmlGreeting}</p>
<p><strong>Propuesta comercial lista</strong> para el cliente <strong>${escapeHtml(input.leadDisplay)}</strong>.</p>
<p><strong>Contacto del cliente</strong></p>
${contactHtml}
<p><strong>Destino / intención principal</strong></p>
<p>${escapeHtml(input.primaryIntentLine)}</p>
<p><strong>Duración / presupuesto orientativos</strong></p>
<p>${escapeHtml(budgetDur)}</p>
<p><strong>Intención detectada (detalle)</strong></p>
<p>${escapeHtml(input.intentSummary).replace(/\n/g, '<br/>')}</p>
<p><strong>Opciones recomendadas</strong></p>
${optionsHtml}
<p><strong>Ficha del lead</strong></p>
<p><a href="${escapeAttr(input.leadUrl)}">Ver lead en ${escapeHtml(input.appName)}</a></p>
${appBlock}
${pdfBlock}
<p>— ${escapeHtml(input.appName)}</p>`;

  return { subject, text, html };
}

export function buildLeadAppUrl(leadId: string): string {
  return `${config.FRONTEND_BASE_URL.replace(/\/$/, '')}/leads/${leadId}`;
}

/** Ancla para futura vista “propuesta” en la SPA (`#propuesta`). */
export function buildProposalAppUrl(leadId: string): string {
  return `${buildLeadAppUrl(leadId)}#propuesta`;
}
