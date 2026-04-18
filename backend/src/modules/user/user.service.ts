import { prisma } from "../../config/db";
import { Prisma } from "@prisma/client";
import crypto from "crypto";
import { getValidatedGameConfig } from "../../services/gameConfig.service";

const REFERRAL_CODE_MIN_LENGTH = 6;
const REFERRAL_CODE_MAX_LENGTH = 8;
const DEFAULT_REFERRAL_CODE_LENGTH = 8;
const REFERRAL_CODE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const MAX_REFERRAL_CODE_ATTEMPTS = 25;
type CreateUserOptions = {
  signupDeviceId?: string;
  deviceHash?: string;
  createdIp?: string;
  lastLoginIp?: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePhotoUrl?: string | null;
};

export function generateReferralCode(length = DEFAULT_REFERRAL_CODE_LENGTH): string {
  if (length < REFERRAL_CODE_MIN_LENGTH || length > REFERRAL_CODE_MAX_LENGTH) {
    throw new Error(
      `Referral code length must be between ${REFERRAL_CODE_MIN_LENGTH} and ${REFERRAL_CODE_MAX_LENGTH}`,
    );
  }

  let code = "";
  for (let i = 0; i < length; i += 1) {
    const index = crypto.randomInt(0, REFERRAL_CODE_CHARSET.length);
    code += REFERRAL_CODE_CHARSET[index];
  }

  return code;
}

export async function generateUniqueReferralCode(
  length = DEFAULT_REFERRAL_CODE_LENGTH,
  maxAttempts = MAX_REFERRAL_CODE_ATTEMPTS,
): Promise<string> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const referralCode = generateReferralCode(length);

    const referralCodeInUse = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true },
    });

    if (!referralCodeInUse) {
      return referralCode;
    }
  }

  throw new Error("Failed to generate a unique referral code after multiple attempts");
}

function isReferralCodeUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("referralCode");
  }

  return typeof target === "string" && target.includes("referralCode");
}

export async function createUser(telegramId: string, username?: string | null, options?: CreateUserOptions) {
  const existing = await prisma.user.findUnique({
    where: { telegramId },
  });
  if (existing) return existing;
  const config = await getValidatedGameConfig({ bypassCache: true });
  for (let attempt = 1; attempt <= MAX_REFERRAL_CODE_ATTEMPTS; attempt += 1) {
    const referralCode = await generateUniqueReferralCode();

    try {
      return await prisma.user.create({
        data: {
          telegramId,
          // Keep legacy column mirrored to avoid regressions while moving to telegramId everywhere.
          platformId: telegramId,
          username: username ?? undefined,
          firstName: options?.firstName ?? undefined,
          lastName: options?.lastName ?? undefined,
          profilePhotoUrl: options?.profilePhotoUrl ?? undefined,
          referralCode,
          signupDeviceId: options?.signupDeviceId,
          deviceHash: options?.deviceHash,
          createdIp: options?.createdIp,
          lastLoginIp: options?.lastLoginIp,
          waitlistBonusGranted: true,
          waitlistBonusUnlocked: false,
          totalPlaysCount: 0,
          wallet: {
            create: {
              bonusBalance: config.waitlistBonus,
              bonusLocked: true,
            },
          },
        },
      });
    } catch (error) {
      if (isReferralCodeUniqueConstraintError(error)) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Failed to generate a unique referral code after multiple attempts");
}