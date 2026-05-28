import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import { requireAdmin } from '../middleware/auth';

export const createBancalesRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const { cliente, plataforma, estado, q } = req.query;

      const cfgUmbral = await prisma.configuracion.findUnique({
        where: { clave: 'umbral_bancal_perdido_semanas' },
      });
      const umbral = parseInt(cfgUmbral?.valor ?? '4');
      const threshold = new Date();
      threshold.setUTCDate(threshold.getUTCDate() - umbral * 7);
      threshold.setUTCHours(0, 0, 0, 0); // anchor to midnight so diasSinLectura >= umbral*7+1

      const where: Record<string, unknown> = {};
      if (cliente) where.cliente = cliente;
      if (q) where.codigo = { contains: String(q).toUpperCase() };

      // Platform users see all bancals that have had any reading at their platform
      if (req.user?.role === 'PLATAFORMA' && req.user.plataformaId) {
        const evts = await prisma.evento.findMany({
          where: { plataformaId: req.user.plataformaId },
          select: { bancalId: true },
          distinct: ['bancalId'],
        });
        where.id = { in: evts.map(e => e.bancalId) };
      } else if (plataforma) {
        const p = await prisma.plataforma.findUnique({ where: { codigo: String(plataforma) } });
        if (p) where.plataformaActualId = p.id;
      }
      if (estado === 'riesgo') {
        where.ultimaLectura = { lt: threshold };
        where.baja = { is: null };
      } else if (estado === 'activo') {
        where.ultimaLectura = { gte: threshold };
        where.baja = { is: null };
      } else if (estado === 'baja') {
        where.baja = { isNot: null };
      }

      const bancales = await prisma.bancal.findMany({
        where,
        include: { plataformaActual: { select: { codigo: true, nombre: true } } },
        orderBy: { codigo: 'asc' },
      });

      const now = Date.now();
      const data = bancales.map(b => ({
        id: b.id,
        codigo: b.codigo,
        cliente: b.cliente,
        plataformaActual: b.plataformaActual,
        ultimaLectura: b.ultimaLectura,
        diasSinLectura: b.ultimaLectura
          ? Math.floor((now - b.ultimaLectura.getTime()) / 86400000)
          : null,
        enRiesgo: b.ultimaLectura ? b.ultimaLectura < threshold : true,
      }));

      res.json(data);
    } catch (err) { next(err); }
  });

  router.get('/:codigo/historial', async (req, res, next) => {
    try {
      const bancal = await prisma.bancal.findUnique({
        where: { codigo: req.params.codigo.toUpperCase() },
        include: { plataformaActual: { select: { codigo: true, nombre: true } } },
      });
      if (!bancal) throw createError(404, 'Bancal no encontrado');

      const eventos = await prisma.evento.findMany({
        where: { bancalId: bancal.id },
        include: { plataforma: { select: { codigo: true, nombre: true } } },
        orderBy: { lectura: 'desc' },
        take: 200,
      });

      res.json({ bancal, eventos });
    } catch (err) { next(err); }
  });

  router.patch('/:codigo/desactivar', requireAdmin, async (req, res, next) => {
    try {
      const bancal = await prisma.bancal.findUnique({
        where: { codigo: req.params.codigo.toUpperCase() },
        include: { baja: true },
      });
      if (!bancal) throw createError(404, 'Bancal no encontrado');
      if (bancal.baja) throw createError(409, 'El bancal ya está dado de baja');
      await prisma.bancalBaja.create({ data: { bancalId: bancal.id } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.patch('/:codigo/activar', requireAdmin, async (req, res, next) => {
    try {
      const bancal = await prisma.bancal.findUnique({
        where: { codigo: req.params.codigo.toUpperCase() },
        include: { baja: true },
      });
      if (!bancal) throw createError(404, 'Bancal no encontrado');
      if (!bancal.baja) throw createError(409, 'El bancal ya está activo');
      await prisma.bancalBaja.delete({ where: { bancalId: bancal.id } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // Autocomplete search by prefix
  router.get('/search', async (req, res, next) => {
    try {
      const q = String(req.query.q ?? '').toUpperCase();
      if (!q) return res.json([]);
      const bancales = await prisma.bancal.findMany({
        where: { codigo: { startsWith: q } },
        select: { codigo: true, cliente: true },
        take: 10,
      });
      res.json(bancales);
    } catch (err) { next(err); }
  });

  return router;
};
