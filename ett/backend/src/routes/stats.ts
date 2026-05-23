import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

export const createStatsRouter = (prisma: PrismaClient) => {
  const router = Router();
  router.use(authenticate);

  router.get('/summary', async (req, res, next) => {
    try {
      const [total, submitted, approved, rejected, pending] = await Promise.all([
        prisma.request.count(),
        prisma.request.count({ where: { status: 'SUBMITTED' } }),
        prisma.request.count({ where: { status: 'APPROVED' } }),
        prisma.request.count({ where: { status: 'REJECTED' } }),
        prisma.request.count({ where: { status: { in: ['SUBMITTED', 'IN_VALIDATION'] } } }),
      ]);
      res.json({ total, submitted, approved, rejected, pending });
    } catch (err) { next(err); }
  });

  router.get('/by-ett', async (req, res, next) => {
    try {
      const data = await prisma.request.groupBy({
        by: ['ettId'],
        _count: { id: true },
      });
      const ettIds = data.map(d => d.ettId);
      const etts = await prisma.ett.findMany({ where: { id: { in: ettIds } } });
      const result = data.map(d => ({
        ettId: d.ettId,
        ettName: etts.find(e => e.id === d.ettId)?.name || d.ettId,
        count: d._count.id,
      }));
      res.json(result);
    } catch (err) { next(err); }
  });

  router.get('/by-workplace', async (req, res, next) => {
    try {
      const data = await prisma.request.groupBy({
        by: ['workplaceId'],
        _count: { id: true },
      });
      const workplaceIds = data.map(d => d.workplaceId);
      const workplaces = await prisma.workplace.findMany({ where: { id: { in: workplaceIds } } });
      const result = data.map(d => ({
        workplaceId: d.workplaceId,
        workplaceName: workplaces.find(w => w.id === d.workplaceId)?.name || d.workplaceId,
        count: d._count.id,
      }));
      res.json(result);
    } catch (err) { next(err); }
  });

  router.get('/recent', async (req, res, next) => {
    try {
      const recent = await prisma.auditLog.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      });
      res.json(recent);
    } catch (err) { next(err); }
  });

  return router;
};
