import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const createAsociacionesRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const asociaciones = await prisma.bancalAsociacion.findMany({
        orderBy: { fechaAsociacion: 'desc' },
        include: {
          original: { select: { codigo: true, cliente: true } },
          final: { select: { codigo: true, cliente: true } },
        },
      });
      res.json(asociaciones);
    } catch (err) { next(err); }
  });

  router.post('/', requireAdmin, async (req, res, next) => {
    try {
      const { originalCodigo, finalCodigo } = req.body;
      if (!originalCodigo || !finalCodigo) throw createError(400, 'Faltan campos requeridos');
      if (originalCodigo.toUpperCase() === finalCodigo.toUpperCase()) throw createError(400, 'El bancal original y el final no pueden ser el mismo');

      const original = await prisma.bancal.findUnique({ where: { codigo: originalCodigo.toUpperCase() } });
      if (!original) throw createError(404, `Bancal original no encontrado: ${originalCodigo}`);

      // Original cannot be the final of another association (no chains)
      const originalEsFinal = await prisma.bancalAsociacion.findFirst({ where: { finalBancalId: original.id } });
      if (originalEsFinal) throw createError(409, 'El bancal original ya es el destino de otra asociación');

      // Original cannot already have been associated as original
      const originalYaAsociado = await prisma.bancalAsociacion.findFirst({ where: { originalId: original.id } });
      if (originalYaAsociado) throw createError(409, `Este bancal ya fue asociado al código ${originalYaAsociado.finalBancalId}`);

      // Find or create final bancal
      let final = await prisma.bancal.findUnique({ where: { codigo: finalCodigo.toUpperCase() } });
      if (!final) {
        // Detect client from final code or inherit from original
        const upperFinal = finalCodigo.toUpperCase();
        let clienteFinal = original.cliente;
        if (upperFinal.startsWith('BC') || upperFinal.startsWith('MICH')) clienteFinal = 'MICHELIN';
        else if (upperFinal.startsWith('CAT') || upperFinal.startsWith('CONT')) clienteFinal = 'CONTINENTAL';
        final = await prisma.bancal.create({ data: { codigo: finalCodigo.toUpperCase(), cliente: clienteFinal } });
      }

      // Final cannot be the original of another association
      const finalEsOriginal = await prisma.bancalAsociacion.findFirst({ where: { originalId: final.id } });
      if (finalEsOriginal) throw createError(409, 'El bancal final ya fue asociado como original en otra operación');

      const fechaAsociacion = new Date();

      // Create the association record first to get its id
      const asociacion = await prisma.bancalAsociacion.create({
        data: {
          originalCodigo: original.codigo,
          originalId: original.id,
          finalBancalId: final.id,
          fechaAsociacion,
        },
      });

      // Move events: original events with lectura <= fechaAsociacion → final bancal, tagged with asociacionId
      await prisma.evento.updateMany({
        where: { bancalId: original.id, lectura: { lte: fechaAsociacion } },
        data: { bancalId: final.id, asociacionId: asociacion.id },
      });

      // Recalculate final bancal stats from all its events (now including moved ones)
      const lastEvento = await prisma.evento.findFirst({
        where: { bancalId: final.id },
        orderBy: { lectura: 'desc' },
        select: { lectura: true, plataformaId: true, tipo: true },
      });
      await prisma.bancal.update({
        where: { id: final.id },
        data: {
          ultimaLectura: lastEvento?.lectura ?? null,
          plataformaActualId: lastEvento?.plataformaId ?? null,
          ultimoTipoEvento: lastEvento?.tipo ?? null,
        },
      });

      // Put original in baja and clear its stats (no events remain before fechaAsociacion)
      await prisma.bancalBaja.upsert({
        where: { bancalId: original.id },
        create: { bancalId: original.id },
        update: {},
      });
      await prisma.bancal.update({
        where: { id: original.id },
        data: { ultimaLectura: null, plataformaActualId: null, ultimoTipoEvento: null },
      });

      res.status(201).json({
        asociacion,
        original: { id: original.id, codigo: original.codigo },
        final: { id: final.id, codigo: final.codigo },
        eventosMovidos: await prisma.evento.count({ where: { asociacionId: asociacion.id } }),
      });
    } catch (err) { next(err); }
  });

  return router;
};
