import * as XLSX from 'xlsx';
import { PrismaClient, Cliente, TipoEvento } from '@prisma/client';

interface ImportResult {
  importados: number;
  duplicados: number;
  errores: { fila: number; motivo: string }[];
}

function detectCliente(codigo: string): Cliente | null {
  const upper = codigo.toUpperCase();
  if (upper.startsWith('BC')) return 'MICHELIN';
  if (upper.startsWith('CAT')) return 'CONTINENTAL';
  return null;
}

function excelDateToJS(serial: number): Date {
  const ms = (serial - 25569) * 86400 * 1000;
  return new Date(ms);
}

const VALID_TIPOS: TipoEvento[] = ['CNTI', 'CNTO', 'CNTS'];

export async function processImport(
  prisma: PrismaClient,
  buffer: Buffer
): Promise<ImportResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets['LECTURAS'] ?? workbook.Sheets[workbook.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const result: ImportResult = { importados: 0, duplicados: 0, errores: [] };

  const [cfgVentana] = await Promise.all([
    prisma.configuracion.findUnique({ where: { clave: 'ventana_deduplicacion_minutos' } }),
  ]);
  const ventanaMin = parseInt(cfgVentana?.valor ?? '180');
  const ventanaMs = ventanaMin * 60 * 1000;

  const plataformaMap = new Map<string, string>();
  const plataformas = await prisma.plataforma.findMany({ select: { id: true, codigo: true } });
  plataformas.forEach(p => plataformaMap.set(p.codigo, p.id));

  // Phase 1: validate all rows without hitting the DB
  type ValidRow = {
    fila: number;
    codigoBancal: string;
    cliente: Cliente;
    tipo: TipoEvento;
    plataformaId: string;
    lectura: Date;
    usuario: string;
  };
  const validRows: ValidRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const fila = i + 2;
    const row = rows[i];
    try {
      const codigoBancal = String(row['BANCAL'] ?? '').trim().toUpperCase();
      const eventoRaw = String(row['EVENTO'] ?? '').trim().toUpperCase();
      const platCodigo = String(row['PLAT'] ?? row['PLATAFORMA'] ?? '').trim().toUpperCase();
      const lecturaRaw = row['LECTURA'] ?? row['FECHA'];
      const usuario = String(row['USUARIO'] ?? '').trim();

      if (!codigoBancal) { result.errores.push({ fila, motivo: 'Código de bancal vacío' }); continue; }
      if (!VALID_TIPOS.includes(eventoRaw as TipoEvento)) {
        result.errores.push({ fila, motivo: `Tipo de evento inválido: ${eventoRaw}` }); continue;
      }
      if (!platCodigo) { result.errores.push({ fila, motivo: 'Código de plataforma vacío' }); continue; }
      if (lecturaRaw === null || lecturaRaw === undefined) {
        result.errores.push({ fila, motivo: 'Fecha de lectura vacía' }); continue;
      }
      const cliente = detectCliente(codigoBancal);
      if (!cliente) {
        result.errores.push({ fila, motivo: `Prefijo de bancal no reconocido: ${codigoBancal}` }); continue;
      }
      let lectura: Date;
      if (typeof lecturaRaw === 'number') {
        lectura = excelDateToJS(lecturaRaw);
      } else if (lecturaRaw instanceof Date) {
        lectura = lecturaRaw;
      } else {
        lectura = new Date(String(lecturaRaw));
      }
      if (isNaN(lectura.getTime())) {
        result.errores.push({ fila, motivo: `Fecha inválida: ${lecturaRaw}` }); continue;
      }
      const plataformaId = plataformaMap.get(platCodigo);
      if (!plataformaId) {
        result.errores.push({ fila, motivo: `Plataforma no encontrada: ${platCodigo}` }); continue;
      }
      validRows.push({ fila, codigoBancal, cliente, tipo: eventoRaw as TipoEvento, plataformaId, lectura, usuario });
    } catch (err) {
      result.errores.push({ fila: i + 2, motivo: String(err) });
    }
  }

  if (validRows.length === 0) return result;

  // Phase 2: load or create all bancals in bulk
  const codigoSet = new Set(validRows.map(r => r.codigoBancal));
  const existingBancales = await prisma.bancal.findMany({
    where: { codigo: { in: [...codigoSet] } },
    select: { id: true, codigo: true, ultimaLectura: true, ultimoTipoEvento: true },
  });
  const bancalCache = new Map(
    existingBancales.map(b => [b.codigo, { id: b.id, ultimaLectura: b.ultimaLectura, ultimoTipoEvento: b.ultimoTipoEvento as TipoEvento | null }])
  );

  const newCodigos = [...codigoSet].filter(c => !bancalCache.has(c));
  for (const codigo of newCodigos) {
    const cliente = detectCliente(codigo)!;
    const b = await prisma.bancal.create({ data: { codigo, cliente }, select: { id: true } });
    bancalCache.set(codigo, { id: b.id, ultimaLectura: null, ultimoTipoEvento: null });
  }

  // Phase 3: pre-load existing events in the file's time range for in-memory dedup
  const allBancalIds = [...bancalCache.values()].map(b => b.id);
  const allTs = validRows.map(r => r.lectura.getTime());
  const minTs = Math.min(...allTs);
  const maxTs = Math.max(...allTs);

  const existingEvents = await prisma.evento.findMany({
    where: {
      bancalId: { in: allBancalIds },
      lectura: { gte: new Date(minTs - ventanaMs), lte: new Date(maxTs + ventanaMs) },
    },
    select: { bancalId: true, plataformaId: true, tipo: true, lectura: true },
  });

  type SeenEvent = { bancalId: string; plataformaId: string; tipo: string; ts: number };
  const seenEvents: SeenEvent[] = existingEvents.map(e => ({
    bancalId: e.bancalId,
    plataformaId: e.plataformaId,
    tipo: e.tipo,
    ts: e.lectura.getTime(),
  }));

  const isDuplicate = (bancalId: string, plataformaId: string, tipo: string, ts: number): boolean =>
    seenEvents.some(e =>
      e.bancalId === bancalId && e.plataformaId === plataformaId && e.tipo === tipo &&
      Math.abs(e.ts - ts) <= ventanaMs
    );

  // Phase 4: determine which events to create, track bancal updates
  const eventsToCreate: {
    bancalId: string; plataformaId: string; tipo: TipoEvento;
    lectura: Date; usuario: string; fuente: 'IMPORTACION';
  }[] = [];
  const bancalUpdateMap = new Map<string, { lectura: Date; plataformaId: string; tipo: TipoEvento }>();
  const importedBancalIds = new Set<string>();

  for (const row of validRows) {
    const bancal = bancalCache.get(row.codigoBancal)!;
    const ts = row.lectura.getTime();

    if (isDuplicate(bancal.id, row.plataformaId, row.tipo, ts)) {
      result.duplicados++;
      continue;
    }

    seenEvents.push({ bancalId: bancal.id, plataformaId: row.plataformaId, tipo: row.tipo, ts });
    eventsToCreate.push({ bancalId: bancal.id, plataformaId: row.plataformaId, tipo: row.tipo, lectura: row.lectura, usuario: row.usuario, fuente: 'IMPORTACION' });
    result.importados++;
    importedBancalIds.add(bancal.id);

    const cur = bancalUpdateMap.get(bancal.id);
    if (!bancal.ultimaLectura || row.lectura > bancal.ultimaLectura) {
      if (!cur || row.lectura > cur.lectura) {
        bancalUpdateMap.set(bancal.id, { lectura: row.lectura, plataformaId: row.plataformaId, tipo: row.tipo });
      }
    }
  }

  // Phase 5: bulk insert events
  if (eventsToCreate.length > 0) {
    await prisma.evento.createMany({ data: eventsToCreate });
  }

  // Phase 6: batch update bancals and delete BancalBaja
  if (bancalUpdateMap.size > 0) {
    await prisma.$transaction(
      [...bancalUpdateMap.entries()].map(([bancalId, upd]) =>
        prisma.bancal.update({
          where: { id: bancalId },
          data: { ultimaLectura: upd.lectura, plataformaActualId: upd.plataformaId, ultimoTipoEvento: upd.tipo },
        })
      )
    );
  }

  if (importedBancalIds.size > 0) {
    await prisma.bancalBaja.deleteMany({ where: { bancalId: { in: [...importedBancalIds] } } });
  }

  return result;
}
