import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '@prisma/client';
import { createError } from '../../middleware/errorHandler';

export const createAdminUsersRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const users = await prisma.user.findMany({
        include: { roles: true },
        orderBy: { name: 'asc' },
      });
      res.json(users.map(u => ({ ...u, passwordHash: undefined })));
    } catch (err) { next(err); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { email, name, password, roles } = req.body;
      if (!email || !name || !password) throw createError(400, 'Email, name and password required');
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) throw createError(400, 'Email already exists');

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: {
          email, name, passwordHash,
          roles: {
            create: (roles || ['REQUESTER']).map((r: string) => ({ role: r as Role })),
          },
        },
        include: { roles: true },
      });
      res.status(201).json({ ...user, passwordHash: undefined });
    } catch (err) { next(err); }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const { name, email, active, roles, password } = req.body;
      const data: any = {};
      if (name !== undefined) data.name = name;
      if (email !== undefined) data.email = email;
      if (active !== undefined) data.active = active;
      if (password) data.passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.update({ where: { id: req.params.id }, data });

      if (roles) {
        await prisma.userRole.deleteMany({ where: { userId: req.params.id } });
        await prisma.userRole.createMany({
          data: roles.map((r: string) => ({ userId: req.params.id, role: r as Role })),
        });
      }

      const updated = await prisma.user.findUnique({ where: { id: req.params.id }, include: { roles: true } });
      res.json({ ...updated, passwordHash: undefined });
    } catch (err) { next(err); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await prisma.userRole.deleteMany({ where: { userId: req.params.id } });
      await prisma.user.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  return router;
};
