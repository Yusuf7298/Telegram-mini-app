import { Router } from 'express';
import { prisma } from '../config/db';

const router = Router();

router.get('/health/full', async (req, res) => {
  const result: any = { db: false, prisma: false, writeRead: false };
  try {
    // DB check
    await prisma.$queryRaw`SELECT 1`;
    result.db = true;
    // Prisma query
    await prisma.user.findFirst({});
    result.prisma = true;
    // Basic write-read test (use a temp table or a health_check table if available)
    const testKey = `health_${Date.now()}`;
    await prisma.$executeRaw`CREATE TEMP TABLE IF NOT EXISTS health_check (k TEXT PRIMARY KEY, v TEXT)`;
    await prisma.$executeRaw`INSERT INTO health_check (k, v) VALUES (${testKey}, 'ok') ON CONFLICT (k) DO NOTHING`;
    const check = await prisma.$queryRaw`SELECT v FROM health_check WHERE k = ${testKey}`;
    result.writeRead = Array.isArray(check) && check[0]?.v === 'ok';
  } catch (err) {
    return res.status(500).json({ ok: false, ...result, error: String(err) });
  }
  res.json({ ok: true, ...result });
});

export default router;
