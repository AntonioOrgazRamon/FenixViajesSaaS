import rateLimit from 'express-rate-limit';
import { config } from '../config';

/**
 * Rate limit para endpoints admin de embeddings / retrieval preview (por IP).
 */
export const travelEmbeddingAdminLimiter = rateLimit({
  windowMs: 60_000,
  max: config.TRAVEL_EMBEDDING_ADMIN_RATE_PER_MIN,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiadas peticiones; reintente en un minuto.' },
});
