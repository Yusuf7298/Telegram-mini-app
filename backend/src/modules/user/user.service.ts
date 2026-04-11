import { prisma } from "../../config/db";
import { randomUUID } from "crypto";

export async function createUser(platformId: string, username?: string) {
  const existing = await prisma.user.findUnique({
    where: { platformId },
  });
  if (existing) return existing;
  // Welcome bonus: set bonusBalance=1000, bonusLocked=true
  return prisma.user.create({
    data: {
      platformId,
      username,
      referralCode: `REF-${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      waitlistBonusGranted: true,
      waitlistBonusUnlocked: false,
      totalPlaysCount: 0,
      wallet: {
        create: {
          bonusBalance: 1000,
          bonusLocked: true,
        },
      },
    },
  });
}