import { prisma } from "../config/db";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { logSuspiciousAction } from "./suspiciousActionLog.service";
import { getValidatedGameConfig } from "./gameConfig.service";

const RISK_BONUS_DISABLE_THRESHOLD = 50;

type AccountStatus = "ACTIVE" | "RESTRICTED" | "FROZEN";

function makeReferralCode(seed: string) {
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 8).toUpperCase();
}

function computeDeviceHash(params: {
  signupDeviceId?: string;
  userAgent?: string;
  signupIp?: string;
}) {
  const raw = [
    params.signupDeviceId || "",
    params.userAgent || "",
    params.signupIp || "",
  ].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function resolveAccountStatus(riskScore: number): AccountStatus {
  if (riskScore > 90) return "FROZEN";
  if (riskScore > 70) return "RESTRICTED";
  return "ACTIVE";
}

async function getWaitlistBonusAmount() {
  const config = await getValidatedGameConfig({ bypassCache: true });

  return config.waitlistBonus;
}

export async function findOrCreateTelegramUser(
  telegramUserId: string,
  username?: string,
  userInfo?: any,
  signupIp?: string,
  signupDeviceId?: string,
  userAgent?: string
) {
  let user = await prisma.user.findUnique({ where: { telegramId: telegramUserId } });
  const normalizedIp = signupIp || "unknown";
  const deviceHash = computeDeviceHash({
    signupDeviceId,
    userAgent,
    signupIp: normalizedIp,
  });
  const waitlistBonusAmount = await getWaitlistBonusAmount();

  if (!user) {
    // Generate a unique referral code (short hash)
    let referralCode = makeReferralCode(telegramUserId + Date.now());
    // Ensure uniqueness
    while (await prisma.user.findUnique({ where: { referralCode } })) {
      referralCode = makeReferralCode(`${telegramUserId}-${crypto.randomInt(1, 1_000_000_000)}`);
    }

    const [ipCount, deviceCount] = await Promise.all([
      prisma.user.count({ where: { createdIp: normalizedIp } }),
      prisma.user.count({ where: { deviceHash } }),
    ]);

    const sameIpCluster = ipCount >= 3;
    const deviceReuse = deviceCount >= 1;

    let initialRiskScore = 0;
    if (sameIpCluster) initialRiskScore += 35;
    if (deviceReuse) initialRiskScore += 35;

    const accountStatus = resolveAccountStatus(initialRiskScore);
    const waitlistBonusEligible =
      initialRiskScore < RISK_BONUS_DISABLE_THRESHOLD &&
      !sameIpCluster &&
      !deviceReuse;

    user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          telegramId: telegramUserId,
          platformId: telegramUserId,
          username: username || userInfo?.username || null,
          firstName:
            typeof userInfo?.first_name === "string" && userInfo.first_name.trim()
              ? userInfo.first_name.trim()
              : null,
          lastName:
            typeof userInfo?.last_name === "string" && userInfo.last_name.trim()
              ? userInfo.last_name.trim()
              : null,
          profilePhotoUrl:
            typeof userInfo?.photo_url === "string" && userInfo.photo_url.trim()
              ? userInfo.photo_url.trim()
              : null,
          referralCode,
          deviceHash,
          createdIp: normalizedIp,
          lastLoginIp: normalizedIp,
          riskScore: initialRiskScore,
          waitlistBonusEligible,
          accountStatus,
          signupIp: signupIp || null,
          signupDeviceId: signupDeviceId || null,
          waitlistBonusGranted: waitlistBonusEligible,
          waitlistBonusUnlocked: false,
          totalPlaysCount: 0,
          wallet: {
            create: {
              bonusBalance: waitlistBonusEligible ? waitlistBonusAmount : 0,
              bonusLocked: true,
            },
          },
        },
      });

      if (sameIpCluster) {
        await tx.suspiciousActionLog.create({
          data: {
            userId: createdUser.id,
            action: "multi_account_same_ip",
            details: JSON.stringify({ ip: normalizedIp, existingAccounts: ipCount }),
          },
        });
      }

      if (deviceReuse) {
        await tx.suspiciousActionLog.create({
          data: {
            userId: createdUser.id,
            action: "device_reuse",
            details: JSON.stringify({ deviceHash, existingAccounts: deviceCount }),
          },
        });
      }

      return createdUser;
    });
  } else if (!user.waitlistBonusGranted) {
    // Legacy safety: grant waitlist bonus exactly once for low-risk pre-existing users.
    await prisma.$transaction(async (tx) => {
      const refreshed = await tx.user.findUnique({
        where: { id: user!.id },
        include: { wallet: true },
      });

      if (!refreshed || !refreshed.wallet || refreshed.waitlistBonusGranted) {
        return;
      }

      const eligibleByRisk =
        refreshed.waitlistBonusEligible &&
        refreshed.riskScore < RISK_BONUS_DISABLE_THRESHOLD &&
        refreshed.accountStatus === "ACTIVE";

      await tx.wallet.update({
        where: { userId: refreshed.id },
        data: {
          bonusBalance: { increment: eligibleByRisk ? waitlistBonusAmount : 0 },
          bonusLocked: true,
        },
      });

      await tx.user.update({
        where: { id: refreshed.id },
        data: {
          waitlistBonusGranted: eligibleByRisk,
          waitlistBonusUnlocked: false,
          waitlistBonusEligible: eligibleByRisk,
        },
      });

      if (!eligibleByRisk) {
        await tx.suspiciousActionLog.create({
          data: {
            userId: refreshed.id,
            action: "withdrawal_risk",
            details: JSON.stringify({ reason: "legacy_bonus_blocked_by_risk" }),
          },
        });
      }
    });

    user = await prisma.user.findUnique({ where: { telegramId: telegramUserId } });
  } else {
    const existingAccountStatus = resolveAccountStatus(user.riskScore);
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        username: username || userInfo?.username || user.username,
        firstName:
          typeof userInfo?.first_name === "string" && userInfo.first_name.trim()
            ? userInfo.first_name.trim()
            : user.firstName,
        lastName:
          typeof userInfo?.last_name === "string" && userInfo.last_name.trim()
            ? userInfo.last_name.trim()
            : user.lastName,
        profilePhotoUrl:
          typeof userInfo?.photo_url === "string" && userInfo.photo_url.trim()
            ? userInfo.photo_url.trim()
            : user.profilePhotoUrl,
        telegramId: telegramUserId,
        platformId: telegramUserId,
        deviceHash,
        lastLoginIp: normalizedIp,
        accountStatus: existingAccountStatus,
      },
    });
  }

  return user;
}
