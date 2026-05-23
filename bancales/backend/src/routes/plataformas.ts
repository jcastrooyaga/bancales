import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import {
  calcInventarioReal,
  calcInventarioTeorico,
  parseWeekParam,
  currentWeek,
  previousWeek,
  formatWeek,
  getWeekBounds,
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
      const threshold = new Date();
      threshold.setUTCDate(threshold.getUTCDate() - umbral * 7);

      // Week bounds for current and previous week
      const bounds = getWeekBounds(w.year, w.week);
      const prevW = previousWeek(w);
      const prevBounds = getWeekBounds(prevW.year, prevW.week);

      // --- Resumen semanal ---
      type EvtRow = { bancalId: string; lectura: Date; bancal: { codigo: string; cliente: string } };
      const mapEvt = (e: EvtRow) => ({ codigo: e.bancal.codigo, cliente: e.bancal.cliente, lectura: e.lectura });

      const [prevCntsEvts, cntiEvts, cntoEvts, cntsEvts] = await Promise.all([
        // Previous week CNTS (distinct bancals)
        prisma.evento.findMany({
          where: { plataformaId: plataforma.id, tipo: 'CNTS',
            lectura: { gte: prevBounds.cntsStart, lte: prevBounds.cntsEnd } },
          include: { bancal: { select: { codigo: true, cliente: true } } },
          distinct: ['bancalId'], orderBy: { bancal: { codigo: 'asc' } },
        }),
        // CNTI this week (all events, used for detail list)
        prisma.evento.findMany({
          where: { plataformaId: plataforma.id, tipo: 'CNTI',
            lectura: { gte: bounds.cntiStart, lte: bounds.cntiEnd } },
          include: { bancal: { select: { codigo: true, cliente: true } } },
          orderBy: { lectura: 'asc' },
        }),
        // CNTO this week
        prisma.evento.findMany({
          where: { plataformaId: plataforma.id, tipo: 'CNTO',
            lectura: { gte: bounds.cntoStart, lte: bounds.cntoEnd } },
          include: { bancal: { select: { codigo: true, cliente: true } } },
          orderBy: { lectura: 'asc' },
        }),
        // Current week CNTS (distinct bancals)
        prisma.evento.findMany({
          where: { plataformaId: plataforma.id, tipo: 'CNTS',
            lectura: { gte: bounds.cntsStart, lte: bounds.cntsEnd } },
          include: { bancal: { select: { codigo: true, cliente: true } } },
          distinct: ['bancalId'], orderBy: { bancal: { codigo: 'asc' } },
        }),
      ]);

      const invRealAnterior = prevCntsEvts.length;
      const invReal = cntsEvts.length;
      const cntiIds = new Set(cntiEvts.map(e => e.bancalId));
      const cntoIds = new Set(cntoEvts.map(e => e.bancalId));
      const invTeorico = invRealAnterior + cntiIds.size - cntoIds.size;

      const resumenSemana = {
        invRealAnterior,
        cntiCount: cntiIds.size,
        cntoCount: cntoIds.size,
        invTeorico,
        invReal,
        desviacion: invReal - invTeorico,
        invRealAnteriorDetalle: prevCntsEvts.map(mapEvt),
        cntiDetalle: cntiEvts.map(mapEvt),
        cntoDetalle: cntoEvts.map(mapEvt),
        invRealDetalle: cntsEvts.map(mapEvt),
      };

      // --- Descuadre ---
      // Expected: (prev CNTS ∪ CNTI this week) minus CNTO this week, not in current CNTS
      const prevCntsIds = new Set(prevCntsEvts.map(e => e.bancalId));
      const cntsIds = new Set(cntsEvts.map(e => e.bancalId));
      const expectedIds = new Set([...prevCntsIds, ...cntiIds]);
      for (const id of cntoIds) expectedIds.delete(id);
      const descuadreIds = [...expectedIds].filter(id => !cntsIds.has(id));

      const descuadre = descuadreIds.length > 0
        ? (await prisma.bancal.findMany({
            where: { id: { in: descuadreIds } },
            select: { id: true, codigo: true, cliente: true, ultimaLectura: true },
            orderBy: { codigo: 'asc' },
          })).map(b => ({ ...b, motivo: prevCntsIds.has(b.id) ? 'ANTERIOR' : 'ENTRADA' as const }))
        : [];

      // --- Latest event per bancal at this platform (single query) ---
      type LatestRow = { bancalId: string; tipo: string; lectura: Date; codigo: string; cliente: string };
      const latestAtPlatform = await prisma.$queryRaw<LatestRow[]>`
        SELECT DISTINCT ON (e."bancalId")
          e."bancalId",
          e.tipo::text,
          e.lectura,
          b.codigo,
          b.cliente::text
        FROM "Evento" e
        JOIN "Bancal" b ON b.id = e."bancalId"
        WHERE e."plataformaId" = ${plataforma.id}
        ORDER BY e."bancalId", e.lectura DESC
      `;

      // Bancales en plataforma: last event at this platform is NOT CNTO
      const bancalesEnPlataforma = latestAtPlatform
        .filter(r => r.tipo !== 'CNTO')
        .map(r => ({ id: r.bancalId, codigo: r.codigo, cliente: r.cliente, ultimaLectura: r.lectura }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo));

      // Bancales en riesgo: still in platform (not CNTO) and last event older than threshold
      const bancalesRiesgo = latestAtPlatform
        .filter(r => r.tipo !== 'CNTO' && new Date(r.lectura) < threshold)
        .map(r => ({ id: r.bancalId, codigo: r.codigo, cliente: r.cliente, ultimaLectura: r.lectura }))
        .sort((a, b) => new Date(a.ultimaLectura).getTime() - new Date(b.ultimaLectura).getTime());

      // --- Historico (last 12 weeks) ---
      const historico = [];
      let cur = w;
      for (let i = 0; i < 12; i++) {
        const real = await calcInventarioReal(prisma, plataforma.id, cur.year, cur.week);
        const teorico = await calcInventarioTeorico(prisma, plataforma.id, cur.year, cur.week);
        historico.unshift({ semana: formatWeek(cur), year: cur.year, real, teorico, desviacion: real - teorico });
        cur = previousWeek(cur);
      }

      res.json({ plataforma, historico, resumenSemana, bancalesEnPlataforma, descuadre, bancalesRiesgo });
    } catch (err) { next(err); }
  });

  return router;
};
