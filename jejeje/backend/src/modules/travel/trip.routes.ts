import { Router } from 'express';
import { requireAuth } from '../../common/middlewares/auth';
import { TravelTripController } from './trip.controller';

const router = Router();
const c = new TravelTripController();

router.use(requireAuth);
router.get('/search', c.search.bind(c));
router.post('/leads/:leadId/proposal', c.attachLeadProposal.bind(c));
router.get('/', c.list.bind(c));
router.post('/manual', c.createManual.bind(c));
router.get('/:id', c.getOne.bind(c));
router.patch('/:id', c.patch.bind(c));
router.post('/:id/approve', c.approve.bind(c));
router.post('/:id/reject', c.reject.bind(c));

export default router;
