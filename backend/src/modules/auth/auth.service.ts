import jwt from "jsonwebtoken";
import { prisma } from "../../config/db";

type TelegramUserPayload = {
  id?: number | string;
  username?: string;
};
function parseTelegramUser(initData: string): TelegramUserPayload {
  const params = new URLSearchParams(initData);
  const userRaw = params.get("user");
  if (!userRaw) {
    throw new Error("Telegram user payload is missing");
  }
  const userData = JSON.parse(userRaw) as TelegramUserPayload;

  if (!userData?.id) {
    throw new Error("Telegram user id is missing");
  }
  return userData;
}

export async function authWithTelegram(initData: string) {
  const userData = parseTelegramUser(initData);

  const platformId = String(userData.id);
  const username =
    typeof userData.username === "string" && userData.username.trim()
      ? userData.username
      : null;

  return prisma.user.upsert({
    where: { platformId },
    create: {
      platformId,
      username,
      wallet: { create: {} },
    },
    update: {
      username,
    },
  });
}

export function generateToken(userId: string) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return jwt.sign({ userId }, secret, { expiresIn: "7d" });
}
