import { Request, Response } from 'express';
import path from 'path';
import { z } from 'zod';
import { resolveTenantCompanyId } from '../../common/company-context';
import { NotFoundError, ValidationError } from '../../common/errors/AppError';
import { ProposalLibraryService } from './proposal-library.service';
import { ProposalService } from './proposal.service';
import { patchProposalHeaderSchema } from './proposal.schema';

const libSvc = new ProposalLibraryService();
const proposalSvc = new ProposalService();

const libraryQueryZ = z.object({
  page: z.coerce.number().min(1).optional(),
  pageSize: z.coerce.number().min(1).max(48).optional(),
  status: z.enum(['DRAFT', 'GENERATED', 'SENT_TO_SELLER', 'SENT_TO_CLIENT', 'ARCHIVED']).optional(),
  preset: z.string().optional(),
  leadId: z.string().optional(),
  destination: z.string().optional(),
  hasPdf: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  hasHtml: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  q: z.string().optional(),
});

export class ProposalLibraryController {
  list = async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).end();
    const companyId = resolveTenantCompanyId(req);
    const parsed = libraryQueryZ.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Query inválida');
    }
    const data = await libSvc.list(companyId, parsed.data);
    return res.json({ success: true, data });
  };

  detail = async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).end();
    const companyId = resolveTenantCompanyId(req);
    const proposalId = String(req.params.proposalId);
    const data = await libSvc.detail(companyId, proposalId);
    if (!data) throw new NotFoundError('Propuesta no encontrada');
    return res.json({ success: true, data });
  };

  patchHeader = async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).end();
    const companyId = resolveTenantCompanyId(req);
    const proposalId = String(req.params.proposalId);
    const parsed = patchProposalHeaderSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Body inválido');
    }
    if (parsed.data.status == null && parsed.data.assignedUserId === undefined) {
      throw new ValidationError('Envía al menos status o assignedUserId');
    }
    const updated = await libSvc.patchHeader(companyId, proposalId, parsed.data);
    if (!updated) throw new NotFoundError('Propuesta no encontrada');
    return res.json({ success: true, data: updated });
  };

  notifySellers = async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).end();
    const companyId = resolveTenantCompanyId(req);
    const proposalId = String(req.params.proposalId);
    const data = await libSvc.notifySellersAgain(companyId, proposalId);
    return res.json({ success: true, data });
  };

  downloadPdf = async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).end();
    const companyId = resolveTenantCompanyId(req);
    const proposalId = String(req.params.proposalId);
    const rel = await proposalSvc.resolvePdfStoragePath(companyId, proposalId);
    if (!rel) {
      throw new NotFoundError('No hay PDF asociado a la última versión de esta propuesta');
    }
    const abs = path.join(process.cwd(), 'uploads', rel);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="proposal-${proposalId}.pdf"`);
    return res.sendFile(abs);
  };
}
