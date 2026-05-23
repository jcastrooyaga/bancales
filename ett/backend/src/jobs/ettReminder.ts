import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { sendEttReminder } from '../services/emailService';

export const ETT_REMINDER_QUEUE = 'ett-reminder';
const REMINDER_DAYS = 3;

export const startEttReminderWorker = (prisma: PrismaClient, redis: Redis) => {
  const worker = new Worker(
    ETT_REMINDER_QUEUE,
    async () => {
      const cutoff = new Date(Date.now() - REMINDER_DAYS * 24 * 60 * 60 * 1000);
      const pending = await prisma.request.findMany({
        where: { status: 'APPROVED', approvedAt: { lte: cutoff } },
        include: { ett: { include: { emailRouting: { where: { active: true } } } } },
      });

      for (const req of pending) {
        for (const routing of req.ett.emailRouting) {
          await sendEttReminder(routing.email, req.code);
        }
      }
    },
    { connection: redis }
  );

  worker.on('failed', (job, err) => console.error(`[REMINDER WORKER] Job failed:`, err));
  return worker;
};
