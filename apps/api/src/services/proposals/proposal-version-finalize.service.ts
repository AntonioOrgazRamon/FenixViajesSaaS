import {
  LeadActorType,
  LeadActivityType,
  Prisma,
  ProposalStatus,
} from '@prisma/client';
import prisma from '../../infrastructure/db';
import { NotFoundError } from '../../common/errors/AppError';
import { logger } from '../../common/logger';
import { sellerNotificationService } from '../../infrastructure/notifications/seller-notification.service';
import type { ProposalReadyChannelResults } from '../../infrastructure/notifications/notification.types';
import type { NotifySellerRecipientKind } from '../../infrastructure/notifications/seller-notification.service';

export type FinalizeProposalVersionParams = {
  companyId: string;
  leadId: string;
  proposalId: string;
  proposalVersionId: string;
  actorUserId?: string;
};

export type FinalizeProposalVersionResult =
  | { duplicate: true }
  | {
      duplicate: false;
      recipientKind: NotifySellerRecipientKind;
      recipientEmails: string[];
      channelResults: ProposalReadyChannelResults;
    };

async function dispatchProposalSellerNotifications(params: FinalizeProposalVersionParams): Promise<void> {
  const { companyId, leadId, proposalId, proposalVersionId } = params;
  try {
    const r = await sellerNotificationService.notifyProposalReady({
      companyId,
      leadId,
      proposalId,
      proposalVersionId,
    });
    try {
      await sellerNotificationService.recordSellerNotifiedActivity({
        companyId,
        leadId,
        proposalVersionId,
        recipientKind: r.recipientKind,
        recipientEmails: r.recipientEmails,
        channelResults: r.channelResults,
      });
    } catch (persistErr) {
      logger.error({ err: persistErr }, 'No se pudo registrar LeadActivity SELLER_NOTIFIED tras envío');
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error(
      { err: e, companyId, leadId, proposalVersionId },
      'Notificación a vendedores (async): error no bloqueante',
    );
    try {
      await prisma.leadActivity.create({
        data: {
          companyId,
          leadId,
          actorType: LeadActorType.SYSTEM,
          activityType: LeadActivityType.SELLER_NOTIFIED,
          title: 'Fallo al notificar vendedores por email',
          description: errMsg.slice(0, 2000),
          metadata: {
            proposalVersionId,
            error: errMsg,
            failedPhase: 'NOTIFY',
          } as Prisma.InputJsonValue,
        },
      });
    } catch (inner) {
      logger.error({ err: inner }, 'No se pudo persistir SELLER_NOTIFIED de error');
    }
  }
}

const ASYNC_PENDING_CHANNELS: ProposalReadyChannelResults = {
  email: { ok: true, pendingAsync: true },
  webhook: { ok: true, skipped: true },
  in_app: { ok: true, skipped: true },
  slack: { ok: true, skipped: true },
  teams: { ok: true, skipped: true },
};

/**
 * Tras persistir una `ProposalVersion`: marca `GENERATED` + actividad (sync).
 * Las notificaciones a vendedores se despachan **en segundo plano** para no bloquear la respuesta HTTP ni la generación.
 */
export async function finalizeProposalVersionGeneration(
  params: FinalizeProposalVersionParams,
): Promise<FinalizeProposalVersionResult> {
  const { companyId, leadId, proposalId, proposalVersionId, actorUserId } = params;

  const version = await prisma.proposalVersion.findFirst({
    where: {
      id: proposalVersionId,
      companyId,
      proposalId,
      proposal: { leadId, companyId },
    },
    select: { id: true },
  });
  if (!version) {
    throw new NotFoundError('Versión de propuesta no encontrada o no pertenece al lead');
  }

  const recentProposalActs = await prisma.leadActivity.findMany({
    where: {
      companyId,
      leadId,
      activityType: LeadActivityType.PROPOSAL_GENERATED,
    },
    select: { id: true, metadata: true },
    orderBy: { createdAt: 'desc' },
    take: 80,
  });
  const existing = recentProposalActs.find((a) => {
    const m = a.metadata;
    if (m == null || typeof m !== 'object' || Array.isArray(m)) return false;
    return (m as Record<string, unknown>).proposalVersionId === proposalVersionId;
  });

  if (existing) {
    logger.info(
      { proposalVersionId, leadId, companyId },
      'finalizeProposalVersionGeneration: ya existía PROPOSAL_GENERATED para esta versión',
    );
    return { duplicate: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposalId, companyId },
      data: { status: ProposalStatus.GENERATED },
    });
    await tx.leadActivity.create({
      data: {
        companyId,
        leadId,
        actorUserId: actorUserId ?? null,
        actorType: actorUserId ? LeadActorType.USER : LeadActorType.SYSTEM,
        activityType: LeadActivityType.PROPOSAL_GENERATED,
        title: 'Propuesta generada',
        metadata: {
          proposalId,
          proposalVersionId,
        } as Prisma.InputJsonValue,
      },
    });
  });

  void dispatchProposalSellerNotifications(params).catch((err) =>
    logger.error({ err, ...params }, 'dispatchProposalSellerNotifications'),
  );

  return {
    duplicate: false,
    recipientKind: 'COMPANY_ADMIN_FALLBACK',
    recipientEmails: [],
    channelResults: ASYNC_PENDING_CHANNELS,
  };
}
