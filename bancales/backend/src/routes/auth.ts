import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { authenticate } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const createAuthRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.post('/login', async (req, res, next) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) throw createError(400, 'Username and password required');

      // Admin via env vars
      if (username === config.adminUsername && password === config.adminPassword) {
        const token = jwt.sign(
          { userId: 'admin', username: config.adminUsername, role: 'ADMIN' },
          config.jwtSecret,
          { expiresIn: '12h' }
        );
        return res.json({ token, user: { id: 'admin', username: config.adminUsername, role: 'ADMIN' } });
      }

      // Platform users via DB
      const dbUser = await prisma.usuario.findUnique({
        where: { username: username.toUpperCase() },
        include: { plataforma: { select: { codigo: true } } },
      });
      if (!dbUser || !(await bcrypt.compare(password, dbUser.passwordHash))) {
        throw createError(401, 'Credenciales inválidas');
      }

      const token = jwt.sign(
        {
          userId: dbUser.id,
          username: dbUser.username,
          role: 'PLATAFORMA',
          plataformaId: dbUser.plataformaId ?? undefined,
          plataformaCodigo: dbUser.plataforma?.codigo ?? undefined,
        },
        config.jwtSecret,
        { expiresIn: '12h' }
      );
      res.json({
        token,
        user: {
          id: dbUser.id,
          username: dbUser.username,
          role: 'PLATAFORMA',
          plataformaCodigo: dbUser.plataforma?.codigo,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', authenticate, async (req, res) => {
    const u = req.user!;
    res.json({
      id: u.userId,
      username: u.username,
      role: u.role,
      plataformaCodigo: u.plataformaCodigo,
    });
  });

  router.put('/me/password', authenticate, async (req, res, next) => {
    try {
      if (req.user?.role !== 'PLATAFORMA') {
        throw createError(403, 'Solo usuarios de plataforma pueden cambiar su contraseña aquí');
      }
      const { password } = req.body;
      if (!password || String(password).length < 4) {
        throw createError(400, 'La contraseña debe tener al menos 4 caracteres');
      }
      const hash = await bcrypt.hash(String(password), 10);
      await prisma.usuario.update({
        where: { id: req.user.userId },
        data: { passwordHash: hash },
      });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  return router;
};
