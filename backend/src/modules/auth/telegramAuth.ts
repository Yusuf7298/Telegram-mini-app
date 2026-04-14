import crypto from "crypto";
import { env } from "../../config/env";

const MAX_AUTH_AGE_SECONDS = 60 * 5;

export function verifyTelegramData(initData: string) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
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

  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const hmac = crypto
    .createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");

  const providedHash = Buffer.from(hash, "hex");
  const expectedHash = Buffer.from(hmac, "hex");

  if (providedHash.length !== expectedHash.length) {
    throw new Error("Invalid Telegram signature");
  }

  const isValid = crypto.timingSafeEqual(providedHash, expectedHash);

  if (!isValid) {
    throw new Error("Invalid Telegram signature");
  }

  return true;
}