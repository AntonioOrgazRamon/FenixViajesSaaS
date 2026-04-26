import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Limita cada IP a 10 peticiones de login/auth por ventana
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_ATTEMPTS',
      message: 'Demasiados intentos, por favor intente más tarde',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
