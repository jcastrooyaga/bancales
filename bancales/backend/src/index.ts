import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { createApp } from './app';
import { runSeedIfNeeded } from './seed';

const prisma = new PrismaClient();

async function main() {
  await runSeedIfNeeded(prisma);
  const app = createApp(prisma);
  app.listen(config.port, () => {
    console.log(`Bancales server running on port ${config.port}`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
