import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/db";

type DbHealthCache = {
  lastCheckedAt: number;
  isHealthy: boolean;
  lastError: string | null;
  inFlight: Promise<{ isHealthy: boolean; error: string | null }> | null;
};

const DB_HEALTH_CACHE_MS = Math.min(5000, Math.max(2000, Number(process.env.DB_HEALTH_CACHE_MS ?? "3000")));

const dbHealthCache: DbHealthCache = {
  lastCheckedAt: 0,
  isHealthy: true,
  lastError: null,
  inFlight: null,
};

async function queryDbHealth(): Promise<{ isHealthy: boolean; error: string | null }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { isHealthy: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { isHealthy: false, error: message };
  }
}

export async function getDbHealthCached(): Promise<{ isHealthy: boolean; error: string | null }> {
  const now = Date.now();
  const cacheStillValid = now - dbHealthCache.lastCheckedAt < DB_HEALTH_CACHE_MS;

  if (cacheStillValid) {
    return {
      isHealthy: dbHealthCache.isHealthy,
      error: dbHealthCache.lastError,
    };
  }

  if (!dbHealthCache.inFlight) {
    dbHealthCache.inFlight = queryDbHealth().then((result) => {
      dbHealthCache.lastCheckedAt = Date.now();
      dbHealthCache.isHealthy = result.isHealthy;
      dbHealthCache.lastError = result.error;
      dbHealthCache.inFlight = null;
      return result;
    });
  }

  return dbHealthCache.inFlight;
}

export async function rejectIfDbUnhealthy(res: Response): Promise<boolean> {
  const { isHealthy } = await getDbHealthCached();

  if (!isHealthy) {
    res.status(503).json({ error: "Service temporarily unavailable" });
    return true;
  }

  return false;
}

export async function dbHealthGuardMiddleware(req: Request, res: Response, next: NextFunction) {
  const blocked = await rejectIfDbUnhealthy(res);
  if (blocked) {
    return;
  }
  next();
}
