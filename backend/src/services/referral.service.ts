// NEW: Referral protection service
import { prisma } from "../config/db";
import { Prisma } from "@prisma/client";
import { ApiErrorCode } from "../utils/apiResponse";
import { logStructuredEvent } from "./logger";
import { canUseReferral } from "./rules.service";
import { ONE, ZERO, ZERO_STRING } from "../constants/numbers";
import { getCorrelationId } from "./requestContext.service";
import { enforceReferralAbuseGuards } from "./referralAbuse.service";
import { getValidatedGameConfig } from "./gameConfig.service";

export class ReferralServiceError extends Error {
  code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

type ApplyReferralParams = {
  referredUserId: string;
  referralCode: string;
  ip: string;
  deviceId?: string;
};

export type ApplyReferralResult = {
  referralCode: string;
  walletSnapshot: {
    cashBalance: string;
    bonusBalance: string;
    airtimeBalance: string;
  };
  inviter: {
    id: string;
    referralCount: number;
    bonusBalance: string;
  };
  invitedUser: {
    id: string;
    referredById: string;
    referralStatus: "PENDING" | "JOINED" | "ACTIVE";
    referralJoinedAt: Date | null;
    referralActivatedAt: Date | null;
  };
  usage: {
    applied: true;
    suspicious: boolean;
  };
};

export async function logReferral({
  referrerId,
  referredId,
  ip,
  deviceId,
  suspicious,
  tx,
}: {
  referrerId: string;
  referredId: string;
  ip: string;
  deviceId?: string;
  suspicious?: boolean;
  tx?: Prisma.TransactionClient;
}) {
  const client = tx || prisma;
  await client.referralLog.createMany({
    data: [{ inviterId: referrerId, referredUserId: referredId, ip, deviceId, suspicious: !!suspicious }],
    skipDuplicates: true,
  });
}

export async function checkReferralLimits({
  ip,
  deviceId,
  referrerId,
  referredId,
  tx,
}: {
  ip: string;
  deviceId?: string;
  referrerId?: string;
  referredId?: string;
  tx?: Prisma.TransactionClient;
}) {
  const client = tx || prisma;
  return canUseReferral({
    ip,
    deviceId,
    referrerId,
    referredId,
    client,
  });
}

export async function applyReferralCode({
  referredUserId,
  referralCode,
  ip,
  deviceId,
}: ApplyReferralParams): Promise<ApplyReferralResult> {
  const normalizedCode = referralCode.trim().toUpperCase();

  if (!normalizedCode) {
    throw new ReferralServiceError("INVALID_INPUT", "Referral code is required");
  }

  return prisma.$transaction(async (tx) => {
    const correlationId = getCorrelationId() ?? "unknown";
    const config = await getValidatedGameConfig({ bypassCache: true });
    const invitedUser = await tx.user.findUnique({
      where: { id: referredUserId },
      select: {
        id: true,
        telegramId: true,
        signupDeviceId: true,
        deviceHash: true,
        referredById: true,
        referralStatus: true,
        referralJoinedAt: true,
        referralActivatedAt: true,
      },
    });

    if (!invitedUser) {
      throw new ReferralServiceError("NOT_FOUND", "User not found");
    }

    const safeDeviceId = deviceId?.trim() || "unknown";

    // Idempotent path: user already has a referral relation.
    if (invitedUser.referredById) {
      const existingInviter = await tx.user.findUnique({
        where: { id: invitedUser.referredById },
        select: {
          id: true,
          referralCode: true,
          referralCount: true,
          wallet: {
            select: {
              bonusBalance: true,
            },
          },
        },
      });

      if (!existingInviter) {
        throw new ReferralServiceError("NOT_FOUND", "Referrer not found");
      }

      const invitedUserWallet = await tx.wallet.findUnique({
        where: { userId: invitedUser.id },
        select: {
          cashBalance: true,
          bonusBalance: true,
        },
      });

      if (!invitedUserWallet) {
        throw new ReferralServiceError("NOT_FOUND", "Wallet not found");
      }

      await logStructuredEvent("referral_duplicate_blocked", {
        userId: invitedUser.id,
        endpoint: "referral/use",
        action: "referral_duplicate_blocked",
        inviterId: existingInviter.id,
        referredUserId: invitedUser.id,
        status: invitedUser.referralStatus,
        rewardAmount: ZERO_STRING,
        correlationId,
        referralCode: existingInviter.referralCode,
        reason: "duplicate_grant",
        detectionSource: "pre-check",
      });

      return {
        referralCode: existingInviter.referralCode,
        walletSnapshot: {
          cashBalance: invitedUserWallet.cashBalance.toString(),
          bonusBalance: invitedUserWallet.bonusBalance.toString(),
          airtimeBalance: ZERO_STRING,
        },
        inviter: {
          id: existingInviter.id,
          referralCount: existingInviter.referralCount,
          bonusBalance: (existingInviter.wallet?.bonusBalance ?? new Prisma.Decimal(ZERO)).toString(),
        },
        invitedUser: {
          id: invitedUser.id,
          referredById: invitedUser.referredById,
          referralStatus: invitedUser.referralStatus,
          referralJoinedAt: invitedUser.referralJoinedAt,
          referralActivatedAt: invitedUser.referralActivatedAt,
        },
        usage: {
          applied: true,
          suspicious: false,
        },
      };
    }

    const inviter = await tx.user.findUnique({
      where: { referralCode: normalizedCode },
      select: {
        id: true,
        telegramId: true,
        referralCount: true,
        wallet: {
          select: {
            bonusBalance: true,
          },
        },
      },
    });

    if (!inviter) {
      throw new ReferralServiceError("NOT_FOUND", "Invalid referral code");
    }

    if (inviter.id === invitedUser.id) {
      throw new ReferralServiceError("INVALID_INPUT", "Cannot refer yourself");
    }

    const abuseGuard = await enforceReferralAbuseGuards({
      tx,
      referredUserId: invitedUser.id,
      inviterId: inviter.id,
      ip,
      deviceId: safeDeviceId,
      invitedTelegramId: invitedUser.telegramId,
      inviterTelegramId: inviter.telegramId,
      invitedSignupDeviceId: invitedUser.signupDeviceId,
      invitedDeviceHash: invitedUser.deviceHash,
      maxReferralsPerIpPerDay: config.maxReferralsPerIpPerDay,
    });

    if (!abuseGuard.allowed) {
      await logStructuredEvent("referral_abuse_blocked", {
        userId: invitedUser.id,
        endpoint: "referral/use",
        action: "referral_abuse_blocked",
        inviterId: inviter.id,
        referredUserId: invitedUser.id,
        status: invitedUser.referralStatus,
        referralCode: normalizedCode,
        reason: abuseGuard.reason,
        ip,
        deviceId: safeDeviceId,
        correlationId,
        ...abuseGuard.details,
      });

      throw new ReferralServiceError("RATE_LIMIT", "Referral blocked due to abuse detection");
    }

    const allowed = await checkReferralLimits({
      ip,
      deviceId: safeDeviceId,
      referrerId: inviter.id,
      referredId: invitedUser.id,
      tx,
    });

    if (!allowed) {
      await logStructuredEvent("referral_abuse_blocked", {
        userId: invitedUser.id,
        endpoint: "referral/use",
        action: "referral_abuse_blocked",
        inviterId: inviter.id,
        referredUserId: invitedUser.id,
        status: invitedUser.referralStatus,
        referralCode: normalizedCode,
        reason: "rules_limit_exceeded",
        ip,
        deviceId: safeDeviceId,
        correlationId,
      });

      throw new ReferralServiceError("RATE_LIMIT", "Referral limit exceeded. Try again later.");
    }

    // Transaction-safe write: only one concurrent request can claim the referral slot.
    const referralClaim = await tx.user.updateMany({
      where: {
        id: invitedUser.id,
        referredById: null,
      },
      data: {
        referredById: inviter.id,
        freeBoxUsed: false,
        referralStatus: "JOINED",
        referralJoinedAt: new Date(),
        referralActivatedAt: null,
      },
    });

    if (referralClaim.count === ZERO) {
      const alreadyLinkedUser = await tx.user.findUnique({
        where: { id: invitedUser.id },
        select: {
          id: true,
          referredById: true,
          referralStatus: true,
          referralJoinedAt: true,
          referralActivatedAt: true,
        },
      });

      if (!alreadyLinkedUser?.referredById) {
        throw new ReferralServiceError("INVALID_INPUT", "Referral already used");
      }

      await logStructuredEvent("referral_duplicate_blocked", {
        userId: alreadyLinkedUser.id,
        endpoint: "referral/use",
        action: "referral_duplicate_blocked",
        inviterId: alreadyLinkedUser.referredById,
        referredUserId: alreadyLinkedUser.id,
        status: alreadyLinkedUser.referralStatus,
        rewardAmount: ZERO_STRING,
        correlationId,
        referralCode: normalizedCode,
        reason: "duplicate_grant",
        detectionSource: "post-claim",
      });

      const existingInviter = await tx.user.findUnique({
        where: { id: alreadyLinkedUser.referredById },
        select: {
          id: true,
          referralCode: true,
          referralCount: true,
          wallet: {
            select: {
              bonusBalance: true,
            },
          },
        },
      });

      if (!existingInviter) {
        throw new ReferralServiceError("NOT_FOUND", "Referrer not found");
      }

      const invitedUserWallet = await tx.wallet.findUnique({
        where: { userId: alreadyLinkedUser.id },
        select: {
          cashBalance: true,
          bonusBalance: true,
        },
      });

      if (!invitedUserWallet) {
        throw new ReferralServiceError("NOT_FOUND", "Wallet not found");
      }

      return {
        referralCode: existingInviter.referralCode,
        walletSnapshot: {
          cashBalance: invitedUserWallet.cashBalance.toString(),
          bonusBalance: invitedUserWallet.bonusBalance.toString(),
          airtimeBalance: ZERO_STRING,
        },
        inviter: {
          id: existingInviter.id,
          referralCount: existingInviter.referralCount,
          bonusBalance: (existingInviter.wallet?.bonusBalance ?? new Prisma.Decimal(ZERO)).toString(),
        },
        invitedUser: {
          id: alreadyLinkedUser.id,
          referredById: alreadyLinkedUser.referredById,
          referralStatus: alreadyLinkedUser.referralStatus,
          referralJoinedAt: alreadyLinkedUser.referralJoinedAt,
          referralActivatedAt: alreadyLinkedUser.referralActivatedAt,
        },
        usage: {
          applied: true,
          suspicious: false,
        },
      };
    }

    await logReferral({
      referrerId: inviter.id,
      referredId: invitedUser.id,
      ip,
      deviceId: safeDeviceId,
      suspicious: !allowed,
      tx,
    });

    const updatedInviter = await tx.user.update({
      where: { id: inviter.id },
      data: {
        referralCount: { increment: ONE },
      },
      select: {
        id: true,
        referralCount: true,
        wallet: {
          select: {
            bonusBalance: true,
          },
        },
      },
    });

    const updatedInvitedUser = await tx.user.findUnique({
      where: { id: invitedUser.id },
      select: {
        id: true,
        referredById: true,
        referralStatus: true,
        referralJoinedAt: true,
        referralActivatedAt: true,
      },
    });

    if (!updatedInvitedUser?.referredById) {
      throw new ReferralServiceError("INTERNAL_ERROR", "Failed to resolve updated referral state");
    }

    const invitedUserWallet = await tx.wallet.findUnique({
      where: { userId: invitedUser.id },
      select: {
        cashBalance: true,
        bonusBalance: true,
      },
    });

    if (!invitedUserWallet) {
      throw new ReferralServiceError("NOT_FOUND", "Wallet not found");
    }

    await logStructuredEvent("referral_joined", {
      userId: invitedUser.id,
      endpoint: "referral/use",
      action: "referral_joined",
      referrerId: inviter.id,
      inviterId: inviter.id,
      referredUserId: invitedUser.id,
      status: "JOINED",
      rewardAmount: ZERO_STRING,
      correlationId,
      referralCode: normalizedCode,
      ip,
      deviceId: safeDeviceId,
      referralStatus: "JOINED",
    });

    return {
      referralCode: normalizedCode,
      walletSnapshot: {
        cashBalance: invitedUserWallet.cashBalance.toString(),
        bonusBalance: invitedUserWallet.bonusBalance.toString(),
        airtimeBalance: ZERO_STRING,
      },
      inviter: {
        id: updatedInviter.id,
        referralCount: updatedInviter.referralCount,
        bonusBalance: (updatedInviter.wallet?.bonusBalance ?? new Prisma.Decimal(ZERO)).toString(),
      },
      invitedUser: {
        id: updatedInvitedUser.id,
        referredById: updatedInvitedUser.referredById,
        referralStatus: updatedInvitedUser.referralStatus,
        referralJoinedAt: updatedInvitedUser.referralJoinedAt,
        referralActivatedAt: updatedInvitedUser.referralActivatedAt,
      },
      usage: {
        applied: true,
        suspicious: !allowed,
      },
    };
  });
}
