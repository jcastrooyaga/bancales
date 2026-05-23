import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { authenticateEtt } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const createEttRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) throw createError(400, 'Email and password required');

      const ettUser = await prisma.ettUser.findUnique({ where: { email } });
      if (!ettUser || !ettUser.active) throw createError(401, 'Invalid credentials');

      const valid = await bcrypt.compare(password, ettUser.passwordHash);
      if (!valid) throw createError(401, 'Invalid credentials');

      const token = jwt.sign(
        { ettUserId: ettUser.id, ettId: ettUser.ettId, email: ettUser.email },
        config.jwtEttSecret,
        { expiresIn: '8h' }
      );

      res.json({ token, ettUser: { id: ettUser.id, name: ettUser.name, email: ettUser.email, ettId: ettUser.ettId } });
    } catch (err) { next(err); }
  });

  router.get('/requests', authenticateEtt, async (req, res, next) => {
    try {
      const requests = await prisma.request.findMany({
        where: { ettId: req.ettUser!.ettId, status: 'APPROVED' },
        include: { workplace: true, contractType: true, jobCategory: true, shift: true },
        orderBy: { approvedAt: 'desc' },
      });
      res.json(requests);
    } catch (err) { next(err); }
  });

  router.post('/requests/:id/register-worker', authenticateEtt, async (req, res, next) => {
    try {
      const request = await prisma.request.findUnique({ where: { id: req.params.id } });
      if (!request) throw createError(404, 'Request not found');
      if (request.ettId !== req.ettUser!.ettId) throw createError(403, 'Forbidden');
      if (request.status !== 'APPROVED') throw createError(400, 'Request must be approved');

      const { workerName, workerDni, workerEmail } = req.body;
      if (!workerName || !workerDni) throw createError(400, 'Worker name and DNI required');

      await prisma.requestValidationState.create({
        data: {
          requestId: request.id,
          step: 99,
          action: 'REGISTER_WORKER',
          comment: JSON.stringify({ workerName, workerDni, workerEmail }),
          actionAt: new Date(),
        },
      });

      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  return router;
};
