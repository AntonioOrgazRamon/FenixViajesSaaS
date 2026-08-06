import rateLimit from 'express-rate-limit';
import { config } from '../config';

/** Límite por IP para rutas que disparan OpenAI (capa adicional al guard interno). */
export const openaiSensitiveIpLimiter = rateLimit({
  windowMs: 60_000,
  max: config.OPENAI_HTTP_RATE_PER_IP_PER_MIN,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Demasiadas peticiones; reintente luego.' } },
});
