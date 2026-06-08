import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';

export const createConfiguracionRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const items = await prisma.configuracion.findMany();
      const cfg: Record<string, string> = {};
      items.forEach(i => { cfg[i.clave] = i.valor; });
      res.json(cfg);
    } catch (err) { next(err); }
  });

  router.delete('/limpiar-bd', async (_req, res, next) => {
    try {
      // Protect events that were moved via an association (asociacionId IS NOT NULL)
      await prisma.evento.deleteMany({ where: { fuente: 'IMPORTACION', asociacionId: null } });
      // Remove bancals with no events, but never remove bancals involved in an association
      const asociacionBancalIds = await prisma.bancalAsociacion.findMany({
        select: { originalId: true, finalBancalId: true },
      });
      const protectedIds = new Set<string>();
      for (const a of asociacionBancalIds) {
        protectedIds.add(a.originalId);
        protectedIds.add(a.finalBancalId);
      }
      await prisma.bancal.deleteMany({
        where: {
          eventos: { none: {} },
          id: { notIn: [...protectedIds] },
        },
      });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.put('/', async (req, res, next) => {
    try {
      const { umbral_bancal_perdido_semanas, ventana_deduplicacion_minutos } = req.body;

      if (umbral_bancal_perdido_semanas !== undefined) {
        const v = parseInt(umbral_bancal_perdido_semanas);
        if (isNaN(v) || v < 1) throw createError(400, 'Umbral inválido');
        await prisma.configuracion.update({
          where: { clave: 'umbral_bancal_perdido_semanas' },
          data: { valor: String(v) },
        });
      }

      if (ventana_deduplicacion_minutos !== undefined) {
        const v = parseInt(ventana_deduplicacion_minutos);
        if (isNaN(v) || v < 1) throw createError(400, 'Ventana inválida');
        await prisma.configuracion.update({
          where: { clave: 'ventana_deduplicacion_minutos' },
          data: { valor: String(v) },
        });
      }

      const items = await prisma.configuracion.findMany();
      const cfg: Record<string, string> = {};
      items.forEach(i => { cfg[i.clave] = i.valor; });
      res.json(cfg);
    } catch (err) { next(err); }
  });

  return router;
};
