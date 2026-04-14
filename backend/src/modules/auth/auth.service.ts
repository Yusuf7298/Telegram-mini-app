import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { prisma } from "../../config/db";
import { randomUUID } from "crypto";
import crypto from "crypto";

const WAITLIST_BONUS_AMOUNT = 1000;

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

function computeDeviceHash(params: { deviceId?: string; userAgent?: string; ip?: string }) {
  const raw = [params.deviceId || "", params.userAgent || "", params.ip || ""].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function logSuspiciousDeviceBehavior(
  userId: string,
  action: string,
  details: Record<string, unknown>
) {
  await prisma.suspiciousActionLog.create({
    data: {
      userId,
      action,
      details: JSON.stringify(details),
    },
  });
}

export async function authWithTelegram(
  initData: string,
  context?: { ip?: string; deviceId?: string; userAgent?: string }
) {
  const userData = parseTelegramUser(initData);

  const platformId = String(userData.id);
  const username =
    typeof userData.username === "string" && userData.username.trim()
      ? userData.username
      : null;
  const normalizedIp = context?.ip || "unknown";
  const normalizedDeviceId = context?.deviceId?.trim() || undefined;
  const deviceHash = computeDeviceHash({
    deviceId: normalizedDeviceId,
    userAgent: context?.userAgent,
    ip: normalizedIp,
  });

  const referralCode = `REF-${randomUUID().replace(/-/g, "").slice(0, 12)}`;

  const user = await prisma.user.upsert({
    where: { platformId },
    create: {
      platformId,
      username,
      referralCode,
      signupDeviceId: normalizedDeviceId,
      deviceHash,
      createdIp: normalizedIp,
      lastLoginIp: normalizedIp,
      waitlistBonusGranted: true,
      waitlistBonusUnlocked: false,
      totalPlaysCount: 0,
      wallet: {
        create: {
          bonusBalance: WAITLIST_BONUS_AMOUNT,
          bonusLocked: true,
        },
      },
    },
    update: {
      username,
      deviceHash,
      lastLoginIp: normalizedIp,
      ...(normalizedDeviceId ? { signupDeviceId: normalizedDeviceId } : {}),
    },
  });

  const [sameDeviceAccounts, recentDeviceSwitches] = await Promise.all([
    prisma.user.count({
      where: {
        deviceHash,
        id: { not: user.id },
      },
    }),
    prisma.suspiciousActionLog.count({
      where: {
        userId: user.id,
        action: "device_switched",
        flaggedAt: {
          gte: new Date(Date.now() - 10 * 60 * 1000),
        },
      },
    }),
  ]);

  if (sameDeviceAccounts > 0) {
    await logSuspiciousDeviceBehavior(user.id, "multi_account_same_device", {
      deviceHash,
      linkedAccounts: sameDeviceAccounts,
      ip: normalizedIp,
    });
  }

  if (user.deviceHash && user.deviceHash !== deviceHash) {
    await logSuspiciousDeviceBehavior(user.id, "device_switched", {
      previousDeviceHash: user.deviceHash,
      nextDeviceHash: deviceHash,
      ip: normalizedIp,
    });

    if (recentDeviceSwitches >= 2) {
      await logSuspiciousDeviceBehavior(user.id, "rapid_device_switching", {
        switchesInLast10Min: recentDeviceSwitches + 1,
        ip: normalizedIp,
      });
    }
  }

  return user;
}

export function generateToken(userId: string) {
  const secret = env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return jwt.sign({ userId }, secret, { expiresIn: "7d" });
}
