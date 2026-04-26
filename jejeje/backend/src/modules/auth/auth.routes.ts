import { Router } from 'express';
import { AuthController } from './auth.controller';
import { requireAuth } from '../../common/middlewares/auth';
import { authRateLimiter, forgotPasswordIpLimiter } from '../../common/middlewares/rateLimit';

const router = Router();
const authController = new AuthController();

router.post('/login', authRateLimiter, authController.login.bind(authController));
router.post('/logout', requireAuth, authController.logout.bind(authController));
router.post('/refresh', authRateLimiter, authController.refresh.bind(authController));
router.get('/me', requireAuth, authController.me.bind(authController));

// Profile (usually under /api/v1/profile, but can be here or in a separate module)
router.get('/profile', requireAuth, authController.getProfile.bind(authController));
router.patch('/profile', requireAuth, authController.updateProfile.bind(authController));
router.post('/change-password', requireAuth, authController.changePassword.bind(authController));

// Flujo de restablecimiento (IP limitada; anti-abuso por buzón en el servicio)
router.post(
  '/forgot-password',
  forgotPasswordIpLimiter,
  authController.requestPasswordReset.bind(authController)
);
router.post(
  '/verify-reset-token',
  forgotPasswordIpLimiter,
  authController.verifyResetToken.bind(authController)
);
router.post(
  '/reset-password',
  forgotPasswordIpLimiter,
  authController.resetPassword.bind(authController)
);

router.get('/google/start', (_req, res) => {
  res.status(501).json({
    success: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'OAuth Google pendiente de configuración en el servidor' },
  });
});
router.get('/google/callback', (_req, res) => {
  res.status(501).json({
    success: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'OAuth Google pendiente de configuración en el servidor' },
  });
});

export default router;
