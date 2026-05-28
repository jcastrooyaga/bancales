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

      const [plataformas, allEvents] = await Promise.all([
        prisma.plataforma.findMany({ where: { activa: true }, orderBy: { codigo: 'asc' } }),
        prisma.evento.findMany({
          where: { ...mcf, bancal: { activo: true } },
          select: { bancalId: true, plataformaId: true, tipo: true, lectura: true },
          orderBy: { lectura: 'asc' },
        }),
      ]);

      // Pass 1: find most recent CNTS date per platform (last CNTS = inventory anchor)
      const latestCntsDateMap = new Map<string, Date>();
      for (const e of allEvents) {
        if (e.tipo === 'CNTS') latestCntsDateMap.set(e.plataformaId, e.lectura);
      }

      // Precompute end-of-day of last CNTS per platform (movements start after this)
      const lastCntsDayEndMap = new Map<string, Date>();
      for (const [pid, d] of latestCntsDateMap) {
        lastCntsDayEndMap.set(pid, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)));
        // Also store start for matching base CNTS events
      }
      const lastCntsDayStartMap = new Map<string, Date>();
      for (const [pid, d] of latestCntsDateMap) {
        lastCntsDayStartMap.set(pid, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)));
      }

      // Pass 2: build per-platform sets using same logic as "bancales en plataforma"
      // baseCnts: CNTS on the last CNTS day (inventory base)
      // cntiAfter: CNTI after that day (entries since last inventory)
      // cntoAfter: CNTO after that day (exits since last inventory)
      // lastEvtMap: most recent event per bancal at this platform (for detail display)
      type Build = {
        baseCnts: Set<string>;
        cntiAfter: Set<string>;
        cntoAfter: Set<string>;
        lastEvtMap: Map<string, { tipo: string; lectura: Date }>;
      };
      const platformBuilds = new Map<string, Build>();
      for (const p of plataformas) {
        platformBuilds.set(p.id, { baseCnts: new Set(), cntiAfter: new Set(), cntoAfter: new Set(), lastEvtMap: new Map() });
      }

      for (const e of allEvents) {
        const build = platformBuilds.get(e.plataformaId);
        if (!build) continue;

        const dayStart = lastCntsDayStartMap.get(e.plataformaId);
        const dayEnd = lastCntsDayEndMap.get(e.plataformaId);

        if (dayStart && dayEnd) {
          if (e.tipo === 'CNTS' && e.lectura >= dayStart && e.lectura <= dayEnd) {
            build.baseCnts.add(e.bancalId);
          } else if (e.tipo === 'CNTI' && e.lectura > dayEnd) {
            build.cntiAfter.add(e.bancalId);
          } else if (e.tipo === 'CNTO' && e.lectura > dayEnd) {
            build.cntoAfter.add(e.bancalId);
          }
        }

        // Ascending order → last write is most recent event at this platform
        build.lastEvtMap.set(e.bancalId, { tipo: e.tipo, lectura: e.lectura });
      }

      // Compute expectedIds per platform: baseCnts + cntiAfter − cntoAfter
      const platformExpectedMap = new Map<string, Set<string>>();
      const allExpectedIds = new Set<string>();
      for (const p of plataformas) {
        const build = platformBuilds.get(p.id)!;
        const expectedIds = new Set([...build.baseCnts, ...build.cntiAfter]);
        for (const id of build.cntoAfter) expectedIds.delete(id);
        platformExpectedMap.set(p.id, expectedIds);
        for (const id of expectedIds) allExpectedIds.add(id);
      }

      // Single batch fetch for all needed bancals
      const bancales = allExpectedIds.size > 0
        ? await prisma.bancal.findMany({
            where: { id: { in: [...allExpectedIds] }, activo: true },
            select: { id: true, codigo: true, cliente: true },
          })
        : [];
      const bancalMap = new Map(bancales.map(b => [b.id, b]));

      const result = plataformas.map(p => {
        const expectedIds = platformExpectedMap.get(p.id) ?? new Set<string>();
        const build = platformBuilds.get(p.id)!;

        const bancalesDetalle = [...expectedIds].flatMap(id => {
          const b = bancalMap.get(id);
          if (!b) return [];
          const evt = build.lastEvtMap.get(id);
          return [{ id, codigo: b.codigo, cliente: b.cliente as string, ultimoTipo: evt?.tipo ?? '', ultimaLectura: evt?.lectura ?? null }];
        }).sort((a, b) => a.codigo.localeCompare(b.codigo));

        const ultimaLectura = bancalesDetalle.reduce<Date | null>(
          (max, b) => b.ultimaLectura && (!max || b.ultimaLectura > max) ? b.ultimaLectura : max,
          null
        );

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
