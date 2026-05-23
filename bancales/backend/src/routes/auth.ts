import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { authenticate } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const createAuthRouter = () => {
  const router = Router();

  router.post('/login', (req, res, next) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) throw createError(400, 'Username and password required');
      if (username !== config.adminUsername || password !== config.adminPassword) {
        throw createError(401, 'Invalid credentials');
      }
      const token = jwt.sign(
        { userId: 'admin', username: config.adminUsername },
        config.jwtSecret,
        { expiresIn: '12h' }
      );
      res.json({ token, user: { id: 'admin', username: config.adminUsername } });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', authenticate, (req, res) => {
    res.json({ id: 'admin', username: req.user!.username });
  });

  return router;
};
