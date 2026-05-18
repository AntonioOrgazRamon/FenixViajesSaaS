import { Router } from 'express';
import { requireAuth, requireRole } from '../../common/middlewares/auth';
import { OpenAiUsageAdminController } from './openai-usage-admin.controller';

const router = Router();
const c = new OpenAiUsageAdminController();

router.use(requireAuth);
router.use(requireRole(['SUPER_ADMIN']));

router.get('/usage', c.getUsage.bind(c));
router.get('/budget', c.getBudget.bind(c));
router.patch('/budget', c.patchBudget.bind(c));
router.post('/kill-switch', c.postKillSwitch.bind(c));
router.get('/alerts', c.getAlerts.bind(c));

export default router;
