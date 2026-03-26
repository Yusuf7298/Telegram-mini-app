import { NextFunction, Request, Response } from "express";
import { redis } from "../config/redis";

const OPEN_BOX_MAX_REQUESTS = 10;
const OPEN_BOX_WINDOW_SECONDS = 10;
const FREE_BOX_SECONDS = 60 * 60 * 24 * 365 * 10;

function getUserId(req: Request): string | null {
  const userId = req.userId;

  if (typeof userId !== "string" || userId.trim().length === 0) {
    return null;
  }

  return userId;
}

function tooManyRequests(res: Response, message: string) {
  return res.status(429).json({
    success: false,
    error: message,
  });
}

export async function openBoxRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = getUserId(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }

  try {
    const key = `rl:open-box:${userId}`;
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, OPEN_BOX_WINDOW_SECONDS);
    }

    if (count > OPEN_BOX_MAX_REQUESTS) {
      return tooManyRequests(
        res,
        "Too many open-box requests. Try again in a few seconds."
      );
    }

    return next();
  } catch (error) {
    return res.status(503).json({
      success: false,
      error: "Rate limiting service unavailable",
    });
  }
}

export async function freeBoxRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = getUserId(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }

  try {
    const key = `rl:free-box:${userId}`;
    const result = await redis.set(key, "1", "EX", FREE_BOX_SECONDS, "NX");

    if (result !== "OK") {
      return tooManyRequests(res, "Free box request limit exceeded for this user.");
    }

    return next();
  } catch (error) {
    return res.status(503).json({
      success: false,
      error: "Rate limiting service unavailable",
    });
  }
}
