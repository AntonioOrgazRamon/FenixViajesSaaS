import { Request, Response } from 'express';
import path from 'path';
import { ProposalService } from './proposal.service';
import { generateProposalSchema } from './proposal.schema';
import { NotFoundError, ValidationError } from '../../common/errors/AppError';
import { finalizeProposalVersionGeneration } from '../../services/proposals/proposal-version-finalize.service';

const svc = new ProposalService();

export class ProposalController {
  generateForLead = async (req: Request, res: Response) => {
    const parsed = generateProposalSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Body inválido');
    }
    const companyId = req.user!.companyId!;
    const userId = req.user!.id;
    const leadId = req.params.leadId as string;
    const data = await svc.generateForLead(companyId, leadId, userId, parsed.data);
    return res.status(201).json({ success: true, data });
  };

  getOne = async (req: Request, res: Response) => {
    const companyId = req.user!.companyId!;
    const proposalId = req.params.proposalId as string;
    const data = await svc.getById(companyId, proposalId);
    return res.json({ success: true, data });
  };

  downloadPdf = async (req: Request, res: Response) => {
    const companyId = req.user!.companyId!;
    const proposalId = req.params.proposalId as string;
    const rel = await svc.resolvePdfStoragePath(companyId, proposalId);
    if (!rel) {
      throw new NotFoundError('No hay PDF asociado a la última versión de esta propuesta');
    }
    const abs = path.join(process.cwd(), 'uploads', rel);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="proposal-${proposalId}.pdf"`);
    return res.sendFile(abs);
  };

  /**
   * Hook tras pipelines asíncronos: valida tenant, notifica vendedores/admins y deja actividad `SELLER_NOTIFIED`.
   */
  finalizeGeneration = async (req: Request, res: Response) => {
    const companyId = req.user!.companyId!;
    const userId = req.user!.id;
    const leadId = req.params.leadId as string;
    const proposalId = req.params.proposalId as string;
    const versionId = req.params.versionId as string;

    const result = await finalizeProposalVersionGeneration({
      companyId,
      leadId,
      proposalId,
      proposalVersionId: versionId,
      actorUserId: userId,
    });

    if (result.duplicate) {
      return res.json({
        success: true,
        data: { proposalId, proposalVersionId: versionId, duplicate: true },
      });
    }

    return res.json({
      success: true,
      data: {
        proposalId,
        proposalVersionId: versionId,
        duplicate: false,
        recipientKind: result.recipientKind,
        recipientEmails: result.recipientEmails,
        channelResults: result.channelResults,
        sellerNotificationPendingAsync: result.channelResults.email.pendingAsync === true,
      },
    });
  };
}
