import { Router } from 'express';
import { ProposalController } from './proposal.controller';
import { ProposalLibraryController } from './proposal-library.controller';
import { requireAuth, requireRole } from '../../common/middlewares/auth';
import { requireCompanyMember } from '../../common/middlewares/requireCompany';
import { openaiSensitiveIpLimiter } from '../../common/middlewares/openai-sensitive-limiter';

const router = Router();
const c = new ProposalController();
const lib = new ProposalLibraryController();

router.use(requireAuth);

router.get(
  '/library',
  requireRole(['COMPANY_ADMIN', 'COMPANY_USER', 'SUPER_ADMIN']),
  lib.list.bind(lib),
);
router.get(
  '/library/:proposalId/pdf',
  requireRole(['COMPANY_ADMIN', 'COMPANY_USER', 'SUPER_ADMIN']),
  lib.downloadPdf.bind(lib),
);
router.patch(
  '/library/:proposalId',
  requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']),
  lib.patchHeader.bind(lib),
);
router.post(
  '/library/:proposalId/notify-sellers',
  requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']),
  lib.notifySellers.bind(lib),
);
router.get(
  '/library/:proposalId',
  requireRole(['COMPANY_ADMIN', 'COMPANY_USER', 'SUPER_ADMIN']),
  lib.detail.bind(lib),
);

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
