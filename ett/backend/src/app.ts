import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { createAuthRouter } from './routes/auth';
import { createRequestsRouter } from './routes/requests';
import { createValidationRouter } from './routes/validation';
import { createSupervalidatorRouter } from './routes/supervalidator';
import { createEttRouter } from './routes/ett';
import { createStatsRouter } from './routes/stats';
import { createAdminUsersRouter } from './routes/admin/users';
import { createAdminEttsRouter } from './routes/admin/etts';
import { createAdminCircuitsRouter } from './routes/admin/circuits';
import { createAdminCatalogsRouter } from './routes/admin/catalogs';
import { createAdminConfigRouter } from './routes/admin/config';

export const createApp = (prisma: PrismaClient) => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: '*', credentials: true }));
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

  app.use('/api/auth', createAuthRouter(prisma));
  app.use('/api/requests', createRequestsRouter(prisma));
  app.use('/api/validation', createValidationRouter(prisma));
  app.use('/api/supervalidator', createSupervalidatorRouter(prisma));
  app.use('/api/ett', createEttRouter(prisma));
  app.use('/api/stats', createStatsRouter(prisma));

  const adminMiddleware = [authenticate, requireRole('ADMIN')];
  app.use('/api/admin/users', adminMiddleware, createAdminUsersRouter(prisma));
  app.use('/api/admin/etts', adminMiddleware, createAdminEttsRouter(prisma));
  app.use('/api/admin/circuits', adminMiddleware, createAdminCircuitsRouter(prisma));
  app.use('/api/admin/catalogs', adminMiddleware, createAdminCatalogsRouter(prisma));
  app.use('/api/admin/config', adminMiddleware, createAdminConfigRouter(prisma));

  app.use(errorHandler);

  return app;
};
