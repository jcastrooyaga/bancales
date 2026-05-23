import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const createSupervalidatorRouter = (prisma: PrismaClient) => {
  const router = Router();
  router.use(authenticate, requireRole('SUPERVALIDATOR', 'ADMIN'));

  router.get('/requests', async (req, res, next) => {
    try {
      const requests = await prisma.request.findMany({
        include: {
          workplace: true, ett: true,
          requester: { select: { id: true, name: true, email: true } },
          contractType: true, jobCategory: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json(requests);
    } catch (err) { next(err); }
  });

  router.post('/:id/approve', async (req, res, next) => {
    try {
      const request = await prisma.request.findUnique({ where: { id: req.params.id } });
      if (!request) throw createError(404, 'Request not found');
      const { comment } = req.body;
      await prisma.request.update({ where: { id: req.params.id }, data: { status: 'APPROVED', approvedAt: new Date() } });
      await prisma.auditLog.create({ data: { userId: req.user!.userId, action: 'APPROVE', entity: 'Request', entityId: req.params.id } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.post('/:id/reject', async (req, res, next) => {
    try {
      const request = await prisma.request.findUnique({ where: { id: req.params.id } });
      if (!request) throw createError(404, 'Request not found');
      const { reason } = req.body;
      if (!reason) throw createError(400, 'Reason required');
      await prisma.request.update({ where: { id: req.params.id }, data: { status: 'REJECTED', rejectionReason: reason, rejectedAt: new Date() } });
      await prisma.auditLog.create({ data: { userId: req.user!.userId, action: 'REJECT', entity: 'Request', entityId: req.params.id } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  return router;
};
