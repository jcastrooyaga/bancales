import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ett.local' },
    create: {
      email: 'admin@ett.local',
      name: 'Administrador',
      passwordHash: hash,
      roles: { create: [{ role: 'ADMIN' }] },
    },
    update: {},
  });
  console.log('Admin user:', admin.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
