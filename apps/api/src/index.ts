import path from 'path';
import express from 'express';
import 'express-async-errors';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './common/config';
import { logger } from './common/logger';
import { requestIdMiddleware } from './common/middlewares/requestId';
import { errorHandler } from './common/middlewares/errorHandler';

import authRoutes from './modules/auth/auth.routes';
import companyRoutes from './modules/companies/company.routes';
import userRoutes from './modules/users/user.routes';
import sessionRoutes from './modules/sessions/session.routes';
import auditLogRoutes from './modules/audit-logs/audit-log.routes';
import leadRoutes from './modules/leads/lead.routes';
import publicRoutes from './modules/public/public.routes';
import profileRoutes from './modules/profile/profile.routes';
import travelDocumentRoutes from './modules/travel/document.routes';
import travelTripRoutes from './modules/travel/trip.routes';
import travelJsonImportRoutes from './modules/travel/travel-json-import.routes';
import proposalRoutes from './modules/proposals/proposal.routes';
import openaiUsageAdminRoutes from './modules/openai-usage/openai-usage-admin.routes';
import { apiDocs } from './api-docs';

const app = express();
const allowedOrigins = new Set(
  [
    config.FRONTEND_BASE_URL,
    ...(config.CORS_ALLOWED_ORIGINS
      ? config.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
      : []),
  ].map((o) => o.replace(/\/$/, '')),
);
if (config.NODE_ENV === 'development') {
  allowedOrigins.add('http://localhost:5173');
  allowedOrigins.add('http://localhost:5174');
  allowedOrigins.add('http://localhost:5175');
  allowedOrigins.add('http://127.0.0.1:5173');
  allowedOrigins.add('http://127.0.0.1:5174');
  allowedOrigins.add('http://127.0.0.1:5175');
  // apps/lead-capture-widget (Angular, captación de leads), independiente de apps/panel
  allowedOrigins.add('http://localhost:4200');
  allowedOrigins.add('http://127.0.0.1:4200');
}

// Middlewares: CORP same-origin (helmet default) evita mostrar /uploads en <img> si la
// SPA (p. ej. 127.0.0.1:5173) y el API (:3000) se consideran distinto origen.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      const normalized = origin.replace(/\/$/, '');
      if (allowedOrigins.has(normalized)) return cb(null, true);
      logger.warn({ origin: normalized }, 'Origin bloqueado por CORS');
      return cb(null, false);
    },
    credentials: true,
  }),
);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
const jsonImportMb = Math.min(
  32,
  Math.max(1, parseFloat(config.TRAVEL_JSON_IMPORT_MAX_MB || '8')),
);
app.use('/api/v1/travel/import-json', express.json({ limit: `${jsonImportMb}mb` }), travelJsonImportRoutes);
app.use(express.json({ limit: '2mb' }));
app.use(requestIdMiddleware);
app.use(pinoHttp({ logger }));

// Rutas
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.get('/api', (_req, res) => {
  if (config.NODE_ENV === 'production') {
    return res.status(404).end();
  }
  res.json(apiDocs);
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/superadmin/companies', companyRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/audit-logs', auditLogRoutes);
app.use('/api/v1/travel/documents', travelDocumentRoutes);
app.use('/api/v1/travel/trips', travelTripRoutes);
app.use('/api/v1/proposals', proposalRoutes);
app.use('/api/v1/admin/openai', openaiUsageAdminRoutes);

// Manejo de errores global
app.use(errorHandler);

app.listen(config.PORT, () => {
  logger.info(`Server running on port ${config.PORT}`);
});

export default app;
