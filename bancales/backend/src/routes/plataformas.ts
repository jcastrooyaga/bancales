import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import {
  calcInventarioReal,
  calcInventarioTeorico,
  getBancalesEnRiesgo,
  parseWeekParam,
  currentWeek,
  previousWeek,
  formatWeek,
  getMondayOfWeek,
  isoWeekOf,
} from '../services/weekService';

export const createPlataformasRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const plataformas = await prisma.plataforma.findMany({ orderBy: { codigo: 'asc' } });
      res.json(plataformas);
    } catch (err) { next(err); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { codigo, nombre, pais } = req.body;
      if (!codigo || !nombre || !pais) throw createError(400, 'Faltan campos requeridos');
      if (!['ES', 'PT'].includes(pais)) throw createError(400, 'País inválido');
      const existing = await prisma.plataforma.findUnique({ where: { codigo: codigo.toUpperCase() } });
      if (existing) throw createError(409, 'Ya existe una plataforma con ese código');
      const p = await prisma.plataforma.create({
        data: { codigo: codigo.toUpperCase(), nombre, pais },
      });
      res.status(201).json(p);
    } catch (err) { next(err); }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const { nombre, activa } = req.body;
      const update: Record<string, unknown> = {};
      if (nombre !== undefined) update.nombre = nombre;
      if (activa !== undefined) update.activa = Boolean(activa);
      const p = await prisma.plataforma.update({ where: { id: req.params.id }, data: update });
      res.json(p);
    } catch (err) { next(err); }
  });

  router.get('/:codigo/detalle', async (req, res, next) => {
    try {
      const plataforma = await prisma.plataforma.findUnique({ where: { codigo: req.params.codigo } });
      if (!plataforma) throw createError(404, 'Plataforma no encontrada');

      const semanaParam = String(req.query.semana ?? formatWeek(currentWeek()));
      const yearParam = String(req.query.year ?? currentWeek().year);
      const w = parseWeekParam(semanaParam, yearParam);

      const cfgUmbral = await prisma.configuracion.findUnique({ where: { clave: 'umbral_bancal_perdido_semanas' } });
      const umbral = parseInt(cfgUmbral?.valor ?? '4');

      // Build historico for last 12 weeks
      const historico = [];
      let cur = w;
      for (let i = 0; i < 12; i++) {
        const real = await calcInventarioReal(prisma, plataforma.id, cur.year, cur.week);
        const teorico = await calcInventarioTeorico(prisma, plataforma.id, cur.year, cur.week);
        historico.unshift({
          semana: formatWeek(cur),
          year: cur.year,
          real,
          teorico,
          desviacion: real - teorico,
        });
        cur = previousWeek(cur);
      }

      // Bancales actualmente en esta plataforma
      const bancalesActuales = await prisma.bancal.findMany({
        where: { plataformaActualId: plataforma.id, activo: true },
        select: { id: true, codigo: true, cliente: true, ultimaLectura: true },
        orderBy: { codigo: 'asc' },
      });

      // Bancales en riesgo
      const threshold = new Date();
      threshold.setUTCDate(threshold.getUTCDate() - umbral * 7);
      const bancalesRiesgo = await prisma.bancal.findMany({
        where: {
          plataformaActualId: plataforma.id,
          activo: true,
          ultimaLectura: { lt: threshold },
        },
        select: { id: true, codigo: true, cliente: true, ultimaLectura: true },
        orderBy: { ultimaLectura: 'asc' },
      });

      res.json({ plataforma, historico, bancalesActuales, bancalesRiesgo });
    } catch (err) { next(err); }
  });

  return router;
};
