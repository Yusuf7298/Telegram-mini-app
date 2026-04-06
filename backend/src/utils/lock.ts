// Distributed user lock using Redlock and Redis
import Redlock from "redlock";
import { redis } from "../config/redis";

const redlock = new Redlock([
  redis
], {
  retryCount: 10,
  retryDelay: 100,
  retryJitter: 100,
});

const LOCK_TTL = 5000; // 5 seconds

export async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const resource = `locks:user:${userId}`;
  let lock;
  try {
    lock = await redlock.acquire([resource], LOCK_TTL);
    return await fn();
  } finally {
    if (lock) {
      try { await lock.release(); } catch {}
    }
  }
}
