import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

export const createAdminConfigRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const configs = await prisma.systemConfig.findMany();
      res.json(Object.fromEntries(configs.map(c => [c.key, c.value])));
    } catch (err) { next(err); }
  });

  router.put('/:key', async (req, res, next) => {
    try {
      const { value } = req.body;
      const config = await prisma.systemConfig.upsert({
        where: { key: req.params.key },
        create: { key: req.params.key, value },
        update: { value },
      });
      res.json(config);
    } catch (err) { next(err); }
  });

  return router;
};
