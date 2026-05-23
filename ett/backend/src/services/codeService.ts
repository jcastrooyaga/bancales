import { PrismaClient } from '@prisma/client';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

const generateCode = () => {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
};

export const generateUniqueCode = async (prisma: PrismaClient): Promise<string> => {
  let attempts = 0;
  while (attempts < 20) {
    const code = generateCode();
    const existing = await prisma.request.findUnique({ where: { code } });
    if (!existing) return code;
    attempts++;
  }
  throw new Error('Could not generate unique code');
};
