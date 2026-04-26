import { Router } from 'express';
import { SessionController } from './session.controller';
import { requireAuth } from '../../common/middlewares/auth';

const router = Router();
const sessionController = new SessionController();

router.use(requireAuth);

router.get('/', sessionController.getSessions.bind(sessionController));
router.post('/revoke-others', sessionController.revokeOtherSessions.bind(sessionController));
router.post('/:id/revoke', sessionController.revokeSession.bind(sessionController));
router.post('/user/:userId/revoke', sessionController.revokeUserSessions.bind(sessionController));

export default router;
