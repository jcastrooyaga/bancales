import { Router } from 'express';
import { PrismaClient, TipoEvento, Cliente } from '@prisma/client';

export const createHistoricoRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const { desde: desdeParam, hasta: hastaParam, tipo, cliente, plataformaId: platParam } = req.query;

      // Date range — default last 30 days; dates are day-boundaries (no time)
      const desde = desdeParam
        ? new Date(`${desdeParam}T00:00:00.000Z`)
        : (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 30); d.setUTCHours(0, 0, 0, 0); return d; })();
      const hasta = hastaParam
        ? new Date(`${hastaParam}T23:59:59.999Z`)
        : new Date();

      const where: Record<string, unknown> = {
        lectura: { gte: desde, lte: hasta },
      };

      if (req.user?.role === 'PLATAFORMA') {
        if (!req.user.plataformaId) { res.json([]); return; }
        where.plataformaId = req.user.plataformaId;
      } else if (platParam) {
        where.plataformaId = platParam as string;
      }

      if (tipo && ['CNTI', 'CNTO', 'CNTS'].includes(tipo as string)) {
        where.tipo = tipo as TipoEvento;
      }

      if (cliente && ['MICHELIN', 'CONTINENTAL'].includes(cliente as string)) {
        where.bancal = { cliente: cliente as Cliente };
      }

      const eventos = await prisma.evento.findMany({
        where,
        orderBy: { lectura: 'desc' },
        take: 5000,
        select: {
          id: true,
          tipo: true,
          lectura: true,
          usuario: true,
          plataforma: { select: { codigo: true, nombre: true } },
          bancal: { select: { codigo: true, cliente: true } },
        },
      });

      res.json(eventos.map(e => ({
        id: e.id,
        fecha: e.lectura,
        codigo: e.bancal.codigo,
        cliente: e.bancal.cliente,
        evento: e.tipo,
        usuario: e.usuario,
        plataforma: e.plataforma.codigo,
        plataformaNombre: e.plataforma.nombre,
      })));
    } catch (err) { next(err); }
  });

  return router;
};
