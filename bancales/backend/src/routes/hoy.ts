import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { buildManualCutoffFilter } from '../services/weekService';

export const createHoyRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const oldestImported = await prisma.evento.findFirst({
        where: { fuente: 'IMPORTACION' },
        orderBy: { lectura: 'asc' },
        select: { lectura: true },
      });
      const mcf = buildManualCutoffFilter(oldestImported?.lectura ?? null);

      // Most recent event per bancal (ascending so last write wins)
      const allEvents = await prisma.evento.findMany({
        where: { ...mcf },
        select: { bancalId: true, plataformaId: true, tipo: true, lectura: true },
        orderBy: { lectura: 'asc' },
      });

      const latestMap = new Map<string, { plataformaId: string; tipo: string; lectura: Date }>();
      for (const e of allEvents) {
        latestMap.set(e.bancalId, { plataformaId: e.plataformaId, tipo: e.tipo, lectura: e.lectura });
      }

      // Group by platform, excluding bancals whose last event is CNTO
      const platformBancalMap = new Map<string, { bancalId: string; tipo: string; lectura: Date }[]>();
      for (const [bancalId, evt] of latestMap) {
        if (evt.tipo !== 'CNTO') {
          if (!platformBancalMap.has(evt.plataformaId)) platformBancalMap.set(evt.plataformaId, []);
          platformBancalMap.get(evt.plataformaId)!.push({ bancalId, tipo: evt.tipo, lectura: evt.lectura });
        }
      }

      // Fetch bancal details for active bancals currently at a platform
      const activeBancalIds = [...latestMap.entries()]
        .filter(([_, e]) => e.tipo !== 'CNTO')
        .map(([id]) => id);

      const bancales = activeBancalIds.length > 0
        ? await prisma.bancal.findMany({
            where: { id: { in: activeBancalIds }, activo: true },
            select: { id: true, codigo: true, cliente: true },
          })
        : [];
      const bancalMap = new Map(bancales.map(b => [b.id, b]));

      const plataformas = await prisma.plataforma.findMany({
        where: { activa: true },
        orderBy: { codigo: 'asc' },
      });

      const result = plataformas.map(p => {
        const evts = platformBancalMap.get(p.id) ?? [];
        const bancalesDetalle = evts
          .flatMap(e => {
            const b = bancalMap.get(e.bancalId);
            if (!b) return [];
            return [{ id: e.bancalId, codigo: b.codigo, cliente: b.cliente as string, ultimoTipo: e.tipo, ultimaLectura: e.lectura }];
          })
          .sort((a, b) => a.codigo.localeCompare(b.codigo));

        const ultimaLectura = bancalesDetalle.length > 0
          ? bancalesDetalle.reduce((max, b) => b.ultimaLectura > max ? b.ultimaLectura : max, bancalesDetalle[0].ultimaLectura)
          : null;

        return {
          plataforma: { id: p.id, codigo: p.codigo, nombre: p.nombre, pais: p.pais },
          count: bancalesDetalle.length,
          countMichelin: bancalesDetalle.filter(b => b.cliente === 'MICHELIN').length,
          countContinental: bancalesDetalle.filter(b => b.cliente === 'CONTINENTAL').length,
          ultimaLectura,
          bancales: bancalesDetalle,
        };
      });

      res.json({ plataformas: result });
    } catch (err) { next(err); }
  });

  return router;
};
