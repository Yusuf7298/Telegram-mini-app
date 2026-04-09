import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { redis } from "../config/redis";

const SIGNATURE_TTL = 20; // seconds
const TIMESTAMP_WINDOW = 10; // seconds
const COOLDOWN_MS = 2000; // 2 seconds enforced cooldown per box open

// In-memory fallback for signature hashes and cooldowns
const recentHashes = new Map<string, number>();
const userCooldowns = new Map<string, number>();

function getHashKey(userId: string, boxId: string, timestamp: number) {
  return crypto.createHash("sha256").update(`${userId}:${boxId}:${timestamp}`).digest("hex");
}

export async function replayProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;
    const boxId = req.body.boxId;
    const clientTimestamp = req.body.timestamp;
    if (!userId || !boxId || !clientTimestamp) {
      return res.status(400).json({ success: false, error: "userId, boxId, and timestamp required" });
    }
    const now = Date.now();
    const clientTime = Number(clientTimestamp);
    if (isNaN(clientTime)) {
      return res.status(400).json({ success: false, error: "Invalid timestamp" });
    }
    // 1. Timestamp validation
    if (Math.abs(now - clientTime) > TIMESTAMP_WINDOW * 1000) {
      return res.status(400).json({ success: false, error: "Request timestamp out of window" });
    }
    // 2. Per-user action cooldown
    const lastAction = userCooldowns.get(userId) || 0;
    if (now - lastAction < COOLDOWN_MS) {
      return res.status(429).json({ success: false, error: "Action cooldown: too soon" });
    }
    // 3. Request signature tracking
    const hashKey = getHashKey(userId, boxId, Math.floor(clientTime / 1000)); // windowed by second
    let exists = false;
    if (redis.status === "ready") {
      exists = (await redis.setnx(`sig:${hashKey}`, "1")) === 0;
      if (!exists) await redis.expire(`sig:${hashKey}`, SIGNATURE_TTL);
    } else {
      exists = recentHashes.has(hashKey);
      if (!exists) recentHashes.set(hashKey, now + SIGNATURE_TTL * 1000);
    }
    // Cleanup old in-memory hashes
    for (const [k, exp] of recentHashes.entries()) {
      if (exp < now) recentHashes.delete(k);
    }
    if (exists) {
      return res.status(409).json({ success: false, error: "Duplicate/replayed request" });
    }
    // Update cooldown
    userCooldowns.set(userId, now);
    // Cleanup old cooldowns
    for (const [k, t] of userCooldowns.entries()) {
      if (now - t > 60000) userCooldowns.delete(k);
    }
    next();
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
}
