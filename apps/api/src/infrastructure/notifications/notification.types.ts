/**
 * Contrato extensible para avisos “propuesta lista” (email, webhook, in-app, Slack/Teams).
 * Los transportes opcionales usan el mismo snapshot para no acoplar dominio a un canal.
 */
export type ProposalReadyDispatchPayload = {
  companyId: string;
  leadId: string;
  proposalId: string;
  proposalVersionId: string;
  /** Nombre / identificador principal del cliente */
  leadDisplay: string;
  /** Email, teléfono u organización (sin datos de otra empresa) */
  clientContactLines: string[];
  /** Una línea: destino o intención principal */
  primaryIntentLine: string;
  /** Presupuesto / duración orientativos si existen en catálogo o snapshot */
  budgetDurationLine: string | null;
  /** Texto más largo: intención / contexto */
  intentSummary: string;
  topOptionsLines: string[];
  leadUrl: string;
  /** Vista en app (ficha lead + ancla; la ruta concreta la define el front) */
  proposalAppUrl: string | null;
  proposalPdfUrl: string | null;
};

export type NotificationChannelId = 'email' | 'webhook' | 'in_app' | 'slack' | 'teams';

export type ChannelAttempt = {
  ok: boolean;
  error?: string;
  skipped?: boolean;
  /** Correo u otro canal lanzado en segundo plano (respuesta HTTP ya cerrada). */
  pendingAsync?: boolean;
  detail?: unknown;
};

export type EmailChannelAttempt = ChannelAttempt & {
  perRecipient?: Array<{ to: string } & ChannelAttempt>;
};

export type ProposalReadyChannelResults = {
  email: EmailChannelAttempt;
  webhook: ChannelAttempt;
  in_app: ChannelAttempt;
  slack: ChannelAttempt;
  teams: ChannelAttempt;
};
