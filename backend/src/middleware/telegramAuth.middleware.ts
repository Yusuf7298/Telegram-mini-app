import { Request, Response, NextFunction } from "express";
import { verifyTelegramSignature } from "../utils/verifyTelegramSignature";
import { findOrCreateTelegramUser } from "../services/auth.service";
import { prisma } from "../config/db";

const MAX_AGE_SECONDS = 3600; // 1 hour

export async function verifyTelegramAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({ success: false, error: "Telegram bot token not configured" });
    }
    const initData = req.headers["x-telegram-initdata"] as string || req.query.initData as string || req.body.initData;
    if (!initData) {
      return res.status(401).json({ success: false, error: "Missing Telegram initData" });
    }
    const { valid, data, reason } = verifyTelegramSignature(initData, botToken);
    if (!valid) {
      await logSuspiciousLoginAttempt({ reason, initData });
      return res.status(401).json({ success: false, error: "Invalid Telegram signature" });
    }
    // Check auth_date
    const authDate = Number(data.auth_date);
    if (!authDate || isNaN(authDate)) {
      await logSuspiciousLoginAttempt({ reason: "Missing or invalid auth_date", initData });
      return res.status(401).json({ success: false, error: "Invalid Telegram auth_date" });
    }
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > MAX_AGE_SECONDS) {
      await logSuspiciousLoginAttempt({ reason: "initData too old", initData });
      return res.status(401).json({ success: false, error: "Telegram data expired" });
    }
    // Extract Telegram user ID
    const telegramUser = data.user;
    if (!telegramUser || !telegramUser.id) {
      await logSuspiciousLoginAttempt({ reason: "Missing Telegram user", initData });
      return res.status(401).json({ success: false, error: "Missing Telegram user info" });
    }
    const telegramUserId = String(telegramUser.id);
    // User rules: platformId must equal Telegram user id
    const user = await findOrCreateTelegramUser(telegramUserId, telegramUser.username, telegramUser);
    // Attach user info to request context
    (req as any).user = user;
    req.userId = user.platformId;
    next();
  } catch (err) {
    await logSuspiciousLoginAttempt({ reason: "Internal error", error: err?.toString() });
    return res.status(500).json({ success: false, error: "Telegram authentication failed" });
  }
}

async function logSuspiciousLoginAttempt(details: any) {
  try {
    await prisma.suspiciousActionLog.create({
      data: {
        type: "telegram_login_attempt",
        metadata: details,
      },
    });
  } catch {}
}
