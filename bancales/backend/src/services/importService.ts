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

// Excel serial date (days since 1899-12-30) to JS Date
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

  // Load config once
  const [cfgVentana] = await Promise.all([
    prisma.configuracion.findUnique({ where: { clave: 'ventana_deduplicacion_minutos' } }),
  ]);
  const ventanaMin = parseInt(cfgVentana?.valor ?? '180');
  const ventanaMs = ventanaMin * 60 * 1000;

  // Cache plataformas
  const plataformaMap = new Map<string, string>(); // codigo -> id
  const plataformas = await prisma.plataforma.findMany({ select: { id: true, codigo: true } });
  plataformas.forEach(p => plataformaMap.set(p.codigo, p.id));

  for (let i = 0; i < rows.length; i++) {
    const fila = i + 2; // row number in Excel (1-indexed header)
    const row = rows[i];

    try {
      const codigoBancal = String(row['BANCAL'] ?? '').trim().toUpperCase();
      const eventoRaw = String(row['EVENTO'] ?? '').trim().toUpperCase();
      const platCodigo = String(row['PLAT'] ?? '').trim().toUpperCase();
      const lecturaRaw = row['LECTURA'];
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

      // Upsert bancal
      const bancal = await prisma.bancal.upsert({
        where: { codigo: codigoBancal },
        update: {},
        create: { codigo: codigoBancal, cliente },
      });

      // Deduplication check
      const tipo = eventoRaw as TipoEvento;
      const existing = await prisma.evento.findFirst({
        where: {
          bancalId: bancal.id,
          plataformaId,
          tipo,
          lectura: {
            gte: new Date(lectura.getTime() - ventanaMs),
            lte: new Date(lectura.getTime() + ventanaMs),
          },
        },
      });
      if (existing) { result.duplicados++; continue; }

      // Create event
      await prisma.evento.create({
        data: { bancalId: bancal.id, plataformaId, tipo, lectura, usuario, fuente: 'IMPORTACION' },
      });

      // Update bancal — reactivate if was inactive, update location if newer reading
      const updateData: Record<string, unknown> = {};
      if (!bancal.activo) updateData.activo = true;
      if (!bancal.ultimaLectura || lectura > bancal.ultimaLectura) {
        updateData.ultimaLectura = lectura;
        updateData.plataformaActualId = plataformaId;
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.bancal.update({ where: { id: bancal.id }, data: updateData });
      }

      result.importados++;
    } catch (err) {
      result.errores.push({ fila, motivo: String(err) });
    }
  }

  return result;
}
