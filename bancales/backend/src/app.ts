import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { createAuthRouter } from './routes/auth';
import { createDashboardRouter } from './routes/dashboard';
import { createPlataformasRouter } from './routes/plataformas';
import { createBancalesRouter } from './routes/bancales';
import { createEventosRouter } from './routes/eventos';
import { createImportarRouter } from './routes/importar';
import { createConfiguracionRouter } from './routes/configuracion';
import { createHistoricoRouter } from './routes/historico';

export const createApp = (prisma: PrismaClient) => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: '*', credentials: true }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

  app.use('/api/auth', createAuthRouter(prisma));
  app.use('/api/dashboard', authenticate, requireAdmin, createDashboardRouter(prisma));
  app.use('/api/plataformas', authenticate, createPlataformasRouter(prisma));
  app.use('/api/bancales', authenticate, createBancalesRouter(prisma));
  app.use('/api/eventos', authenticate, requireAdmin, createEventosRouter(prisma));
  app.use('/api/importar', authenticate, requireAdmin, createImportarRouter(prisma));
  app.use('/api/configuracion', authenticate, requireAdmin, createConfiguracionRouter(prisma));
  app.use('/api/historico', authenticate, createHistoricoRouter(prisma));

  app.use(errorHandler);

  return app;
};
