import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { authenticate } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const createAuthRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) throw createError(400, 'Email and password required');

      const user = await prisma.user.findUnique({
        where: { email },
        include: { roles: true },
      });
      if (!user || !user.active) throw createError(401, 'Invalid credentials');

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) throw createError(401, 'Invalid credentials');

      const roles = user.roles.map(r => r.role);
      const token = jwt.sign(
        { userId: user.id, email: user.email, roles },
        config.jwtSecret,
        { expiresIn: '8h' }
      );

      await prisma.auditLog.create({
        data: { userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id },
      });

      res.json({ token, user: { id: user.id, name: user.name, email: user.email, roles } });
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout', authenticate, async (req, res, next) => {
    try {
      await prisma.auditLog.create({
        data: { userId: req.user!.userId, action: 'LOGOUT', entity: 'User', entityId: req.user!.userId },
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', authenticate, async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: { roles: true },
      });
      if (!user) throw createError(404, 'User not found');
      res.json({ id: user.id, name: user.name, email: user.email, roles: user.roles.map(r => r.role) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/change-password', authenticate, async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) throw createError(400, 'Passwords required');
      if (newPassword.length < 6) throw createError(400, 'Password must be at least 6 characters');

      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!user) throw createError(404, 'User not found');

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) throw createError(400, 'Current password is incorrect');

      const hash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
      await prisma.auditLog.create({
        data: { userId: user.id, action: 'PASSWORD_CHANGE', entity: 'User', entityId: user.id },
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
