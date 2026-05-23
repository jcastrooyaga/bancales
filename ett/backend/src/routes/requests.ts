import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { generateUniqueCode } from '../services/codeService';
import { sendApprovalRequest } from '../services/emailService';

export const createRequestsRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.use(authenticate);

  router.get('/', async (req, res, next) => {
    try {
      const isAdmin = req.user!.roles.includes('ADMIN');
      const where = isAdmin ? {} : { requesterId: req.user!.userId };
      const requests = await prisma.request.findMany({
        where,
        include: { workplace: true, ett: true, contractType: true, jobCategory: true, requestReason: true, shift: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json(requests);
    } catch (err) { next(err); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const request = await prisma.request.findUnique({
        where: { id: req.params.id },
        include: {
          workplace: true, ett: true, contractType: true,
          jobCategory: true, requestReason: true, shift: true,
          validationStates: true,
          circuit: { include: { steps: { include: { validator: true, backup: true }, orderBy: { order: 'asc' } } } },
        },
      });
      if (!request) throw createError(404, 'Request not found');
      const isAdmin = req.user!.roles.includes('ADMIN');
      if (!isAdmin && request.requesterId !== req.user!.userId) throw createError(403, 'Forbidden');
      res.json(request);
    } catch (err) { next(err); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { workplaceId, ettId, contractTypeId, jobCategoryId, requestReasonId, shiftId, circuitId, startDate, endDate, headcount, notes } = req.body;
      if (!workplaceId || !ettId || !contractTypeId || !jobCategoryId || !requestReasonId || !shiftId || !startDate) {
        throw createError(400, 'Missing required fields');
      }
      const code = await generateUniqueCode(prisma);
      const request = await prisma.request.create({
        data: {
          code, requesterId: req.user!.userId,
          workplaceId, ettId, contractTypeId, jobCategoryId, requestReasonId, shiftId,
          circuitId: circuitId || null,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          headcount: headcount || 1,
          notes: notes || null,
          status: 'DRAFT',
        },
      });
      await prisma.auditLog.create({ data: { userId: req.user!.userId, action: 'CREATE', entity: 'Request', entityId: request.id } });
      res.status(201).json(request);
    } catch (err) { next(err); }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const request = await prisma.request.findUnique({ where: { id: req.params.id } });
      if (!request) throw createError(404, 'Request not found');
      if (request.requesterId !== req.user!.userId && !req.user!.roles.includes('ADMIN')) throw createError(403, 'Forbidden');
      if (!['DRAFT', 'RETURNED'].includes(request.status)) throw createError(400, 'Only DRAFT or RETURNED requests can be edited');

      const { workplaceId, ettId, contractTypeId, jobCategoryId, requestReasonId, shiftId, circuitId, startDate, endDate, headcount, notes } = req.body;
      const updated = await prisma.request.update({
        where: { id: req.params.id },
        data: {
          workplaceId, ettId, contractTypeId, jobCategoryId, requestReasonId, shiftId,
          circuitId: circuitId || null,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : null,
          headcount, notes,
        },
      });
      await prisma.auditLog.create({ data: { userId: req.user!.userId, action: 'UPDATE', entity: 'Request', entityId: request.id } });
      res.json(updated);
    } catch (err) { next(err); }
  });

  router.post('/:id/submit', async (req, res, next) => {
    try {
      const request = await prisma.request.findUnique({ where: { id: req.params.id } });
      if (!request) throw createError(404, 'Request not found');
      if (request.requesterId !== req.user!.userId) throw createError(403, 'Forbidden');
      if (!['DRAFT', 'RETURNED'].includes(request.status)) throw createError(400, 'Cannot submit in current status');

      const updated = await prisma.request.update({
        where: { id: req.params.id },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
      });
      await prisma.auditLog.create({ data: { userId: req.user!.userId, action: 'SUBMIT', entity: 'Request', entityId: request.id } });
      res.json(updated);
    } catch (err) { next(err); }
  });

  router.post('/:id/cancel', async (req, res, next) => {
    try {
      const request = await prisma.request.findUnique({ where: { id: req.params.id } });
      if (!request) throw createError(404, 'Request not found');
      if (request.requesterId !== req.user!.userId && !req.user!.roles.includes('ADMIN')) throw createError(403, 'Forbidden');
      if (['APPROVED', 'CANCELLED'].includes(request.status)) throw createError(400, 'Cannot cancel in current status');

      const updated = await prisma.request.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
      await prisma.auditLog.create({ data: { userId: req.user!.userId, action: 'CANCEL', entity: 'Request', entityId: request.id } });
      res.json(updated);
    } catch (err) { next(err); }
  });

  router.post('/:id/renew', async (req, res, next) => {
    try {
      const original = await prisma.request.findUnique({ where: { id: req.params.id } });
      if (!original) throw createError(404, 'Request not found');
      if (original.status !== 'APPROVED') throw createError(400, 'Only approved requests can be renewed');

      const code = await generateUniqueCode(prisma);
      const renewal = await prisma.request.create({
        data: {
          code,
          requesterId: req.user!.userId,
          workplaceId: original.workplaceId,
          ettId: original.ettId,
          contractTypeId: original.contractTypeId,
          jobCategoryId: original.jobCategoryId,
          requestReasonId: original.requestReasonId,
          shiftId: original.shiftId,
          circuitId: original.circuitId,
          startDate: original.startDate,
          endDate: original.endDate,
          headcount: original.headcount,
          notes: original.notes,
          status: 'DRAFT',
          isRenewal: true,
          originalRequestId: original.id,
        },
      });
      res.status(201).json(renewal);
    } catch (err) { next(err); }
  });

  router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
    try {
      const request = await prisma.request.findUnique({ where: { id: req.params.id } });
      if (!request) throw createError(404, 'Request not found');
      await prisma.requestValidationState.deleteMany({ where: { requestId: req.params.id } });
      await prisma.request.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  return router;
};
