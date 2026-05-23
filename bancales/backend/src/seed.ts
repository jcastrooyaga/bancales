import { PrismaClient, Pais } from '@prisma/client';

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
  const count = await prisma.plataforma.count();
  if (count > 0) return; // already seeded

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

  console.log('Seed complete.');
}
