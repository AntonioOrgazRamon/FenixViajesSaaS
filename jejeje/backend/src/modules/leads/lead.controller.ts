import { Request, Response } from 'express';
import { LeadService } from './lead.service';
import {
  createNoteSchema,
  listLeadsQuerySchema,
  patchLeadDetailsSchema,
  patchLeadSchema,
  patchNoteSchema,
  runAgentsSchema,
} from './lead.schema';
import { ValidationError } from '../../common/errors/AppError';

const leadService = new LeadService();

export class LeadController {
  async list(req: Request, res: Response) {
    const parsed = listLeadsQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Query inválida');
    const companyId = req.user!.companyId!;
    const data = await leadService.list(companyId, parsed.data);
    res.json({ success: true, data });
  }

  async getOne(req: Request, res: Response) {
    const companyId = req.user!.companyId!;
    const bundle = await leadService.getDetailBundle(companyId, req.params.leadId as string);
    res.json({ success: true, data: bundle });
  }

  async patch(req: Request, res: Response) {
    const parsed = patchLeadSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Body inválido');
    const companyId = req.user!.companyId!;
    const user = req.user!;
    const lead = await leadService.updateLead(companyId, req.params.leadId as string, parsed.data, user.id, user.role);
    res.json({ success: true, data: lead });
  }

  async patchDetails(req: Request, res: Response) {
    const parsed = patchLeadDetailsSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Body inválido');
    const companyId = req.user!.companyId!;
    const user = req.user!;
    const details = await leadService.updateDetails(
      companyId,
      req.params.leadId as string,
      parsed.data,
      user.id,
      user.role,
    );
    res.json({ success: true, data: details });
  }

  async listActivities(req: Request, res: Response) {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.page_size as string, 10) || 20, 100);
    const companyId = req.user!.companyId!;
    const data = await leadService.listActivities(companyId, req.params.leadId as string, page, pageSize);
    res.json({ success: true, data });
  }

  async listNotes(req: Request, res: Response) {
    const companyId = req.user!.companyId!;
    const notes = await leadService.listNotes(companyId, req.params.leadId as string);
    res.json({ success: true, data: notes });
  }

  async createNote(req: Request, res: Response) {
    const parsed = createNoteSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Body inválido');
    const companyId = req.user!.companyId!;
    const user = req.user!;
    const note = await leadService.createNote(
      companyId,
      req.params.leadId as string,
      parsed.data.content,
      user.id,
      user.role,
    );
    res.status(201).json({ success: true, data: note });
  }

  async patchNote(req: Request, res: Response) {
    const parsed = patchNoteSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Body inválido');
    const companyId = req.user!.companyId!;
    const user = req.user!;
    const note = await leadService.updateNote(
      companyId,
      req.params.leadId as string,
      req.params.noteId as string,
      parsed.data.content,
      user.id,
      user.role,
    );
    res.json({ success: true, data: note });
  }

  async deleteNote(req: Request, res: Response) {
    const companyId = req.user!.companyId!;
    const user = req.user!;
    const data = await leadService.deleteNote(
      companyId,
      req.params.leadId as string,
      req.params.noteId as string,
      user.id,
      user.role,
    );
    res.json({ success: true, data });
  }

  async listAgentRuns(req: Request, res: Response) {
    const companyId = req.user!.companyId!;
    const runs = await leadService.listAgentRuns(companyId, req.params.leadId as string);
    res.json({ success: true, data: runs });
  }

  async runAgents(req: Request, res: Response) {
    const parsed = runAgentsSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Body inválido');
    const companyId = req.user!.companyId!;
    const user = req.user!;
    const runs = await leadService.runAgentsManual(
      companyId,
      req.params.leadId as string,
      user.id,
      user.role,
      parsed.data.agent_keys,
    );
    res.status(201).json({ success: true, data: runs });
  }
}
