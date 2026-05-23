import { Router } from 'express';
import { PrismaClient, Cliente } from '@prisma/client';
import {
  calcInventarioReal,
  calcInventarioTeorico,
  parseWeekParam,
  currentWeek,
  formatWeek,
} from '../services/weekService';

export const createDashboardRouter = (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const semanaParam = String(req.query.semana ?? formatWeek(currentWeek()));
      const yearParam = String(req.query.year ?? currentWeek().year);
      const clienteParam = req.query.cliente as string | undefined;
      const cliente = clienteParam && clienteParam !== 'TODOS'
        ? (clienteParam as Cliente)
        : undefined;

      const w = parseWeekParam(semanaParam, yearParam);

      const cfgUmbral = await prisma.configuracion.findUnique({
        where: { clave: 'umbral_bancal_perdido_semanas' },
      });
      const umbral = parseInt(cfgUmbral?.valor ?? '4');
      const threshold = new Date();
      threshold.setUTCDate(threshold.getUTCDate() - umbral * 7);

      const plataformas = await prisma.plataforma.findMany({
        where: { activa: true },
        orderBy: { codigo: 'asc' },
      });

      // Per-platform calculations
      const filas = await Promise.all(
        plataformas.map(async p => {
          const real = await calcInventarioReal(prisma, p.id, w.year, w.week, cliente);
          const teorico = await calcInventarioTeorico(prisma, p.id, w.year, w.week, cliente);
          const riesgo = await prisma.bancal.count({
            where: {
              plataformaActualId: p.id,
              activo: true,
              ultimaLectura: { lt: threshold },
              ...(cliente ? { cliente } : {}),
            },
          });
          return {
            plataforma: { id: p.id, codigo: p.codigo, nombre: p.nombre, pais: p.pais },
            invReal: real,
            invTeorico: teorico,
            desviacion: real - teorico,
            bancalesRiesgo: riesgo,
          };
        })
      );

      // Global KPIs
      const clienteFilter = cliente ? { cliente } : {};
      const totalEnCircuito = await prisma.bancal.count({
        where: { activo: true, ultimaLectura: { gte: threshold }, ...clienteFilter },
      });
      const totalMichelin = await prisma.bancal.count({
        where: { cliente: 'MICHELIN', activo: true, ultimaLectura: { gte: threshold } },
      });
      const totalContinental = await prisma.bancal.count({
        where: { cliente: 'CONTINENTAL', activo: true, ultimaLectura: { gte: threshold } },
      });
      const totalRiesgo = await prisma.bancal.count({
        where: { activo: true, ultimaLectura: { lt: threshold }, ...clienteFilter },
      });
      const plataformasDesviacion = filas.filter(f => f.desviacion < 0).length;

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
