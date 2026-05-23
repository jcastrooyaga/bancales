import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { sendApproved, sendRejected, sendEttNotification } from '../services/emailService';

export const createValidationRouter = (prisma: PrismaClient) => {
  const router = Router();
  router.use(authenticate, requireRole('VALIDATOR', 'SUPERVALIDATOR', 'ADMIN'));

  router.get('/pending', async (req, res, next) => {
    try {
      const pending = await prisma.request.findMany({
        where: { status: { in: ['SUBMITTED', 'IN_VALIDATION'] } },
        include: { workplace: true, ett: true, requester: { select: { id: true, name: true, email: true } } },
        orderBy: { submittedAt: 'asc' },
      });
      res.json(pending);
    } catch (err) { next(err); }
  });

  router.post('/:id/approve', async (req, res, next) => {
    try {
      const request = await prisma.request.findUnique({
        where: { id: req.params.id },
        include: {
          requester: true,
          ett: { include: { emailRouting: { where: { active: true } } } },
          circuit: { include: { steps: { orderBy: { order: 'asc' } } } },
        },
      });
      if (!request) throw createError(404, 'Request not found');
      if (!['SUBMITTED', 'IN_VALIDATION'].includes(request.status)) throw createError(400, 'Cannot approve in current status');

      const { comment } = req.body;
      const nextStep = (request.currentStep || 0) + 1;
      const totalSteps = request.circuit?.steps.length || 1;

      let newStatus: string;
      let newStep: number | null;

      if (!request.circuitId || nextStep > totalSteps) {
        newStatus = 'APPROVED';
        newStep = null;
      } else {
        newStatus = 'IN_VALIDATION';
        newStep = nextStep;
      }

      await prisma.requestValidationState.create({
        data: { requestId: request.id, step: request.currentStep || 1, validatorId: req.user!.userId, action: 'APPROVE', comment: comment || null, actionAt: new Date() },
      });

      await prisma.request.update({
        where: { id: req.params.id },
        data: {
          status: newStatus as any,
          currentStep: newStep,
          approvedAt: newStatus === 'APPROVED' ? new Date() : null,
        },
      });

      if (newStatus === 'APPROVED') {
        await sendApproved(request.requester.email, request.code);
        for (const routing of request.ett.emailRouting) {
          await sendEttNotification(routing.email, request.code);
        }
      }

      await prisma.auditLog.create({ data: { userId: req.user!.userId, action: 'APPROVE', entity: 'Request', entityId: request.id } });
      res.json({ ok: true, status: newStatus });
    } catch (err) { next(err); }
  });

  router.post('/:id/reject', async (req, res, next) => {
    try {
      const request = await prisma.request.findUnique({ where: { id: req.params.id }, include: { requester: true } });
      if (!request) throw createError(404, 'Request not found');
      if (!['SUBMITTED', 'IN_VALIDATION'].includes(request.status)) throw createError(400, 'Cannot reject in current status');

      const { reason } = req.body;
      if (!reason) throw createError(400, 'Rejection reason required');

      await prisma.requestValidationState.create({
        data: { requestId: request.id, step: request.currentStep || 1, validatorId: req.user!.userId, action: 'REJECT', comment: reason, actionAt: new Date() },
      });

      await prisma.request.update({
        where: { id: req.params.id },
        data: { status: 'REJECTED', rejectionReason: reason, rejectedAt: new Date() },
      });

      await sendRejected(request.requester.email, request.code, reason);
      await prisma.auditLog.create({ data: { userId: req.user!.userId, action: 'REJECT', entity: 'Request', entityId: request.id } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.post('/:id/return', async (req, res, next) => {
    try {
      const request = await prisma.request.findUnique({ where: { id: req.params.id } });
      if (!request) throw createError(404, 'Request not found');

      const { reason } = req.body;
      await prisma.requestValidationState.create({
        data: { requestId: request.id, step: request.currentStep || 1, validatorId: req.user!.userId, action: 'RETURN', comment: reason || null, actionAt: new Date() },
      });
      await prisma.request.update({ where: { id: req.params.id }, data: { status: 'RETURNED', currentStep: null } });
      await prisma.auditLog.create({ data: { userId: req.user!.userId, action: 'RETURN', entity: 'Request', entityId: request.id } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  return router;
};
