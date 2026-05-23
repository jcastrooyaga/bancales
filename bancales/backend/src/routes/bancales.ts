import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';

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

      const where: Record<string, unknown> = {};
      if (cliente) where.cliente = cliente;
      if (q) where.codigo = { contains: String(q).toUpperCase() };

      // Platform users are restricted to their own platform
      if (req.user?.role === 'PLATAFORMA' && req.user.plataformaId) {
        where.plataformaActualId = req.user.plataformaId;
      } else if (plataforma) {
        const p = await prisma.plataforma.findUnique({ where: { codigo: String(plataforma) } });
        if (p) where.plataformaActualId = p.id;
      }
      if (estado === 'riesgo') {
        where.ultimaLectura = { lt: threshold };
        where.activo = true;
      } else if (estado === 'activo') {
        where.ultimaLectura = { gte: threshold };
        where.activo = true;
      }

      const bancales = await prisma.bancal.findMany({
        where,
        include: { plataformaActual: { select: { codigo: true, nombre: true } } },
        orderBy: { codigo: 'asc' },
        take: 500,
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
