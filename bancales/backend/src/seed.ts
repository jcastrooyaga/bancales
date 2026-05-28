import { PrismaClient, Pais } from '@prisma/client';
import bcrypt from 'bcryptjs';

const PLATAFORMAS: { codigo: string; nombre: string; pais: Pais }[] = [
  { codigo: 'ESALB', nombre: 'Albacete', pais: 'ES' },
  { codigo: 'ESALI', nombre: 'Alicante', pais: 'ES' },
  { codigo: 'ESAST', nombre: 'Asturias', pais: 'ES' },
  { codigo: 'ESBCN', nombre: 'Barcelona', pais: 'ES' },
  { codigo: 'ESBIL', nombre: 'Bilbao', pais: 'ES' },
  { codigo: 'ESCOR', nombre: 'Córdoba', pais: 'ES' },
  { codigo: 'ESGRA', nombre: 'Granada', pais: 'ES' },
  { codigo: 'ESJAE', nombre: 'Jaén', pais: 'ES' },
  { codigo: 'ESLER', nombre: 'Lérida', pais: 'ES' },
  { codigo: 'ESMAD', nombre: 'Madrid', pais: 'ES' },
  { codigo: 'ESMAG', nombre: 'Málaga', pais: 'ES' },
  { codigo: 'ESMER', nombre: 'Mérida', pais: 'ES' },
  { codigo: 'ESMUR', nombre: 'Murcia', pais: 'ES' },
  { codigo: 'ESSEV', nombre: 'Sevilla', pais: 'ES' },
  { codigo: 'ESSGO', nombre: 'Santiago de Compostela', pais: 'ES' },
  { codigo: 'ESTAR', nombre: 'Tarragona', pais: 'ES' },
  { codigo: 'ESVLL', nombre: 'Valladolid', pais: 'ES' },
  { codigo: 'ESVLN', nombre: 'Valencia', pais: 'ES' },
  { codigo: 'ESZAR', nombre: 'Zaragoza', pais: 'ES' },
  { codigo: 'PTALG', nombre: 'Algarve', pais: 'PT' },
  { codigo: 'PTLIS', nombre: 'Lisboa', pais: 'PT' },
  { codigo: 'PTPOR', nombre: 'Porto', pais: 'PT' },
  { codigo: 'PTVIS', nombre: 'Viseu', pais: 'PT' },
];

export async function runSeedIfNeeded(prisma: PrismaClient): Promise<void> {
  const platCount = await prisma.plataforma.count();
  if (platCount === 0) {
    console.log('Running initial seed...');
    for (const p of PLATAFORMAS) {
      await prisma.plataforma.upsert({
        where: { codigo: p.codigo },
        update: {},
        create: p,
      });
    }

    await prisma.configuracion.upsert({
      where: { clave: 'umbral_bancal_perdido_semanas' },
      update: {},
      create: { clave: 'umbral_bancal_perdido_semanas', valor: '4' },
    });
    await prisma.configuracion.upsert({
      where: { clave: 'ventana_deduplicacion_minutos' },
      update: {},
      create: { clave: 'ventana_deduplicacion_minutos', valor: '180' },
    });

    console.log('Platform seed complete.');
  }

  // Create platform users if none exist (runs on fresh install and existing DBs without users)
  const userCount = await prisma.usuario.count();
  if (userCount === 0) {
    console.log('Creating platform users...');
    const plataformas = await prisma.plataforma.findMany();
    for (const p of plataformas) {
      const passwordHash = await bcrypt.hash(p.codigo, 10);
      await prisma.usuario.upsert({
        where: { username: p.codigo },
        update: {},
        create: {
          username: p.codigo,
          passwordHash,
          role: 'PLATAFORMA',
          plataformaId: p.id,
        },
      });
    }
    console.log(`Created ${plataformas.length} platform users.`);
  }
}

export async function backfillUltimoTipoEvento(prisma: PrismaClient): Promise<void> {
  const bancales = await prisma.bancal.findMany({
    where: { ultimoTipoEvento: null },
    select: { id: true },
  });
  if (bancales.length === 0) return;

  console.log(`Backfilling ultimoTipoEvento for ${bancales.length} bancales...`);
  for (const b of bancales) {
    const latest = await prisma.evento.findFirst({
      where: { bancalId: b.id },
      orderBy: { lectura: 'desc' },
      select: { tipo: true },
    });
    if (latest) {
      await prisma.bancal.update({ where: { id: b.id }, data: { ultimoTipoEvento: latest.tipo } });
    }
  }
  console.log('Backfill ultimoTipoEvento complete.');
}
