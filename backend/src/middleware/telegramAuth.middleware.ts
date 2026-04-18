import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { verifyTelegramSignature } from "../utils/verifyTelegramSignature";
import { findOrCreateTelegramUser } from "../services/auth.service";
import { prisma } from "../config/db";
import { getErrorStatus, structuredError } from "../utils/apiResponse";

const MAX_AGE_SECONDS = 3600; // 1 hour

export async function verifyTelegramAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const botToken = env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(getErrorStatus("INTERNAL_ERROR")).json(structuredError("INTERNAL_ERROR", "Telegram bot token not configured"));
    }
    const initData = req.headers["x-telegram-initdata"] as string || req.query.initData as string || req.body.initData;
    if (!initData) {
      return res.status(getErrorStatus("INVALID_INPUT")).json(structuredError("INVALID_INPUT", "Missing Telegram initData"));
    }
    const { valid, data, reason } = verifyTelegramSignature(initData, botToken);
    if (!valid) {
      await logSuspiciousLoginAttempt({ reason, initData });
      return res.status(getErrorStatus("REPLAY_ATTACK")).json(structuredError("REPLAY_ATTACK", "Invalid Telegram signature"));
    }
    // Check auth_date
    const authDate = Number(data.auth_date);
    if (!authDate || isNaN(authDate)) {
      await logSuspiciousLoginAttempt({ reason: "Missing or invalid auth_date", initData });
      return res.status(getErrorStatus("INVALID_INPUT")).json(structuredError("INVALID_INPUT", "Invalid Telegram auth_date"));
    }
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > MAX_AGE_SECONDS) {
      await logSuspiciousLoginAttempt({ reason: "initData too old", initData });
      return res.status(getErrorStatus("INVALID_INPUT")).json(structuredError("INVALID_INPUT", "Telegram data expired"));
    }
    // Extract Telegram user ID
    const telegramUser = data.user;
    if (!telegramUser || !telegramUser.id) {
      await logSuspiciousLoginAttempt({ reason: "Missing Telegram user", initData });
      return res.status(getErrorStatus("INVALID_INPUT")).json(structuredError("INVALID_INPUT", "Missing Telegram user info"));
    }
    const telegramUserId = String(telegramUser.id);
    // Telegram identity source of truth is telegramId.
    const user = await findOrCreateTelegramUser(
      telegramUserId,
      telegramUser.username,
      telegramUser,
      req.ip,
      (req.headers["x-device-id"] as string | undefined) || undefined,
      req.headers["user-agent"] as string | undefined
    );
    if (!user) {
      await logSuspiciousLoginAttempt({ reason: "User bootstrap failed", telegramUserId });
      return res.status(getErrorStatus("INTERNAL_ERROR")).json(structuredError("INTERNAL_ERROR", "User setup failed"));
    }
    // Attach user info to request context
    (req as any).user = user;
    (req as Request & { userId?: string }).userId = user.id;
    next();
  } catch (err) {
    await logSuspiciousLoginAttempt({ reason: "Internal error", error: err?.toString() });
    return res.status(getErrorStatus("INTERNAL_ERROR")).json(structuredError("INTERNAL_ERROR", "Telegram authentication failed"));
  }
}

async function logSuspiciousLoginAttempt(details: any) {
  try {
    await prisma.suspiciousActionLog.create({
      data: {
        userId: "system",
        action: "telegram_login_attempt",
        details: JSON.stringify(details),
      },
    });
  } catch {}
}
