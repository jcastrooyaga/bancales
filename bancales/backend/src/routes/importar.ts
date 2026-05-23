import { Router } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { processImport } from '../services/importService';
import { createError } from '../middleware/errorHandler';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se aceptan ficheros .xlsx'));
    }
  },
});

export const createImportarRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.post('/', upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) throw createError(400, 'No se ha enviado ningún fichero');
      const result = await processImport(prisma, req.file.buffer);
      res.json(result);
    } catch (err) { next(err); }
  });

  return router;
};
