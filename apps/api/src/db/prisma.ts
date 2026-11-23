import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prismaClient ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalThis.__prismaClient = prisma;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  if (!env.DATABASE_URL) {
    return false;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.warn('⚠️ Database connection warning:', error instanceof Error ? error.message : error);
    return false;
  }
}
