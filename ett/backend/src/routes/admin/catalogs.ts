import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createError } from '../../middleware/errorHandler';

const crudRouter = (model: any, uniqueField: string = 'code') => {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try { res.json(await model.findMany({ orderBy: { name: 'asc' } })); }
    catch (err) { next(err); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { code, name, description } = req.body;
      if (!code || !name) throw createError(400, 'Code and name required');
      res.status(201).json(await model.create({ data: { code, name, description } }));
    } catch (err) { next(err); }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const { name, description, active } = req.body;
      res.json(await model.update({ where: { id: req.params.id }, data: { name, description, active } }));
    } catch (err) { next(err); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await model.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  return router;
};

export const createAdminCatalogsRouter = (prisma: PrismaClient) => {
  const router = Router();
  router.use('/workplaces', crudRouter(prisma.workplace));
  router.use('/contract-types', crudRouter(prisma.contractType));
  router.use('/job-categories', crudRouter(prisma.jobCategory));
  router.use('/request-reasons', crudRouter(prisma.requestReason));
  router.use('/shifts', crudRouter(prisma.shift));
  return router;
};
