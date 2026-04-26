import { Router } from 'express';
import { AuditLogController } from './audit-log.controller';
import { requireAuth, requireRole } from '../../common/middlewares/auth';

const router = Router();
const auditLogController = new AuditLogController();

router.use(requireAuth);
router.use(requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']));

router.get('/', auditLogController.getAuditLogs.bind(auditLogController));

export default router;
