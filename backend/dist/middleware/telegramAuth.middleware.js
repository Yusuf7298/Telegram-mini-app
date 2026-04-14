"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTelegramAuth = verifyTelegramAuth;
const verifyTelegramSignature_1 = require("../utils/verifyTelegramSignature");
const auth_service_1 = require("../services/auth.service");
const db_1 = require("../config/db");
const apiResponse_1 = require("../utils/apiResponse");
const MAX_AGE_SECONDS = 3600; // 1 hour
async function verifyTelegramAuth(req, res, next) {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            return res.status((0, apiResponse_1.getErrorStatus)("INTERNAL_ERROR")).json((0, apiResponse_1.structuredError)("INTERNAL_ERROR", "Telegram bot token not configured"));
        }
        const initData = req.headers["x-telegram-initdata"] || req.query.initData || req.body.initData;
        if (!initData) {
            return res.status((0, apiResponse_1.getErrorStatus)("INVALID_INPUT")).json((0, apiResponse_1.structuredError)("INVALID_INPUT", "Missing Telegram initData"));
        }
        const { valid, data, reason } = (0, verifyTelegramSignature_1.verifyTelegramSignature)(initData, botToken);
        if (!valid) {
            await logSuspiciousLoginAttempt({ reason, initData });
            return res.status((0, apiResponse_1.getErrorStatus)("REPLAY_ATTACK")).json((0, apiResponse_1.structuredError)("REPLAY_ATTACK", "Invalid Telegram signature"));
        }
        // Check auth_date
        const authDate = Number(data.auth_date);
        if (!authDate || isNaN(authDate)) {
            await logSuspiciousLoginAttempt({ reason: "Missing or invalid auth_date", initData });
            return res.status((0, apiResponse_1.getErrorStatus)("INVALID_INPUT")).json((0, apiResponse_1.structuredError)("INVALID_INPUT", "Invalid Telegram auth_date"));
        }
        const now = Math.floor(Date.now() / 1000);
        if (now - authDate > MAX_AGE_SECONDS) {
            await logSuspiciousLoginAttempt({ reason: "initData too old", initData });
            return res.status((0, apiResponse_1.getErrorStatus)("INVALID_INPUT")).json((0, apiResponse_1.structuredError)("INVALID_INPUT", "Telegram data expired"));
        }
        // Extract Telegram user ID
        const telegramUser = data.user;
        if (!telegramUser || !telegramUser.id) {
            await logSuspiciousLoginAttempt({ reason: "Missing Telegram user", initData });
            return res.status((0, apiResponse_1.getErrorStatus)("INVALID_INPUT")).json((0, apiResponse_1.structuredError)("INVALID_INPUT", "Missing Telegram user info"));
        }
        const telegramUserId = String(telegramUser.id);
        // User rules: platformId must equal Telegram user id
        const user = await (0, auth_service_1.findOrCreateTelegramUser)(telegramUserId, telegramUser.username, telegramUser, req.ip, req.headers["x-device-id"] || undefined, req.headers["user-agent"]);
        if (!user) {
            await logSuspiciousLoginAttempt({ reason: "User bootstrap failed", telegramUserId });
            return res.status((0, apiResponse_1.getErrorStatus)("INTERNAL_ERROR")).json((0, apiResponse_1.structuredError)("INTERNAL_ERROR", "User setup failed"));
        }
        // Attach user info to request context
        req.user = user;
        req.userId = user.platformId;
        next();
    }
    catch (err) {
        await logSuspiciousLoginAttempt({ reason: "Internal error", error: err?.toString() });
        return res.status((0, apiResponse_1.getErrorStatus)("INTERNAL_ERROR")).json((0, apiResponse_1.structuredError)("INTERNAL_ERROR", "Telegram authentication failed"));
    }
}
async function logSuspiciousLoginAttempt(details) {
    try {
        await db_1.prisma.suspiciousActionLog.create({
            data: {
                userId: "system",
                action: "telegram_login_attempt",
                details: JSON.stringify(details),
            },
        });
    }
    catch { }
}
