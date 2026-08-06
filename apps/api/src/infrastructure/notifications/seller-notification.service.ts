import {
  LeadActorType,
  LeadActivityType,
  Prisma,
  type Lead,
  type ProposalVersion,
  type ProposalTrip,
  type TravelTrip,
  type User,
} from '@prisma/client';
import prisma from '../db';
import { logger } from '../../common/logger';
import { config } from '../../common/config';
import { buildLeadAppUrl, buildProposalAppUrl } from '../email/templates/proposal-ready.email';
import { dispatchProposalReadyEvent } from './proposal-ready.dispatcher';
import type { ProposalReadyChannelResults, ProposalReadyDispatchPayload } from './notification.types';

type VersionBundle = ProposalVersion & {
  proposal: {
    leadId: string;
    companyId: string;
    id: string;
    lead: Lead & { details: { currentContext: Prisma.JsonValue | null } | null };
  };
  trips: Array<ProposalTrip & { travelTrip: TravelTrip }>;
  artifacts: Array<{ kind: string; publicUrl: string | null; storagePath: string }>;
};

function leadContactDisplay(lead: Lead): string {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim();
  if (lead.fullName && lead.fullName.trim()) return lead.fullName.trim();
  if (name) return name;
  if (lead.email) return lead.email;
  if (lead.phone) return lead.phone;
  return `Lead ${lead.id.slice(0, 8)}…`;
}

/** Snapshot tipo análisis “smart proposal” (sin importar el módulo de leads → sin ciclos). */
type AnalysisSnapshotShape = {
  intention: { summary: string; signals?: string[] };
  recommendedTrips?: Array<{ mainDestination?: string | null }>;
};

function isAnalysisSnapshotShape(s: unknown): s is AnalysisSnapshotShape {
  return (
    typeof s === 'object' &&
    s !== null &&
    'intention' in s &&
    typeof (s as AnalysisSnapshotShape).intention?.summary === 'string'
  );
}

function clientContactLinesFromLead(lead: Lead): string[] {
  const lines: string[] = [];
  if (lead.email?.trim()) lines.push(`Email: ${lead.email.trim()}`);
  if (lead.phone?.trim()) lines.push(`Teléfono: ${lead.phone.trim()}`);
  if (lead.companyName?.trim()) lines.push(`Organización: ${lead.companyName.trim()}`);
  if (lead.country?.trim()) lines.push(`País: ${lead.country.trim()}`);
  return lines;
}

function buildIntentSummary(lead: Lead & { details: { currentContext: Prisma.JsonValue | null } | null }, version: ProposalVersion): string {
  const snap = version.intentSnapshot;
  if (isAnalysisSnapshotShape(snap)) {
    const parts = [snap.intention.summary.trim()];
    if (snap.intention.signals?.length) {
      parts.push(`Señales: ${snap.intention.signals.join(' · ')}`);
    }
    return parts.join('\n').slice(0, 2000);
  }
  if (snap && typeof snap === 'object' && !Array.isArray(snap)) {
    const o = snap as Record<string, unknown>;
    if (typeof o.summary === 'string' && o.summary.trim()) return o.summary.trim().slice(0, 2000);
    if (typeof o.intent === 'string' && o.intent.trim()) return o.intent.trim().slice(0, 2000);
  }
  if (typeof snap === 'string' && snap.trim()) return snap.trim().slice(0, 2000);
  if (snap != null) {
    try {
      return JSON.stringify(snap).slice(0, 2000);
    } catch {
      /* ignore */
    }
  }
  if (lead.message && lead.message.trim()) return lead.message.trim().slice(0, 2000);
  const ctx = lead.details?.currentContext;
  if (ctx && typeof ctx === 'object' && !Array.isArray(ctx)) {
    const c = ctx as Record<string, unknown>;
    if (typeof c.intent === 'string' && c.intent.trim()) return c.intent.trim().slice(0, 2000);
  }
  return '—';
}

