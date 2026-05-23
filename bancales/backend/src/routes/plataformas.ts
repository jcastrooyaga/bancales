import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createError } from '../middleware/errorHandler';
import { requireAdmin } from '../middleware/auth';
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

  router.post('/', requireAdmin, async (req, res, next) => {
    try {
      const { codigo, nombre, pais } = req.body;
      if (!codigo || !nombre || !pais) throw createError(400, 'Faltan campos requeridos');
      if (!['ES', 'PT'].includes(pais)) throw createError(400, 'País inválido');
      const existing = await prisma.plataforma.findUnique({ where: { codigo: codigo.toUpperCase() } });
      if (existing) throw createError(409, 'Ya existe una plataforma con ese código');
      const p = await prisma.plataforma.create({
        data: { codigo: codigo.toUpperCase(), nombre, pais },
      });
      const passwordHash = await bcrypt.hash(p.codigo, 10);
      await prisma.usuario.create({
        data: { username: p.codigo, passwordHash, role: 'PLATAFORMA', plataformaId: p.id },
      });
      res.status(201).json(p);
    } catch (err) { next(err); }
  });

  router.put('/:id', requireAdmin, async (req, res, next) => {
    try {
      const { nombre, activa } = req.body;
      const update: Record<string, unknown> = {};
      if (nombre !== undefined) update.nombre = nombre;
      if (activa !== undefined) update.activa = Boolean(activa);
      const p = await prisma.plataforma.update({ where: { id: req.params.id }, data: update });
      res.json(p);
    } catch (err) { next(err); }
  });

  router.put('/:codigo/password', requireAdmin, async (req, res, next) => {
    try {
      const { password } = req.body;
      if (!password || String(password).length < 4) throw createError(400, 'La contraseña debe tener al menos 4 caracteres');
      const plataforma = await prisma.plataforma.findUnique({ where: { codigo: req.params.codigo.toUpperCase() } });
      if (!plataforma) throw createError(404, 'Plataforma no encontrada');
      const hash = await bcrypt.hash(String(password), 10);
      await prisma.usuario.update({ where: { plataformaId: plataforma.id }, data: { passwordHash: hash } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // Auto-create user when a new platform is created (handled in POST above via afterCreate hook)
  router.get('/:codigo/detalle', async (req, res, next) => {
    try {
      const plataforma = await prisma.plataforma.findUnique({ where: { codigo: req.params.codigo.toUpperCase() } });
      if (!plataforma) throw createError(404, 'Plataforma no encontrada');

      const semanaParam = String(req.query.semana ?? formatWeek(currentWeek()));
      const yearParam = String(req.query.year ?? currentWeek().year);
      const w = parseWeekParam(semanaParam, yearParam);

      const cfgUmbral = await prisma.configuracion.findUnique({ where: { clave: 'umbral_bancal_perdido_semanas' } });
      const umbral = parseInt(cfgUmbral?.valor ?? '4');
      const threshold = new Date();
      threshold.setUTCDate(threshold.getUTCDate() - umbral * 7);

      const bounds = getWeekBounds(w.year, w.week);
      const prevW = previousWeek(w);
      const prevBounds = getWeekBounds(prevW.year, prevW.week);

      // Fetch raw event lists (only bancalId + lectura — no distinct, no include, no raw SQL)
      const simpleSelect = { bancalId: true, lectura: true };
      const [prevCntsRaw, cntiRaw, cntoRaw, cntsRaw] = await Promise.all([
        prisma.evento.findMany({
          where: { plataformaId: plataforma.id, tipo: 'CNTS',
            lectura: { gte: prevBounds.cntsStart, lte: prevBounds.cntsEnd } },
          select: simpleSelect, orderBy: { lectura: 'asc' },
        }),
        prisma.evento.findMany({
          where: { plataformaId: plataforma.id, tipo: 'CNTI',
            lectura: { gte: bounds.cntiStart, lte: bounds.cntiEnd } },
          select: simpleSelect, orderBy: { lectura: 'asc' },
        }),
        prisma.evento.findMany({
          where: { plataformaId: plataforma.id, tipo: 'CNTO',
            lectura: { gte: bounds.cntoStart, lte: bounds.cntoEnd } },
          select: simpleSelect, orderBy: { lectura: 'asc' },
        }),
        prisma.evento.findMany({
          where: { plataformaId: plataforma.id, tipo: 'CNTS',
            lectura: { gte: bounds.cntsStart, lte: bounds.cntsEnd } },
          select: simpleSelect, orderBy: { lectura: 'asc' },
        }),
      ]);

      // De-duplicate CNTS by bancalId in JS (keep earliest per bancal)
      const dedupByBancal = (rows: { bancalId: string; lectura: Date }[]) => {
        const seen = new Set<string>();
        return rows.filter(r => seen.has(r.bancalId) ? false : (seen.add(r.bancalId), true));
      };
      const prevCntsEvts = dedupByBancal(prevCntsRaw);
      const cntsEvts = dedupByBancal(cntsRaw);

      // Distinct bancalId sets
      const prevCntsIds = new Set(prevCntsEvts.map(e => e.bancalId));
      const cntiIds = new Set(cntiRaw.map(e => e.bancalId));
      const cntoIds = new Set(cntoRaw.map(e => e.bancalId));
      const cntsIds = new Set(cntsEvts.map(e => e.bancalId));

      // Fetch bancal details for all IDs referenced in this week
      const allIds = new Set([...prevCntsIds, ...cntiIds, ...cntoIds, ...cntsIds]);
      const bancalesMap = new Map<string, { codigo: string; cliente: string }>();
      if (allIds.size > 0) {
        const bancales = await prisma.bancal.findMany({
          where: { id: { in: [...allIds] } },
          select: { id: true, codigo: true, cliente: true },
        });
        bancales.forEach(b => bancalesMap.set(b.id, { codigo: b.codigo, cliente: b.cliente }));
      }

      const mapEvt = (e: { bancalId: string; lectura: Date }) => ({
        codigo: bancalesMap.get(e.bancalId)?.codigo ?? '',
        cliente: bancalesMap.get(e.bancalId)?.cliente ?? '',
        lectura: e.lectura,
      });

      // --- Resumen semanal ---
      const invRealAnterior = prevCntsEvts.length;
      const invReal = cntsEvts.length;
      const invTeorico = invRealAnterior + cntiIds.size - cntoIds.size;

      const resumenSemana = {
        invRealAnterior,
        cntiCount: cntiIds.size,
        cntoCount: cntoIds.size,
        invTeorico,
        invReal,
        desviacion: invReal - invTeorico,
        invRealAnteriorDetalle: prevCntsEvts.map(mapEvt).sort((a, b) => a.codigo.localeCompare(b.codigo)),
        cntiDetalle: cntiRaw.map(mapEvt),
        cntoDetalle: cntoRaw.map(mapEvt),
        invRealDetalle: cntsEvts.map(mapEvt).sort((a, b) => a.codigo.localeCompare(b.codigo)),
      };

      // --- Descuadre ---
      const expectedIds = new Set([...prevCntsIds, ...cntiIds]);
      for (const id of cntoIds) expectedIds.delete(id);
      const descuadreIds = [...expectedIds].filter(id => !cntsIds.has(id));

      let descuadre: { id: string; codigo: string; cliente: string; ultimaLectura: Date | null; motivo: 'ANTERIOR' | 'ENTRADA' }[] = [];
      if (descuadreIds.length > 0) {
        const rows = await prisma.bancal.findMany({
          where: { id: { in: descuadreIds }, plataformaActualId: plataforma.id },
          select: { id: true, codigo: true, cliente: true, ultimaLectura: true },
          orderBy: { codigo: 'asc' },
        });
        descuadre = rows.map(b => ({
          ...b,
          cliente: b.cliente as string,
          motivo: prevCntsIds.has(b.id) ? 'ANTERIOR' : 'ENTRADA',
        }));
      }

      // --- Bancales en plataforma (week-aware) ---
      // Build a map of the most recent relevant event for each bancal within the selected week's scope:
      // prevCnts → cnti → cnts (later event wins)
      const bancalEvtMap = new Map<string, { tipo: string; lectura: Date }>();
      for (const e of prevCntsEvts) {
        bancalEvtMap.set(e.bancalId, { tipo: 'CNTS', lectura: e.lectura });
      }
      for (const e of cntiRaw) {
        const cur = bancalEvtMap.get(e.bancalId);
        if (!cur || e.lectura > cur.lectura) bancalEvtMap.set(e.bancalId, { tipo: 'CNTI', lectura: e.lectura });
      }
      for (const e of cntsEvts) {
        const cur = bancalEvtMap.get(e.bancalId);
        if (!cur || e.lectura > cur.lectura) bancalEvtMap.set(e.bancalId, { tipo: 'CNTS', lectura: e.lectura });
      }

      // En plataforma = expectedIds ∪ cntsIds (expected + confirmed, covers both descuadre and sobrantes)
      const bancalesInPlatformIds = new Set([...expectedIds, ...cntsIds]);
      const bancalesEnPlataforma = [...bancalesInPlatformIds].map(id => {
        const b = bancalesMap.get(id);
        const evt = bancalEvtMap.get(id);
        return {
          id,
          codigo: b?.codigo ?? '',
          cliente: (b?.cliente ?? '') as string,
          ultimaLectura: evt?.lectura ?? null,
          ultimoTipo: evt?.tipo ?? null,
        };
      }).sort((a, b) => a.codigo.localeCompare(b.codigo));

      // Sobrantes: confirmed by CNTS but not expected (in cnts but not in prevCnts+cnti-cnto)
      const sobrantes = [...cntsIds].filter(id => !expectedIds.has(id)).map(id => {
        const b = bancalesMap.get(id);
        const evt = bancalEvtMap.get(id);
        return {
          id,
          codigo: b?.codigo ?? '',
          cliente: (b?.cliente ?? '') as string,
          ultimaLectura: evt?.lectura ?? null,
          ultimoTipo: 'CNTS' as string,
        };
      }).sort((a, b) => a.codigo.localeCompare(b.codigo));

      // --- Bancales en riesgo (current global state, independent of selected week) ---
      const allEvtsHere = await prisma.evento.findMany({
        where: { plataformaId: plataforma.id },
        select: { bancalId: true, tipo: true, lectura: true },
        orderBy: { lectura: 'asc' },
      });
      const latestHereMap = new Map<string, string>();
      for (const e of allEvtsHere) latestHereMap.set(e.bancalId, e.tipo);

      const candidatos = await prisma.bancal.findMany({
        where: { plataformaActualId: plataforma.id },
        select: { id: true, codigo: true, cliente: true, ultimaLectura: true },
        orderBy: { codigo: 'asc' },
      });

      const bancalesRiesgo = candidatos
        .filter(b => latestHereMap.get(b.id) !== 'CNTO'
          && b.ultimaLectura !== null && b.ultimaLectura < threshold)
        .map(b => ({ id: b.id, codigo: b.codigo, cliente: b.cliente as string, ultimaLectura: b.ultimaLectura }))
        .sort((a, b) => (a.ultimaLectura?.getTime() ?? 0) - (b.ultimaLectura?.getTime() ?? 0));

      // --- Historico (last 12 weeks) ---
      const historico = [];
      let cur = w;
      for (let i = 0; i < 12; i++) {
        const real = await calcInventarioReal(prisma, plataforma.id, cur.year, cur.week);
        const teorico = await calcInventarioTeorico(prisma, plataforma.id, cur.year, cur.week);
        historico.unshift({ semana: formatWeek(cur), year: cur.year, real, teorico, desviacion: real - teorico });
        cur = previousWeek(cur);
      }

      res.json({ plataforma, historico, resumenSemana, bancalesEnPlataforma, sobrantes, descuadre, bancalesRiesgo, umbral });
    } catch (err) { next(err); }
  });

  return router;
};
