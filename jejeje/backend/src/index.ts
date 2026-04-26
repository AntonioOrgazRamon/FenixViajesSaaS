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
import { apiDocs } from './api-docs';

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(express.json());
app.use(requestIdMiddleware);
app.use(pinoHttp({ logger }));

// Rutas
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.get('/api', (req, res) => {
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

// Manejo de errores global
app.use(errorHandler);

app.listen(config.PORT, () => {
  logger.info(`Server running on port ${config.PORT}`);
});

export default app;
