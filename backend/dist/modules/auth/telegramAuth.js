"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTelegramData = verifyTelegramData;
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../../config/env");
const MAX_AUTH_AGE_SECONDS = 60 * 5;
function verifyTelegramData(initData) {
    const botToken = env_1.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        throw new Error("Telegram auth is not configured");
    }
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    if (!hash) {
        throw new Error("Telegram hash is missing");
    }
    const authDateRaw = urlParams.get("auth_date");
    if (!authDateRaw) {
        throw new Error("Telegram auth_date is missing");
    }
    const authDate = Number(authDateRaw);
    if (!Number.isFinite(authDate)) {
        throw new Error("Telegram auth_date is invalid");
    }
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > MAX_AUTH_AGE_SECONDS) {
        throw new Error("Telegram authentication expired");
    }
    urlParams.delete("hash");
    const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");
    const secret = crypto_1.default
        .createHmac("sha256", "WebAppData")
        .update(botToken)
        .digest();
    const hmac = crypto_1.default
        .createHmac("sha256", secret)
        .update(dataCheckString)
        .digest("hex");
    const providedHash = Buffer.from(hash, "hex");
    const expectedHash = Buffer.from(hmac, "hex");
    if (providedHash.length !== expectedHash.length) {
        throw new Error("Invalid Telegram signature");
    }
    const isValid = crypto_1.default.timingSafeEqual(providedHash, expectedHash);
    if (!isValid) {
        throw new Error("Invalid Telegram signature");
    }
    return true;
}
