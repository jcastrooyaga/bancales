import { Router } from 'express';
import { PrismaClient, Cliente } from '@prisma/client';
import {
  calcInventarioReal,
  parseWeekParam,
  currentWeek,
  formatWeek,
  isoWeekOf,
  previousWeek,
  getWeekBounds,
  buildManualCutoffFilter,
} from '../services/weekService';

export const createDashboardRouter = (prisma: PrismaClient) => {
  const router = Router();

  // Returns the ISO week of the most recent CNTS event, or current week if no data
  router.get('/ultima-semana', async (_req, res, next) => {
    try {
      const lastCnts = await prisma.evento.findFirst({
        where: { tipo: 'CNTS' },
        orderBy: { lectura: 'desc' },
        select: { lectura: true },
      });
      if (!lastCnts) {
        const cw = currentWeek();
        return res.json({ week: cw.week, year: cw.year });
      }
      const w = isoWeekOf(lastCnts.lectura);
      res.json({ week: w.week, year: w.year });
    } catch (err) { next(err); }
  });

  router.get('/', async (req, res, next) => {
    try {
      const semanaParam = String(req.query.semana ?? formatWeek(currentWeek()));
      const yearParam = String(req.query.year ?? currentWeek().year);
      const clienteParam = req.query.cliente as string | undefined;
      const cliente = clienteParam && clienteParam !== 'TODOS'
        ? (clienteParam as Cliente)
        : undefined;

      const w = parseWeekParam(semanaParam, yearParam);

      const [cfgUmbral, oldestImported] = await Promise.all([
        prisma.configuracion.findUnique({ where: { clave: 'umbral_bancal_perdido_semanas' } }),
        prisma.evento.findFirst({ where: { fuente: 'IMPORTACION' }, orderBy: { lectura: 'asc' }, select: { lectura: true } }),
      ]);
      const umbral = parseInt(cfgUmbral?.valor ?? '4');
      const { thursday } = getWeekBounds(w.year, w.week);
      const threshold = new Date(thursday);
      threshold.setUTCDate(threshold.getUTCDate() - umbral * 7);
      const manualCutoff = oldestImported?.lectura ?? null;
      const mcf = buildManualCutoffFilter(manualCutoff);

      const plataformas = await prisma.plataforma.findMany({
        where: { activa: true },
        orderBy: { codigo: 'asc' },
      });

      // Per-platform calculations
      const prev = previousWeek(w);
      const { cntiStart, cntiEnd, cntoStart, cntoEnd, cntsEnd } = getWeekBounds(w.year, w.week);

      const filas = await Promise.all(
        plataformas.map(async p => {
          const clienteFilter = { bancal: { baja: { is: null as null }, ...(cliente ? { cliente } : {}) } };
          const [real, prevReal, cntiEvts, cntoEvts] = await Promise.all([
            calcInventarioReal(prisma, p.id, w.year, w.week, cliente, manualCutoff),
            calcInventarioReal(prisma, p.id, prev.year, prev.week, cliente, manualCutoff),
            prisma.evento.findMany({
              where: { plataformaId: p.id, tipo: 'CNTI', lectura: { gte: cntiStart, lte: cntiEnd }, ...clienteFilter, ...mcf },
              select: { bancalId: true }, distinct: ['bancalId'],
            }),
            prisma.evento.findMany({
              where: { plataformaId: p.id, tipo: 'CNTO', lectura: { gte: cntoStart, lte: cntoEnd }, ...clienteFilter, ...mcf },
              select: { bancalId: true }, distinct: ['bancalId'],
            }),
          ]);
          const cntiCount = cntiEvts.length;
          const cntoCount = cntoEvts.length;
          const invTeorico = prevReal + cntiCount - cntoCount;
          const desviacion = real - invTeorico;

          // Match detail page logic: exclude bancals whose last event at this platform is CNTO
          const allEvtsHere = await prisma.evento.findMany({
            where: { plataformaId: p.id, ...mcf },
            select: { bancalId: true, tipo: true },
            orderBy: { lectura: 'asc' },
          });
          const latestHereMap = new Map<string, string>();
          for (const e of allEvtsHere) latestHereMap.set(e.bancalId, e.tipo);

          const riesgoCandidateIds = [...latestHereMap.entries()]
            .filter(([_, tipo]) => tipo !== 'CNTO')
            .map(([id]) => id);
          const riesgoRows = await prisma.bancal.findMany({
            where: { id: { in: riesgoCandidateIds }, ultimaLectura: { lt: threshold }, baja: { is: null }, ultimoTipoEvento: { not: 'CNTO' }, ...(cliente ? { cliente } : {}) },
            select: { id: true },
          });
          const riesgo = riesgoRows.length;
          return {
            plataforma: { id: p.id, codigo: p.codigo, nombre: p.nombre, pais: p.pais },
            invReal: real,
            invTeorico,
            desviacion,
            prevReal,
            cntiCount,
            cntoCount,
            bancalesRiesgo: riesgo,
          };
        })
      );

      // Global KPIs — cumulative distinct bancals seen from start of data up to end of selected week's Thursday
      const upTo = cntsEnd; // endOfDay(thursday) of selected week
      const clienteFilterKpi = { bancal: { baja: { is: null as null }, ...(cliente ? { cliente } : {}) } };
      const [ecEvts, michelinEvts, continentalEvts] = await Promise.all([
        prisma.evento.findMany({
          where: { lectura: { lte: upTo }, ...clienteFilterKpi, ...mcf },
          select: { bancalId: true }, distinct: ['bancalId'],
        }),
        prisma.evento.findMany({
          where: { lectura: { lte: upTo }, bancal: { cliente: 'MICHELIN', baja: { is: null } }, ...mcf },
          select: { bancalId: true }, distinct: ['bancalId'],
        }),
        prisma.evento.findMany({
          where: { lectura: { lte: upTo }, bancal: { cliente: 'CONTINENTAL', baja: { is: null } }, ...mcf },
          select: { bancalId: true }, distinct: ['bancalId'],
        }),
      ]);
      const totalEnCircuito = ecEvts.length;
      const totalMichelin = michelinEvts.length;
      const totalContinental = continentalEvts.length;
      const plataformasDesviacion = filas.filter(f => f.desviacion !== 0).length;
      const totalRiesgo = filas.reduce((sum, f) => sum + f.bancalesRiesgo, 0);

      res.json({
        semana: formatWeek(w),
        year: w.year,
        kpis: { totalEnCircuito, totalMichelin, totalContinental, totalRiesgo, plataformasDesviacion },
        plataformas: filas,
      });
    } catch (err) { next(err); }
  });

  return router;
};
