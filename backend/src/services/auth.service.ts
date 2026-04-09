import { prisma } from "../config/db";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

export async function findOrCreateTelegramUser(telegramUserId: string, username?: string, userInfo?: any) {
  let user = await prisma.user.findUnique({ where: { platformId: telegramUserId } });
  if (!user) {
    // Generate a unique referral code (short hash)
    let referralCode = crypto.createHash("sha256").update(telegramUserId + Date.now()).digest("hex").slice(0, 8);
    // Ensure uniqueness
    while (await prisma.user.findUnique({ where: { referralCode } })) {
      referralCode = crypto.createHash("sha256").update(telegramUserId + Math.random()).digest("hex").slice(0, 8);
    }
    user = await prisma.user.create({
      data: {
        platformId: telegramUserId,
        username: username || userInfo?.username || null,
        referralCode,
        wallet: { create: {} },
      },
    });
  }
  return user;
}
