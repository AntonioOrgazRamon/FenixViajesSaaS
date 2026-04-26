import { Request, Response } from 'express';
import { CompanyService } from './company.service';
import { createCompanySchema, updateCompanySchema } from './company.schema';
import { ValidationError } from '../../common/errors/AppError';

const companyService = new CompanyService();

export class CompanyController {
  async create(req: Request, res: Response) {
    if (!req.user) throw new ValidationError('No autenticado');
    const parsed = createCompanySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);

    const result = await companyService.create(parsed.data, req.user.id);
    res.status(201).json({ success: true, data: result });
  }

  async findAll(req: Request, res: Response) {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 10));
    const q = (req.query.q as string) || (req.query.search as string) || undefined;
    const status = (req.query.status as string) || undefined;

    const num = (k: string) => {
      const v = req.query[k];
      if (v == null || v === '') return undefined;
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };

    const result = await companyService.findAll(page, pageSize, {
      q: typeof q === 'string' ? q : undefined,
      status,
      leadsMin: num('leadsMin'),
      leadsMax: num('leadsMax'),
      usersMin: num('usersMin'),
      usersMax: num('usersMax'),
    });
    res.json({ success: true, data: result });
  }

  async findById(req: Request, res: Response) {
    const result = await companyService.findById(req.params.id as string);
    res.json({ success: true, data: result });
  }

  async update(req: Request, res: Response) {
    if (!req.user) throw new ValidationError('No autenticado');
    const parsed = updateCompanySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);

    const result = await companyService.update(req.params.id as string, parsed.data, req.user.id);
    res.json({ success: true, data: result });
  }

  async suspend(req: Request, res: Response) {
    if (!req.user) throw new ValidationError('No autenticado');
    const result = await companyService.suspend(req.params.id as string, req.body.reason, req.user.id);
    res.json({ success: true, data: result });
  }

  async reactivate(req: Request, res: Response) {
    if (!req.user) throw new ValidationError('No autenticado');
    const result = await companyService.reactivate(req.params.id as string, req.body.reason, req.user.id);
    res.json({ success: true, data: result });
  }

  async delete(req: Request, res: Response) {
    if (!req.user) throw new ValidationError('No autenticado');
    const result = await companyService.delete(req.params.id as string, req.body.reason, req.user.id);
    res.json({ success: true, data: result });
  }
}
