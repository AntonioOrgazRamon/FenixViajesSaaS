import { Router } from 'express';
import { PublicLeadController } from './public-lead.controller';
import rateLimit from 'express-rate-limit';

const router = Router();
const intakeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: {
    success: false,
    error: { code: 'TOO_MANY_ATTEMPTS', message: 'Demasiadas solicitudes de intake' },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const publicLead = new PublicLeadController();

router.post('/leads/intake', intakeRateLimiter, publicLead.intake.bind(publicLead));

export default router;
