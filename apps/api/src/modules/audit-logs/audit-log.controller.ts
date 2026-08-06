import { Request, Response } from 'express';
import { AuditLogService } from './audit-log.service';
import { getAuditLogsSchema } from './audit-log.schema';
import { ValidationError, ForbiddenError } from '../../common/errors/AppError';

const auditLogService = new AuditLogService();

export class AuditLogController {
  async getAuditLogs(req: Request, res: Response) {
    const parsed = getAuditLogsSchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);

    const filters = { ...parsed.data };
    
    if (req.user?.role === 'COMPANY_ADMIN') {
      filters.companyId = req.user.companyId!;
    } else if (req.user?.role === 'COMPANY_USER') {
      throw new ForbiddenError('No tienes permiso para ver los logs de auditoría');
    }

    const { page, pageSize, ...restFilters } = filters;
    const result = await auditLogService.getAuditLogs(restFilters, page, pageSize);
    
    res.json({ success: true, data: result });
  }
}
