import { Router } from 'express';
import { ProposalController } from './proposal.controller';
import { requireAuth, requireRole } from '../../common/middlewares/auth';
import { requireCompanyMember } from '../../common/middlewares/requireCompany';
import { openaiSensitiveIpLimiter } from '../../common/middlewares/openai-sensitive-limiter';

const router = Router();
const c = new ProposalController();

router.use(requireAuth);
router.use(requireRole(['COMPANY_ADMIN', 'COMPANY_USER']));
router.use(requireCompanyMember);

router.post(
  '/:leadId/versions/:proposalId/:versionId/finalize',
  openaiSensitiveIpLimiter,
  c.finalizeGeneration.bind(c),
);
router.post('/:leadId/generate', openaiSensitiveIpLimiter, c.generateForLead.bind(c));
router.get('/:proposalId/pdf', c.downloadPdf.bind(c));
router.get('/:proposalId', c.getOne.bind(c));

export default router;
