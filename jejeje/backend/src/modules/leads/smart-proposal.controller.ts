import { Request, Response } from 'express';
import { SmartProposalService } from './smart-proposal.service';

const svc = new SmartProposalService();

export class SmartProposalController {
  get = async (req: Request, res: Response) => {
    const companyId = req.user!.companyId!;
    const role = req.user!.role;
    const leadId = String(req.params.leadId);
    const data = await svc.getState(companyId, leadId, role);
    res.json({ success: true, data });
  };

  generate = async (req: Request, res: Response) => {
    const companyId = req.user!.companyId!;
    const userId = req.user!.id;
    const role = req.user!.role;
    const leadId = String(req.params.leadId);
    const data = await svc.generate(companyId, leadId, userId, role);
    res.json({ success: true, data });
  };

  regenerate = async (req: Request, res: Response) => {
    const companyId = req.user!.companyId!;
    const userId = req.user!.id;
    const role = req.user!.role;
    const leadId = String(req.params.leadId);
    const data = await svc.regenerate(companyId, leadId, userId, role);
    res.json({ success: true, data });
  };

  getHtml = async (req: Request, res: Response) => {
    const companyId = req.user!.companyId!;
    const leadId = String(req.params.leadId);
    const html = await svc.getHtml(companyId, leadId);
    res.json({ success: true, data: { html } });
  };

  downloadPdf = async (req: Request, res: Response) => {
    const companyId = req.user!.companyId!;
    const leadId = String(req.params.leadId);
    const abs = await svc.resolvePdfAbsolutePath(companyId, leadId);
    if (!abs) {
      return res.status(404).json({ success: false, error: { message: 'PDF no disponible' } });
    }
    res.download(abs, `propuesta-${leadId}.pdf`);
  };

  markVendor = async (req: Request, res: Response) => {
    const companyId = req.user!.companyId!;
    const userId = req.user!.id;
    const role = req.user!.role;
    const leadId = String(req.params.leadId);
    const data = await svc.markVendorNotified(companyId, leadId, userId, role);
    res.json({ success: true, data });
  };
}