function resolveProposalPdfPublicUrl(version: VersionBundle): string | null {
  if (version.pdfPublicUrl && version.pdfPublicUrl.trim()) return version.pdfPublicUrl.trim();
  const fromArtifact = version.artifacts.find((a) => a.kind === 'PDF' && a.publicUrl);
  if (fromArtifact?.publicUrl) return fromArtifact.publicUrl.trim();
  const base = config.PUBLIC_URL.replace(/\/$/, '');
  if (version.pdfStoragePath) {
    const p = version.pdfStoragePath.replace(/^\//, '');
    if (p && !p.startsWith('..')) return `${base}/${p}`;
  }
  const art = version.artifacts.find((a) => a.kind === 'PDF');
  if (art?.storagePath) {
    const p = art.storagePath.replace(/^\//, '');
    if (p && !p.startsWith('..')) return `${base}/${p}`;
  }
  return null;
}

function tripsByScore(trips: VersionBundle['trips']): VersionBundle['trips'] {
  return [...trips].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

function budgetDurationLineFromTrips(trips: VersionBundle['trips']): string | null {
  const sorted = tripsByScore(trips);
  const t = sorted[0]?.travelTrip;
  if (!t) return null;
  const parts: string[] = [];
  if (t.durationDays != null) parts.push(`${t.durationDays} días`);
  if (t.durationNights != null) parts.push(`${t.durationNights} noches`);
  if (t.indicativePrice != null) {
    const money =
      t.currency && t.currency.trim()
        ? `${String(t.indicativePrice)} ${t.currency.trim()}`
        : String(t.indicativePrice);
    parts.push(`desde ${money}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

function primaryIntentLine(
  lead: Lead & { details: { currentContext: Prisma.JsonValue | null } | null },
  version: ProposalVersion,
  trips: VersionBundle['trips'],
): string {
  const snap = version.intentSnapshot;
  if (isAnalysisSnapshotShape(snap)) {
    const fromTrips = snap.recommendedTrips?.map((x) => x?.mainDestination?.trim()).find(Boolean);
    if (fromTrips) return fromTrips;
    return snap.intention.summary.trim().slice(0, 240);
  }
  const sorted = tripsByScore(trips);
  const md = sorted[0]?.travelTrip?.mainDestination?.trim();
  if (md) return md;
  const summary = buildIntentSummary(lead, version);
  const line = summary.split('\n')[0]?.trim();
  return line && line !== '—' ? line.slice(0, 240) : '—';
}

function topOptionLines(trips: VersionBundle['trips']): string[] {
  const sorted = tripsByScore(trips);
  return sorted.slice(0, 5).map((pt, i) => {
    const t = pt.travelTrip;
    const dest = t.mainDestination ? ` — ${t.mainDestination}` : '';
    const price =
      t.indicativePrice != null && t.currency
        ? ` (${String(t.indicativePrice)} ${t.currency})`
        : t.indicativePrice != null
          ? ` (${String(t.indicativePrice)})`
          : '';
    return `${i + 1}. ${t.title}${dest}${price}`;
  });
}

export type NotifySellerRecipientKind = 'ASSIGNED_USER' | 'COMPANY_ADMIN_FALLBACK';

async function resolveRecipients(
  companyId: string,
  assignedUserId: string | null
): Promise<{ users: User[]; recipientKind: NotifySellerRecipientKind }> {
  if (assignedUserId) {
    const u = await prisma.user.findFirst({
      where: { id: assignedUserId, companyId, status: 'ACTIVE' },
    });
    if (u) return { users: [u], recipientKind: 'ASSIGNED_USER' };
    logger.warn(
      { companyId, assignedUserId },
      'Lead con asignado inválido o inactivo; se notifica a administradores de empresa'
    );
  }
  const admins = await prisma.user.findMany({
    where: { companyId, role: 'COMPANY_ADMIN', status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });
  return { users: admins, recipientKind: 'COMPANY_ADMIN_FALLBACK' };
}

export class SellerNotificationService {
  /**
   * Carga contexto tenant-safe y despacha notificaciones. No lanza por fallos de canal;
   * el llamador puede registrar actividades según el resultado.
   */
  async notifyProposalReady(params: {
    companyId: string;
    leadId: string;
    proposalId: string;
    proposalVersionId: string;
  }): Promise<{
    payload: ProposalReadyDispatchPayload;
    channelResults: ProposalReadyChannelResults;
    recipientKind: NotifySellerRecipientKind;
    recipientEmails: string[];
  }> {
    const { companyId, leadId, proposalId, proposalVersionId } = params;

    const version = await prisma.proposalVersion.findFirst({
      where: { id: proposalVersionId, companyId, proposalId },
      include: {
        proposal: {
          include: {
            lead: { include: { details: { select: { currentContext: true } } } },
          },
        },
        trips: { include: { travelTrip: true } },
        artifacts: { select: { kind: true, publicUrl: true, storagePath: true } },
      },
    });

    if (!version) {
      throw new Error('PROPOSAL_VERSION_NOT_FOUND');
    }

    const bundle = version as unknown as VersionBundle;
    const lead = bundle.proposal.lead;
    if (lead.companyId !== companyId || lead.id !== leadId || bundle.proposal.companyId !== companyId) {
      logger.error({ companyId, leadId, proposalId }, 'notifyProposalReady: incoherencia tenant/lead');
      throw new Error('TENANT_MISMATCH');
    }

    const { users, recipientKind } = await resolveRecipients(companyId, lead.assignedUserId);
    const recipientEmails = users.map((u) => u.email).filter(Boolean);

    const payload: ProposalReadyDispatchPayload = {
      companyId,
      leadId,
      proposalId,
      proposalVersionId,
      leadDisplay: leadContactDisplay(lead),
      clientContactLines: clientContactLinesFromLead(lead),
      primaryIntentLine: primaryIntentLine(lead, version, bundle.trips),
      budgetDurationLine: budgetDurationLineFromTrips(bundle.trips),
      intentSummary: buildIntentSummary(lead, version),
      topOptionsLines: topOptionLines(bundle.trips),
      leadUrl: buildLeadAppUrl(leadId),
      proposalAppUrl: buildProposalAppUrl(leadId),
      proposalPdfUrl: resolveProposalPdfPublicUrl(bundle),
    };

    const recipients = users.map((u) => ({
      email: u.email,
      firstName: u.firstName,
    }));

    let channelResults: ProposalReadyChannelResults;
    try {
      channelResults = await dispatchProposalReadyEvent({ payload, recipients });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      logger.error({ companyId, leadId, err }, 'dispatchProposalReadyEvent falló de forma inesperada');
      channelResults = {
        email: { ok: false, error: err },
        webhook: { ok: false, error: err },
        in_app: { ok: false, error: err },
        slack: { ok: false, error: err },
        teams: { ok: false, error: err },
      };
    }

    return { payload, channelResults, recipientKind, recipientEmails };
  }

  /** Persiste SELLER_NOTIFIED con el resultado agregado de canales (email, stubs, etc.). */
  async recordSellerNotifiedActivity(params: {
    companyId: string;
    leadId: string;
    proposalVersionId: string;
    recipientKind: NotifySellerRecipientKind;
    recipientEmails: string[];
    channelResults: ProposalReadyChannelResults;
  }): Promise<void> {
    const email = params.channelResults.email;
    const perRecipient = email.perRecipient;
    const failed = perRecipient?.filter((x) => !x.ok) ?? [];
    const okRecipients = perRecipient?.filter((x) => x.ok) ?? [];

    let title: string;
    let description: string | null = null;
    if (email.error === 'NO_RECIPIENTS' || params.recipientEmails.length === 0) {
      title = 'Notificación a vendedores omitida (sin destinatarios)';
      description =
        'No hay usuario asignado activo ni administradores de empresa activos para enviar el aviso.';
    } else if (email.ok) {
      title = 'Notificación a vendedores enviada (email)';
    } else if (okRecipients.length > 0 && failed.length > 0) {
      title = 'Notificación parcial: algunos correos fallaron';
      description = failed.map((f) => `${f.to}: ${f.error ?? 'error desconocido'}`).join('; ').slice(0, 2000);
    } else {
      title = 'Fallo al notificar vendedores por email';
      description =
        failed.length > 0
          ? failed.map((f) => `${f.to}: ${f.error ?? '?'}`).join('; ').slice(0, 2000)
          : (email.error ?? 'Error desconocido').slice(0, 2000);
    }

    await prisma.leadActivity.create({
      data: {
        companyId: params.companyId,
        leadId: params.leadId,
        actorType: LeadActorType.SYSTEM,
        activityType: LeadActivityType.SELLER_NOTIFIED,
        title,
        description,
        metadata: {
          proposalVersionId: params.proposalVersionId,
          recipientKind: params.recipientKind,
          recipientEmails: params.recipientEmails,
          emailOutcome: {
            sent: email.ok,
            aggregateError: email.error ?? null,
            failedRecipients: failed,
            okCount: okRecipients.length,
          },
          channels: params.channelResults,
          emailPerRecipient: perRecipient ?? null,
        } as Prisma.InputJsonValue,
      },
    });
  }
}

export const sellerNotificationService = new SellerNotificationService();
