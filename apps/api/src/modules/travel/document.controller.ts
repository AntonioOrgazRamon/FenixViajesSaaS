import { Request, Response } from 'express';
import { TravelDocumentService } from './document.service';
import { assertCatalogAdmin, resolveTenantCompanyId } from '../../common/company-context';

const svc = new TravelDocumentService();

export class TravelDocumentController {
  async upload(req: Request, res: Response) {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    if (!req.file) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Archivo requerido' } });
    }
    const r = await svc.createFromUpload({
      companyId,
      originalName: req.file.originalname,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
    return res.status(201).json({
      success: true,
      data: { documentId: r.documentId, filename: r.filename, status: r.status },
    });
  }

  async list(req: Request, res: Response) {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const data = await svc.list(companyId, page, pageSize);
    return res.json({ success: true, data });
  }

  async getOne(req: Request, res: Response) {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    const data = await svc.getById(String(req.params.id), companyId);
    return res.json({ success: true, data });
  }

  async process(req: Request, res: Response) {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    const { jobId } = await svc.startProcess(String(req.params.id), companyId);
    return res.status(202).json({ success: true, data: { jobId, status: 'PENDING' } });
  }

  async jobStatus(req: Request, res: Response) {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    const data = await svc.getJob(String(req.params.jobId), companyId);
    return res.json({ success: true, data });
  }

  async remove(req: Request, res: Response) {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    await svc.removeById(String(req.params.id), companyId);
    return res.status(204).send();
  }

  async clearAll(req: Request, res: Response) {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    const r = await svc.clearCompanyCatalog(companyId);
    return res.json({ success: true, data: r });
  }
}
