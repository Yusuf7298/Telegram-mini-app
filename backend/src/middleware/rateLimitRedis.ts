import { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis";
import { logSuspiciousAction } from "../services/suspiciousActionLog.service";
import { logError } from "../services/logger";

const USER_LIMIT = 10; // per minute
const GLOBAL_LIMIT = 200; // per minute
const WINDOW_MS = 60 * 1000; // 1 minute

// Sliding window Lua script for atomicity
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
redis.call('ZADD', key, now, now)
local count = redis.call('ZCARD', key)
redis.call('EXPIRE', key, math.ceil(window / 1000) + 2)
return count
`;

async function checkSlidingWindow(key: string, limit: number): Promise<number | null> {
  const now = Date.now();
  try {
    const count = await redis.eval(SLIDING_WINDOW_LUA, 1, key, now, WINDOW_MS, limit);
    return typeof count === "number" ? count : parseInt(count as string, 10);
  } catch (err) {
    logError(err as Error, { key, limit });
    return null; // fail closed
  }
}

export async function rateLimitRedisMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Per-user
  const userKey = `rate:user:${userId}`;
  const userCount = await checkSlidingWindow(userKey, USER_LIMIT);
  if (userCount === null) {
    // Redis unavailable, fail closed
    await logSuspiciousAction({ userId, type: "rate_limit_redis_unavailable" });
    return res.status(429).json({ error: "Rate limit check failed. Try again later." });
  }
  if (userCount > USER_LIMIT) {
    await logSuspiciousAction({ userId, type: "rate_limit_user_exceeded", metadata: { count: userCount } });
    return res.status(429).json({ error: "Too many requests (user)" });
  }

  // Global
  const globalKey = "rate:global";
  const globalCount = await checkSlidingWindow(globalKey, GLOBAL_LIMIT);
  if (globalCount === null) {
    await logSuspiciousAction({ userId, type: "rate_limit_redis_unavailable_global" });
    return res.status(429).json({ error: "Rate limit check failed. Try again later." });
  }
  if (globalCount > GLOBAL_LIMIT) {
    await logSuspiciousAction({ userId, type: "rate_limit_global_exceeded", metadata: { count: globalCount } });
    return res.status(429).json({ error: "Too many requests (global)" });
  }

  next();
}
