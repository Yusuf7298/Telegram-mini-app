// Generic retry wrapper for DB operations
export async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let attempt = 0;
  let delay = 50;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err: any) {
      // Deadlock or transient error codes (Postgres)
      const code = err.code || err?.meta?.code;
      const isDeadlock = code === '40001' || code === '40P01';
      const isTransient = code === '57014' || code === '57P01' || code === '53300' || code === '55000';
      const isUpdateManyZero = err.message && /update.*count.*0/i.test(err.message);
      if (isDeadlock || isTransient || isUpdateManyZero) {
        attempt++;
        if (attempt >= retries) throw err;
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
  throw new Error('Operation failed after maximum retries');
}
import { PrismaClient } from '@prisma/client';

export async function withTransactionRetry<T>(
  prisma: PrismaClient,
  fn: (tx: any) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  return withRetry(() => prisma.$transaction(async (tx) => fn(tx)), maxRetries);
}
