import { config } from '../../common/config';
import { logger } from '../../common/logger';
import { sendOperationalEmail } from '../email/email.service';
import { buildProposalReadyEmail } from '../email/templates/proposal-ready.email';
import type {
  ChannelAttempt,
  ProposalReadyChannelResults,
  ProposalReadyDispatchPayload,
} from './notification.types';

async function logFutureChannels(companyId: string, leadId: string): Promise<{
  webhook: ChannelAttempt;
  in_app: ChannelAttempt;
  slack: ChannelAttempt;
  teams: ChannelAttempt;
}> {
  logger.debug(
    { companyId, leadId, event: 'PROPOSAL_READY', reserved: ['webhook', 'in_app', 'slack', 'teams'] },
    'Canales de notificación adicionales reservados (sin implementación todavía)'
  );
  const stub: ChannelAttempt = { ok: true, skipped: true };
  return { webhook: stub, in_app: stub, slack: stub, teams: stub };
}

export type ProposalReadyRecipient = { email: string; firstName?: string | null };

/**
 * Despacho multi-canal. Hoy: email operativo real; el resto deja trazabilidad en logs para futuros consumers.
 */
export async function dispatchProposalReadyEvent(params: {
  payload: ProposalReadyDispatchPayload;
  recipients: ProposalReadyRecipient[];
}): Promise<ProposalReadyChannelResults> {
  const { payload, recipients } = params;
  const appName = config.APP_NAME;
  const baseInput = {
    appName,
    leadDisplay: payload.leadDisplay,
    clientContactLines: payload.clientContactLines,
    primaryIntentLine: payload.primaryIntentLine,
    budgetDurationLine: payload.budgetDurationLine,
    intentSummary: payload.intentSummary,
    topOptionsLines: payload.topOptionsLines,
    leadUrl: payload.leadUrl,
    proposalAppUrl: payload.proposalAppUrl,
    proposalPdfUrl: payload.proposalPdfUrl,
  };

  const perRecipient: Array<{ to: string } & ChannelAttempt> = [];
  for (const r of recipients) {
    const { subject, text, html } = buildProposalReadyEmail({
      ...baseInput,
      recipientFirstName: r.firstName,
    });
    const send = await sendOperationalEmail({ to: r.email, subject, text, html });
    if (send.sent) {
      perRecipient.push({ to: r.email, ok: true });
    } else {
      perRecipient.push({ to: r.email, ok: false, error: send.error });
    }
  }

  const emailAggregateOk = perRecipient.length > 0 && perRecipient.every((x) => x.ok);
  const emailResult =
    perRecipient.length > 0
      ? { ok: emailAggregateOk, perRecipient }
      : { ok: false, error: 'NO_RECIPIENTS' as string };

  const { webhook, in_app, slack, teams } = await logFutureChannels(payload.companyId, payload.leadId);

  return {
    email: emailResult,
    webhook,
    in_app,
    slack,
    teams,
  };
}
