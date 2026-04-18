import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { prisma } from "../../config/db";
import crypto from "crypto";
import { createUser } from "../user/user.service";
import { Role } from "@prisma/client";

type TelegramUserPayload = {
  id?: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
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

  const telegramId = String(userData.id);
  const username =
    typeof userData.username === "string" && userData.username.trim()
      ? userData.username
      : null;
  const firstName =
    typeof userData.first_name === "string" && userData.first_name.trim()
      ? userData.first_name.trim()
      : null;
  const lastName =
    typeof userData.last_name === "string" && userData.last_name.trim()
      ? userData.last_name.trim()
      : null;
  const profilePhotoUrl =
    typeof userData.photo_url === "string" && userData.photo_url.trim()
      ? userData.photo_url.trim()
      : null;
  const normalizedIp = context?.ip || "unknown";
  const normalizedDeviceId = context?.deviceId?.trim() || undefined;
  const deviceHash = computeDeviceHash({
    deviceId: normalizedDeviceId,
    userAgent: context?.userAgent,
    ip: normalizedIp,
  });

  const existingUser = await prisma.user.findUnique({
    where: { telegramId },
  });

  const user = existingUser
    ? await prisma.user.update({
        where: { telegramId },
        data: {
          username,
          firstName,
          lastName,
          profilePhotoUrl,
          platformId: telegramId,
          deviceHash,
          lastLoginIp: normalizedIp,
          ...(normalizedDeviceId ? { signupDeviceId: normalizedDeviceId } : {}),
        },
      })
    : await createUser(telegramId, username, {
        firstName,
        lastName,
        profilePhotoUrl,
        signupDeviceId: normalizedDeviceId,
        deviceHash,
        createdIp: normalizedIp,
        lastLoginIp: normalizedIp,
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

export function generateToken(userId: string, role: Role) {
  const secret = env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return jwt.sign({ userId, role }, secret, { expiresIn: "7d" });
}
