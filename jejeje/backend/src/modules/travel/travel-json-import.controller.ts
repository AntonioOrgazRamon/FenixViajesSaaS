import { Request, Response } from 'express';
import { z } from 'zod';
import { assertCatalogAdmin, assertPasteImportCompanyScope, resolveTenantCompanyId } from '../../common/company-context';
import { ValidationError } from '../../common/errors/AppError';
import { toJsonSafe } from '../../common/jsonSafe';
import { TravelJsonImportService } from './travel-json-import.service';

const svc = new TravelJsonImportService();

const patchItemBodyZ = z.object({
  normalizedJson: z.record(z.string(), z.unknown()),
});

const pasteBodyZ = z.object({
  companyId: z.string().optional(),
  fileName: z.string().max(500).optional(),
  jsonContent: z.string().min(1, 'jsonContent es obligatorio'),
});

function defaultPastedFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `pasted-json-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

export class TravelJsonImportController {
  upload = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    if (!req.user) return res.status(401).end();
    const companyId = resolveTenantCompanyId(req);
    if (!req.file) {
      throw new ValidationError('Archivo JSON requerido (campo file)');
    }
    const fileName = req.file.originalname || 'import.json';
    const batch = await svc.uploadBuffer({
      companyId,
      uploadedByUserId: req.user.id,
      fileName,
      buffer: req.file.buffer,
    });
    return res.status(201).json({ success: true, data: toJsonSafe(batch) });
  };

  paste = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    if (!req.user) return res.status(401).end();

    const parsed = pasteBodyZ.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || 'Body inválido');
    }

    assertPasteImportCompanyScope(req, parsed.data.companyId);

    const companyId = resolveTenantCompanyId(req);

    let fileName = parsed.data.fileName?.trim();
    if (!fileName) {
      fileName = defaultPastedFileName();
    }
    if (!fileName.toLowerCase().endsWith('.json')) {
      fileName = `${fileName}.json`;
    }

    const batch = await svc.pasteJsonContent({
      companyId,
      uploadedByUserId: req.user.id,
      fileName,
      jsonContent: parsed.data.jsonContent,
    });
    return res.status(201).json({ success: true, data: toJsonSafe(batch) });
  };

  listBatches = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const data = await svc.listBatches(companyId, page, pageSize);
    return res.json({ success: true, data: toJsonSafe(data) });
  };

  getBatch = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    const data = await svc.getBatchDetail(String(req.params.batchId), companyId);
    return res.json({ success: true, data: toJsonSafe(data) });
  };

  patchItem = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    const parsed = patchItemBodyZ.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || 'Body inválido');
    }
    const item = await svc.patchItem({
      itemId: String(req.params.itemId),
      companyId,
      normalizedPatch: parsed.data.normalizedJson,
    });
    return res.json({ success: true, data: toJsonSafe(item) });
  };

  importBatch = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    if (!req.user) return res.status(401).end();
    const companyId = resolveTenantCompanyId(req);
    const data = await svc.importBatch({
      batchId: String(req.params.batchId),
      companyId,
      actorUserId: req.user.id,
      actorRole: req.user.role,
      ipAddress: req.ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    });
    return res.json({ success: true, data: toJsonSafe(data) });
  };

  deleteBatch = async (req: Request, res: Response) => {
    assertCatalogAdmin(req);
    const companyId = resolveTenantCompanyId(req);
    await svc.deleteBatch(String(req.params.batchId), companyId);
    return res.status(204).send();
  };
}
