import { PrismaClient, Cliente } from '@prisma/client';

export interface WeekId {
  year: number;
  week: number;
}

export function parseWeekParam(semana: string, year: string): WeekId {
  const w = parseInt(semana.replace(/^W/i, ''));
  const y = parseInt(year);
  if (isNaN(w) || isNaN(y) || w < 1 || w > 53) throw new Error('Invalid week/year');
  return { year: y, week: w };
}

export function formatWeek(w: WeekId): string {
  return `W${String(w.week).padStart(2, '0')}`;
}

export function currentWeek(): WeekId {
  return isoWeekOf(new Date());
}

export function isoWeekOf(date: Date): WeekId {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function getMondayOfWeek(year: number, week: number): Date {
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dow + 1 + (week - 1) * 7);
  return monday;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

export function getWeekBounds(year: number, week: number) {
  const monday = getMondayOfWeek(year, week);
  const thursday = addDays(monday, 3);  // jueves semana actual (día de inventario CNTS)
  const wednesday = addDays(monday, 2); // miércoles semana actual
  const prevFriday = addDays(monday, -3); // viernes semana anterior

  return {
    // Movimientos semana N: viernes W_{N-1} 00:00 → miércoles W_N 23:59
    // El jueves es exclusivo para inventario (CNTS): no se cuentan CNTI/CNTO ese día
    cntiStart: startOfDay(prevFriday),
    cntiEnd: endOfDay(wednesday),
    cntoStart: startOfDay(prevFriday),
    cntoEnd: endOfDay(wednesday),
    // CNTS: todo el día del jueves actual
    cntsStart: startOfDay(thursday),
    cntsEnd: endOfDay(thursday),
    thursday,
    monday,
  };
}

export function previousWeek(w: WeekId): WeekId {
  if (w.week === 1) {
    const dec28 = new Date(Date.UTC(w.year - 1, 11, 28));
    return isoWeekOf(dec28);
  }
  return { year: w.year, week: w.week - 1 };
}

export function nextWeek(w: WeekId): WeekId {
  const monday = getMondayOfWeek(w.year, w.week);
  const nextMonday = addDays(monday, 7);
  return isoWeekOf(nextMonday);
}

export function buildManualCutoffFilter(manualCutoff?: Date | null) {
  if (!manualCutoff) return {};
  return {
    OR: [
      { fuente: 'IMPORTACION' as const },
      { fuente: 'MANUAL' as const, lectura: { gte: manualCutoff } },
    ],
  };
}

export async function calcInventarioReal(
  prisma: PrismaClient,
  plataformaId: string,
  year: number,
  week: number,
  cliente?: Cliente,
  manualCutoff?: Date | null
): Promise<number> {
  const { cntsStart, cntsEnd } = getWeekBounds(year, week);
  const eventos = await prisma.evento.findMany({
    where: {
      plataformaId,
      tipo: 'CNTS',
      lectura: { gte: cntsStart, lte: cntsEnd },
      ...(cliente ? { bancal: { cliente } } : {}),
      ...buildManualCutoffFilter(manualCutoff),
    },
    distinct: ['bancalId'],
    select: { bancalId: true },
  });
  return eventos.length;
}

export async function calcInventarioTeorico(
  prisma: PrismaClient,
  plataformaId: string,
  year: number,
  week: number,
  cliente?: Cliente,
  manualCutoff?: Date | null
): Promise<number> {
  const prev = previousWeek({ year, week });
  const inventarioRealPrev = await calcInventarioReal(prisma, plataformaId, prev.year, prev.week, cliente, manualCutoff);
  const { cntiStart, cntiEnd, cntoStart, cntoEnd } = getWeekBounds(year, week);

  const clienteFilter = cliente ? { bancal: { cliente } } : {};
  const mcf = buildManualCutoffFilter(manualCutoff);

  const cntiEvts = await prisma.evento.findMany({
    where: { plataformaId, tipo: 'CNTI', lectura: { gte: cntiStart, lte: cntiEnd }, ...clienteFilter, ...mcf },
    select: { bancalId: true },
    distinct: ['bancalId'],
  });
  const cntoEvts = await prisma.evento.findMany({
    where: { plataformaId, tipo: 'CNTO', lectura: { gte: cntoStart, lte: cntoEnd }, ...clienteFilter, ...mcf },
    select: { bancalId: true },
    distinct: ['bancalId'],
  });

  return inventarioRealPrev + cntiEvts.length - cntoEvts.length;
}

export async function getBancalesEnRiesgo(
  prisma: PrismaClient,
  plataformaId: string,
  umbralSemanas: number,
  cliente?: Cliente
): Promise<number> {
  const threshold = new Date();
  threshold.setUTCDate(threshold.getUTCDate() - umbralSemanas * 7);

  return prisma.bancal.count({
    where: {
      plataformaActualId: plataformaId,
      activo: true,
      ultimaLectura: { lt: threshold },
      ...(cliente ? { cliente } : {}),
    },
  });
}
