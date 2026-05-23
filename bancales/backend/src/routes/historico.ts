import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

export const createHistoricoRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const dias = Math.min(parseInt((req.query.dias as string) ?? '30', 10) || 30, 365);
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);

      const where: Parameters<typeof prisma.evento.findMany>[0]['where'] = {
        lectura: { gte: desde },
      };

      if (req.user?.role === 'PLATAFORMA') {
        if (!req.user.plataformaId) return res.json([]);
        where.plataformaId = req.user.plataformaId;
      } else if (req.query.plataformaId) {
        where.plataformaId = req.query.plataformaId as string;
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
          fuente: true,
          plataforma: { select: { codigo: true, nombre: true } },
          bancal: { select: { codigo: true, cliente: true, activo: true } },
        },
      });

      res.json(eventos.map(e => ({
        id: e.id,
        fecha: e.lectura,
        codigo: e.bancal.codigo,
        cliente: e.bancal.cliente,
        evento: e.tipo,
        usuario: e.usuario,
        estado: e.bancal.activo ? 'Activo' : 'Inactivo',
        plataforma: e.plataforma.codigo,
        plataformaNombre: e.plataforma.nombre,
      })));
    } catch (err) { next(err); }
  });

  return router;
};
