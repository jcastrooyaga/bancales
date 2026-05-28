import { Router } from 'express';
import { PrismaClient, TipoEvento, Cliente } from '@prisma/client';
import { createError } from '../middleware/errorHandler';

function detectCliente(codigo: string): Cliente | null {
  const upper = codigo.toUpperCase();
  if (upper.startsWith('BC')) return 'MICHELIN';
  if (upper.startsWith('CAT')) return 'CONTINENTAL';
  return null;
}

export const createEventosRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const { codigoBancal, tipo, codigoPlataforma, lectura, usuario, observaciones } = req.body;

      if (!codigoBancal || !tipo || !codigoPlataforma || !lectura || !usuario) {
        throw createError(400, 'Faltan campos requeridos');
      }

      const validTipos: TipoEvento[] = ['CNTI', 'CNTO', 'CNTS'];
      if (!validTipos.includes(tipo)) throw createError(400, 'Tipo de evento inválido');

      const codigo = String(codigoBancal).toUpperCase();
      const cliente = detectCliente(codigo);
      if (!cliente) throw createError(400, 'Prefijo de bancal no reconocido (debe empezar por BC o CAT)');

      const plataforma = await prisma.plataforma.findUnique({
        where: { codigo: String(codigoPlataforma).toUpperCase() },
      });
      if (!plataforma) throw createError(404, 'Plataforma no encontrada');

      const fechaLectura = new Date(lectura);
      if (isNaN(fechaLectura.getTime())) throw createError(400, 'Fecha de lectura inválida');

      const cfgVentana = await prisma.configuracion.findUnique({
        where: { clave: 'ventana_deduplicacion_minutos' },
      });
      const ventanaMs = parseInt(cfgVentana?.valor ?? '180') * 60 * 1000;

      const bancal = await prisma.bancal.upsert({
        where: { codigo },
        update: {},
        create: { codigo, cliente },
      });

      const existing = await prisma.evento.findFirst({
        where: {
          bancalId: bancal.id,
          plataformaId: plataforma.id,
          tipo,
          lectura: {
            gte: new Date(fechaLectura.getTime() - ventanaMs),
            lte: new Date(fechaLectura.getTime() + ventanaMs),
          },
        },
      });
      if (existing) throw createError(409, 'Evento duplicado en la ventana de tiempo configurada');

      const evento = await prisma.evento.create({
        data: {
          bancalId: bancal.id,
          plataformaId: plataforma.id,
          tipo,
          lectura: fechaLectura,
          usuario,
          observaciones: observaciones ? String(observaciones).slice(0, 100) : null,
          fuente: 'MANUAL',
        },
        include: { plataforma: { select: { codigo: true, nombre: true } } },
      });

      if (!bancal.ultimaLectura || fechaLectura > bancal.ultimaLectura) {
        await prisma.bancal.update({
          where: { id: bancal.id },
          data: { ultimaLectura: fechaLectura, plataformaActualId: plataforma.id, ultimoTipoEvento: tipo },
        });
      }
      await prisma.bancalBaja.deleteMany({ where: { bancalId: bancal.id } });

      res.status(201).json(evento);
    } catch (err) { next(err); }
  });

  return router;
};
