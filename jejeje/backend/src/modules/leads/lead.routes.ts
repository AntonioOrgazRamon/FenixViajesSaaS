import { Router } from 'express';
import { LeadController } from './lead.controller';
import { requireAuth, requireRole } from '../../common/middlewares/auth';
import { requireCompanyMember } from '../../common/middlewares/requireCompany';

const router = Router();
const c = new LeadController();

router.use(requireAuth);
router.use(requireRole(['COMPANY_ADMIN', 'COMPANY_USER']));
router.use(requireCompanyMember);

router.get('/', c.list.bind(c));
router.get('/:leadId', c.getOne.bind(c));
router.patch('/:leadId', c.patch.bind(c));
router.patch('/:leadId/details', c.patchDetails.bind(c));
router.get('/:leadId/activities', c.listActivities.bind(c));
router.get('/:leadId/notes', c.listNotes.bind(c));
router.post('/:leadId/notes', c.createNote.bind(c));
router.patch('/:leadId/notes/:noteId', c.patchNote.bind(c));
router.delete('/:leadId/notes/:noteId', c.deleteNote.bind(c));
router.get('/:leadId/agent-runs', c.listAgentRuns.bind(c));
router.post('/:leadId/run-agents', c.runAgents.bind(c));

export default router;
