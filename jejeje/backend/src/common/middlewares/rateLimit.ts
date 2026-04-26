import rateLimit from 'express-rate-limit';

const tooMany = {
  success: false,
  error: {
    code: 'TOO_MANY_ATTEMPTS',
    message: 'Has realizado demasiadas solicitudes. Inténtalo más tarde.',
  },
};

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  message: tooMany,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Restablecimiento: ventana más estricta por IP */
export const forgotPasswordIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: tooMany,
  standardHeaders: true,
  legacyHeaders: false,
});
