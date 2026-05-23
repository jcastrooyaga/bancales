import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { createError } from '../../middleware/errorHandler';

export const createAdminEttsRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const etts = await prisma.ett.findMany({ include: { emailRouting: true }, orderBy: { name: 'asc' } });
      res.json(etts);
    } catch (err) { next(err); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { code, name, contactEmail } = req.body;
      if (!code || !name) throw createError(400, 'Code and name required');
      const ett = await prisma.ett.create({ data: { code, name, contactEmail } });
      res.status(201).json(ett);
    } catch (err) { next(err); }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const { name, contactEmail, active } = req.body;
      const ett = await prisma.ett.update({ where: { id: req.params.id }, data: { name, contactEmail, active } });
      res.json(ett);
    } catch (err) { next(err); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await prisma.ett.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ETT email routing
  router.post('/:id/routing', async (req, res, next) => {
    try {
      const { email } = req.body;
      if (!email) throw createError(400, 'Email required');
      const routing = await prisma.ettEmailRouting.create({ data: { ettId: req.params.id, email } });
      res.status(201).json(routing);
    } catch (err) { next(err); }
  });

  router.delete('/:id/routing/:routingId', async (req, res, next) => {
    try {
      await prisma.ettEmailRouting.delete({ where: { id: req.params.routingId } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ETT portal users
  router.post('/:id/users', async (req, res, next) => {
    try {
      const { email, name, password } = req.body;
      if (!email || !name || !password) throw createError(400, 'Email, name and password required');
      const passwordHash = await bcrypt.hash(password, 12);
      const ettUser = await prisma.ettUser.create({ data: { ettId: req.params.id, email, name, passwordHash } });
      res.status(201).json({ ...ettUser, passwordHash: undefined });
    } catch (err) { next(err); }
  });

  return router;
};
