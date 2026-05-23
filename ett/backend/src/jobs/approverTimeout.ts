import { Worker, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

export const APPROVER_TIMEOUT_QUEUE = 'approver-timeout';

export const startApproverTimeoutWorker = (prisma: PrismaClient, redis: Redis) => {
  const worker = new Worker(
    APPROVER_TIMEOUT_QUEUE,
    async (job) => {
      const { requestId, step } = job.data;
      const request = await prisma.request.findUnique({ where: { id: requestId } });
      if (!request || request.status !== 'IN_VALIDATION' || request.currentStep !== step) return;

      if (!request.circuitId) return;
      const circuit = await prisma.validationCircuit.findUnique({
        where: { id: request.circuitId },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
      if (!circuit) return;

      const currentStep = circuit.steps.find(s => s.order === step);
      if (!currentStep?.backupId) return;

      await prisma.requestValidationState.create({
        data: { requestId, step, comment: 'Escalado automáticamente al validador suplente por timeout' },
      });
      console.log(`[TIMEOUT] Request ${requestId} escalated to backup at step ${step}`);
    },
    { connection: redis }
  );

  worker.on('failed', (job, err) => console.error(`[TIMEOUT WORKER] Job failed:`, err));
  return worker;
};
