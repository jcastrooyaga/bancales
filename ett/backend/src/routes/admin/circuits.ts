import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createError } from '../../middleware/errorHandler';

export const createAdminCircuitsRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const circuits = await prisma.validationCircuit.findMany({
        include: { steps: { include: { validator: { select: { id: true, name: true, email: true } }, backup: { select: { id: true, name: true, email: true } } }, orderBy: { order: 'asc' } } },
        orderBy: { name: 'asc' },
      });
      res.json(circuits);
    } catch (err) { next(err); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { name, description, steps } = req.body;
      if (!name) throw createError(400, 'Name required');
      const circuit = await prisma.validationCircuit.create({
        data: {
          name, description,
          steps: steps ? { create: steps.map((s: any) => ({ order: s.order, validatorId: s.validatorId, backupId: s.backupId || null, timeoutHours: s.timeoutHours || 48 })) } : undefined,
        },
        include: { steps: true },
      });
      res.status(201).json(circuit);
    } catch (err) { next(err); }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const { name, description, active, steps } = req.body;
      await prisma.validationCircuit.update({ where: { id: req.params.id }, data: { name, description, active } });
      if (steps) {
        await prisma.validationStep.deleteMany({ where: { circuitId: req.params.id } });
        await prisma.validationStep.createMany({
          data: steps.map((s: any) => ({ circuitId: req.params.id, order: s.order, validatorId: s.validatorId, backupId: s.backupId || null, timeoutHours: s.timeoutHours || 48 })),
        });
      }
      const updated = await prisma.validationCircuit.findUnique({ where: { id: req.params.id }, include: { steps: true } });
      res.json(updated);
    } catch (err) { next(err); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await prisma.validationStep.deleteMany({ where: { circuitId: req.params.id } });
      await prisma.validationCircuit.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  return router;
};
