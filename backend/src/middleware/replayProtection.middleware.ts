import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { structuredError } from "../utils/apiResponse";
import { extractIdempotencyKey } from "../utils/idempotencyKey";
import { logError, logStructuredEvent } from "../services/logger";
import { redis } from "../config/redis";

const REPLAY_WINDOW_SECONDS = 2;
const replayFallbackStore = new Map<string, { count: number; expiresAt: number }>();

function getRequestUserId(req: Request): string | undefined {
  return (req as Request & { userId?: string }).userId;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
}

function buildRequestHash(req: Request): string {
  const body = req.body && typeof req.body === "object" ? { ...(req.body as Record<string, unknown>) } : req.body;

  if (body && typeof body === "object") {
    delete (body as Record<string, unknown>).idempotencyKey;
  }

  const fingerprint = {
    method: req.method,
    query: req.query,
    body,
  };

  return createHash("sha256").update(stableStringify(fingerprint)).digest("hex");
}

async function incrementReplayCount(replayKey: string): Promise<number> {
  if (typeof (redis as unknown as { incr?: unknown }).incr === "function") {
    const count = await redis.incr(replayKey);
    if (count === 1) {
      await redis.expire(replayKey, REPLAY_WINDOW_SECONDS);
    }
    return count;
  }

  const now = Date.now();
  const existing = replayFallbackStore.get(replayKey);
  if (!existing || existing.expiresAt <= now) {
    replayFallbackStore.set(replayKey, {
      count: 1,
      expiresAt: now + REPLAY_WINDOW_SECONDS * 1000,
    });
    return 1;
  }

  const nextCount = existing.count + 1;
  replayFallbackStore.set(replayKey, {
    count: nextCount,
    expiresAt: existing.expiresAt,
  });
  return nextCount;
}

export async function replayProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getRequestUserId(req);
    const action = `${req.baseUrl || ""}${req.path}`;
    const idempotencyKey = extractIdempotencyKey(req);

    if (idempotencyKey) {
      await logStructuredEvent("replay_skipped_due_to_idempotency", {
        userId: userId ?? null,
        endpoint: action,
        idempotencyKey,
        action: "replay_bypass",
        timestamp: new Date().toISOString(),
      });
      return next();
    }

    const requestHash = buildRequestHash(req);
    const replayKey = `replay:${userId ?? "anonymous"}:${action}:${requestHash}`;
    const count = await incrementReplayCount(replayKey);

    if (count === 1) {
      await logStructuredEvent("replay_first_request_allowed", {
        userId: userId ?? null,
        endpoint: action,
        replayKey,
        requestHash,
        action: "replay_allow_first",
        timestamp: new Date().toISOString(),
      });

      return next();
    }

    await logStructuredEvent("replay_blocked_duplicate", {
      userId: userId ?? null,
      endpoint: action,
      idempotencyKey: null,
      replayKey,
      requestHash,
      count,
      action: "replay_block_duplicate",
      timestamp: new Date().toISOString(),
    });

    await logError(new Error("Replay request blocked"), {
      endpoint: action,
      userId: userId ?? null,
      replayKey,
      requestHash,
      count,
    });

    return res.status(409).json(structuredError("REPLAY_ATTACK", "Duplicate request detected"));
  } catch (err: any) {
    await logError(err instanceof Error ? err : new Error(String(err)), {
      endpoint: `${req.baseUrl || ""}${req.path}`,
      userId: getRequestUserId(req) ?? null,
      phase: "replay_protection",
    });

    await logStructuredEvent("replay_protection_error_fallback_allow", {
      userId: getRequestUserId(req) ?? null,
      endpoint: `${req.baseUrl || ""}${req.path}`,
      message: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    });
    return next();
  }
}
