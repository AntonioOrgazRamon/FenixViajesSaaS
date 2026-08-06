import { Router } from 'express';
import { SessionController } from './session.controller';
import { requireAuth, requireRole } from '../../common/middlewares/auth';

const router = Router();
const sessionController = new SessionController();

router.use(requireAuth);

router.get('/', sessionController.getSessions.bind(sessionController));
router.post('/revoke-others', sessionController.revokeOtherSessions.bind(sessionController));
router.post('/:id/revoke', sessionController.revokeSession.bind(sessionController));
router.use(requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']));
router.post('/user/:userId/revoke', sessionController.revokeUserSessions.bind(sessionController));

export default router;
