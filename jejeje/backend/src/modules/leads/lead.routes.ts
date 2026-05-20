import { Router } from 'express';
import { LeadController } from './lead.controller';
import { SmartProposalController } from './smart-proposal.controller';
import { requireAuth, requireRole } from '../../common/middlewares/auth';
import { requireCompanyMember } from '../../common/middlewares/requireCompany';
import { openaiSensitiveIpLimiter } from '../../common/middlewares/openai-sensitive-limiter';

const router = Router();
const c = new LeadController();
const sp = new SmartProposalController();

router.use(requireAuth);
router.use(requireRole(['COMPANY_ADMIN', 'COMPANY_USER']));
router.use(requireCompanyMember);

router.get('/', c.list.bind(c));
router.post('/', c.create.bind(c));
router.get('/:leadId/travel-profile', c.getTravelProfile.bind(c));
router.patch('/:leadId/travel-profile', c.patchTravelProfile.bind(c));
router.get('/:leadId/smart-proposal', sp.get.bind(sp));
router.post('/:leadId/smart-proposal/generate', openaiSensitiveIpLimiter, sp.generate.bind(sp));
router.post('/:leadId/smart-proposal/regenerate', openaiSensitiveIpLimiter, sp.regenerate.bind(sp));
router.get('/:leadId/smart-proposal/html', sp.getHtml.bind(sp));
router.get('/:leadId/smart-proposal/pdf', sp.downloadPdf.bind(sp));
router.patch('/:leadId/smart-proposal/vendor-notified', sp.markVendor.bind(sp));
router.get('/:leadId', c.getOne.bind(c));
router.patch('/:leadId', c.patch.bind(c));
router.patch('/:leadId/details', c.patchDetails.bind(c));
router.get('/:leadId/activities', c.listActivities.bind(c));
router.get('/:leadId/notes', c.listNotes.bind(c));
router.post('/:leadId/notes', c.createNote.bind(c));
router.patch('/:leadId/notes/:noteId', c.patchNote.bind(c));
router.delete('/:leadId/notes/:noteId', c.deleteNote.bind(c));
router.get('/:leadId/agent-runs', c.listAgentRuns.bind(c));
router.post('/:leadId/run-agents', openaiSensitiveIpLimiter, c.runAgents.bind(c));

export default router;
