import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { config } from './config';
import { createApp } from './app';
import { startApproverTimeoutWorker } from './jobs/approverTimeout';
import { startEttReminderWorker } from './jobs/ettReminder';

const prisma = new PrismaClient();
const redis = new Redis(config.redisUrl);
const bullRedis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

const app = createApp(prisma);

startApproverTimeoutWorker(prisma, bullRedis);
startEttReminderWorker(prisma, bullRedis);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  redis.disconnect();
  bullRedis.disconnect();
  process.exit(0);
});
