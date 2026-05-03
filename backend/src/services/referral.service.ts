// NEW: Referral protection service
import { prisma } from "../config/db";
import { isFeatureEnabled } from "../config/featureFlags";
import { Prisma } from "@prisma/client";
import { ApiErrorCode } from "../utils/apiResponse";
import { logStructuredEvent } from "./logger";
import { logAudit } from "./auditLog.service";
import { canUseReferral } from "./rules.service";
import { ONE, ZERO, ZERO_STRING } from "../constants/numbers";
import { getCorrelationId } from "./requestContext.service";
import { getValidatedGameConfig } from "./gameConfig.service";
import { createReferralStructuredLogPayload } from "./referralLogPayload.service";
import { withTransactionRetry } from "./withTransactionRetry";

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
  idempotencyKey: string;
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

export type ReferralActivationResult = {
  referredUserId: string;
  referrerId: string;
  rewardAmount: string;
  referralId: string;
  transactionId: string;
};

class DuplicateReferralRewardError extends Error {
  existingReferralId: string | null;
  existingTransactionId: string | null;

  constructor(existingReferralId: string | null, existingTransactionId: string | null) {
    super("Duplicate referral reward detected");
    this.name = "DuplicateReferralRewardError";
    this.existingReferralId = existingReferralId;
    this.existingTransactionId = existingTransactionId;
  }
}

type ActivateReferralParams = {
  referredUserId: string;
  sourceAction?: string;
  endpoint?: string;
  tx?: Prisma.TransactionClient;
  rewardAmount?: Prisma.Decimal;
};

async function emitReferralEvent(params: {
  event: "referral_joined" | "referral_activation_attempt" | "referral_reward_granted" | "referral_duplicate_blocked";
  endpoint: string;
  inviterId: string;
  referredUserId: string;
  rewardAmount: string;
  status: string;
  correlationId?: string | null;
  referralId?: string | null;
  transactionId?: string | null;
  reason?: string | null;
  detectionSource?: string | null;
  referralCode?: string | null;
  ip?: string | null;
  deviceId?: string | null;
}) {
  await logStructuredEvent(
    params.event,
    createReferralStructuredLogPayload({
      event: params.event,
      endpoint: params.endpoint,
      inviterId: params.inviterId,
      referredUserId: params.referredUserId,
      rewardAmount: params.rewardAmount,
      status: params.status,
      correlationId: params.correlationId?.trim() || getCorrelationId() || "unknown",
      referralId: params.referralId ?? null,
      transactionId: params.transactionId ?? null,
      reason: params.reason ?? null,
      detectionSource: params.detectionSource ?? null,
      referralCode: params.referralCode ?? null,
      ip: params.ip ?? null,
      deviceId: params.deviceId ?? null,
    })
  );
}

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

export async function applyReferralCode(params: ApplyReferralParams): Promise<ApplyReferralResult> {
  const { referredUserId, referralCode, ip, deviceId, idempotencyKey } = params;
  const normalizedCode = referralCode.trim().toUpperCase();

  // Feature flag: disable referral system entirely if flag is off
  if (!(await isFeatureEnabled('referral.enabled'))) {
    throw new ReferralServiceError('FORBIDDEN', 'Referrals are temporarily disabled');
  }

  if (!normalizedCode) {
    throw new ReferralServiceError("INVALID_INPUT", "Referral code is required");
  }
  return withTransactionRetry(prisma, async (tx) => {
    // IDEMPOTENCY ENFORCEMENT
    const existing = await (await import("./idempotency.service")).checkIdempotencyKey({
      id: idempotencyKey,
      userId: referredUserId,
      tx,
    });
    if (existing?.status === "COMPLETED") {
      if (existing.response && typeof existing.response === 'object' && 'data' in existing.response) {
        return (existing.response as any).data as ApplyReferralResult;
      }
      throw new ReferralServiceError('REPLAY_ATTACK', 'Duplicate idempotency key, but no valid response cached');
    }
    if (existing?.status === "PENDING") {
      throw new ReferralServiceError("REPLAY_ATTACK", "Idempotent request is still processing");
    }
    try {
      await (await import("./idempotency.service")).createIdempotencyKey({
        id: idempotencyKey,
        userId: referredUserId,
        action: "applyReferralCode",
        tx,
      });
    } catch (err) {
      const duplicate = await (await import("./idempotency.service")).checkIdempotencyKey({
        id: idempotencyKey,
        userId: referredUserId,
        tx,
      });
      if (duplicate?.status === "COMPLETED") {
        if (duplicate.response && typeof duplicate.response === 'object' && 'data' in duplicate.response) {
          return (duplicate.response as any).data as ApplyReferralResult;
        }
        throw new ReferralServiceError('REPLAY_ATTACK', 'Duplicate idempotency key, but no valid response cached');
      }
      if (duplicate?.status === "PENDING") {
        throw new ReferralServiceError("REPLAY_ATTACK", "Idempotent request is still processing");
      }
      throw err;
    }
    const correlationId = getCorrelationId() ?? "unknown";
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

      await emitReferralEvent({
        event: "referral_duplicate_blocked",
        endpoint: "referral/use",
        inviterId: existingInviter.id,
        referredUserId: invitedUser.id,
        rewardAmount: ZERO_STRING,
        status: invitedUser.referralStatus,
        correlationId,
        referralCode: existingInviter.referralCode,
        reason: "duplicate_grant",
        detectionSource: "pre-check",
        ip,
        deviceId: safeDeviceId,
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

      await emitReferralEvent({
        event: "referral_duplicate_blocked",
        endpoint: "referral/use",
        inviterId: alreadyLinkedUser.referredById,
        referredUserId: alreadyLinkedUser.id,
        rewardAmount: ZERO_STRING,
        status: alreadyLinkedUser.referralStatus,
        correlationId,
        referralCode: normalizedCode,
        reason: "duplicate_grant",
        detectionSource: "post-claim",
        ip,
        deviceId: safeDeviceId,
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

    await emitReferralEvent({
      event: "referral_joined",
      endpoint: "referral/use",
      inviterId: inviter.id,
      referredUserId: invitedUser.id,
      rewardAmount: ZERO_STRING,
      status: "JOINED",
      correlationId,
      referralCode: normalizedCode,
      ip,
      deviceId: safeDeviceId,
    });

    const result: ApplyReferralResult = {
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

    await (await import("./idempotency.service")).completeIdempotencyKey({
      id: idempotencyKey,
      userId: referredUserId,
      response: result,
      metadata: {
        action: "applyReferralCode",
        referralCode: normalizedCode,
      },
      tx,
    });

    return result;
  });
}

export async function activateReferralFromJoinedToActive({
  referredUserId,
  sourceAction = "open_box_success",
  endpoint = "game/open-box",
  tx,
  rewardAmount,
}: ActivateReferralParams): Promise<ReferralActivationResult | null> {
  // Respect feature flag: if referrals disabled, skip activation
  if (!(await isFeatureEnabled('referral.enabled'))) {
    return null;
  }
  const resolvedRewardAmount =
    rewardAmount ?? (await getValidatedGameConfig({ bypassCache: true })).referralRewardAmount;

  const runActivation = async (
    client: Prisma.TransactionClient,
    onDuplicate: "return-null" | "throw"
  ): Promise<ReferralActivationResult | null> => {
    const referredUser = await client.user.findUnique({
      where: { id: referredUserId },
      select: {
        referredById: true,
        referralStatus: true,
      },
    });

    if (!referredUser?.referredById) {
      return null;
    }

    if (referredUser.referralStatus !== "JOINED") {
      return null;
    }

    const referrerId = referredUser.referredById;
    const correlationId = getCorrelationId() ?? "unknown";
    const activationRewardAmount = resolvedRewardAmount;

    let rewardGrant: { id: string; amount: Prisma.Decimal };
    try {
      rewardGrant = await client.referralRewardGrant.create({
        data: {
          inviterId: referrerId,
          referredUserId,
          amount: activationRewardAmount,
          sourceAction,
        },
        select: { id: true, amount: true },
      });

      // Emit attempt only after the DB grant-insert attempt actually succeeded.
      await emitReferralEvent({
        event: "referral_activation_attempt",
        endpoint,
        inviterId: referrerId,
        referredUserId,
        rewardAmount: activationRewardAmount.toString(),
        status: "JOINED",
        correlationId,
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }

      const findReferralTx =
        typeof (client.transaction as { findFirst?: unknown }).findFirst === "function"
          ? client.transaction.findFirst({
              where: {
                userId: referrerId,
                type: "REFERRAL",
                meta: {
                  path: ["referredUserId"],
                  equals: referredUserId,
                },
              },
              orderBy: { createdAt: "desc" },
              select: { id: true },
            })
          : Promise.resolve(null);

      const [existingGrant, existingReferralTx] = await Promise.all([
        client.referralRewardGrant.findUnique({
          where: { referredUserId },
          select: { id: true, amount: true },
        }),
        findReferralTx,
      ]);

      // Duplicate is an actual grant-insert attempt too, so emit attempt here once.
      await emitReferralEvent({
        event: "referral_activation_attempt",
        endpoint,
        inviterId: referrerId,
        referredUserId,
        rewardAmount: existingGrant?.amount?.toString?.() ?? activationRewardAmount.toString(),
        status: "JOINED",
        correlationId,
      });

      await emitReferralEvent({
        event: "referral_duplicate_blocked",
        endpoint,
        inviterId: referrerId,
        referredUserId,
        rewardAmount: existingGrant?.amount?.toString?.() ?? activationRewardAmount.toString(),
        status: "JOINED",
        referralId: existingGrant?.id ?? null,
        transactionId: existingReferralTx?.id ?? null,
        reason: "reward_grant_unique_conflict",
        detectionSource: "p2002",
        correlationId,
      });

      if (onDuplicate === "throw") {
        throw new DuplicateReferralRewardError(existingGrant?.id ?? null, existingReferralTx?.id ?? null);
      }

      // A concurrent request already granted the reward. Returning null keeps this path idempotent.
      return null;
    }

    const activationUpdate = await client.user.updateMany({
      where: {
        id: referredUserId,
        referralStatus: "JOINED",
      },
      data: {
        referralStatus: "ACTIVE",
        referralActivatedAt: new Date(),
      },
    });

    if (activationUpdate.count !== ONE) {
      throw new Error("Referral status transition failed: expected JOINED -> ACTIVE");
    }

    const referrerWalletBefore = await client.wallet.findUnique({
      where: { userId: referrerId },
      select: {
        cashBalance: true,
        bonusBalance: true,
      },
    });

    if (!referrerWalletBefore) {
      throw new Error("Referrer wallet not found");
    }

    const balanceBefore = referrerWalletBefore.cashBalance.plus(referrerWalletBefore.bonusBalance);
    const referrerWalletAfter = await client.wallet.update({
      where: { userId: referrerId },
      data: {
        cashBalance: { increment: activationRewardAmount },
      },
      select: {
        cashBalance: true,
        bonusBalance: true,
      },
    });
    const balanceAfter = referrerWalletAfter.cashBalance.plus(referrerWalletAfter.bonusBalance);

    if (!balanceAfter.minus(balanceBefore).equals(activationRewardAmount)) {
      throw new Error("Referral wallet increment mismatch");
    }

    const referralTx = await client.transaction.create({
      data: {
        userId: referrerId,
        type: "REFERRAL",
        amount: activationRewardAmount,
        balanceBefore,
        balanceAfter,
        meta: {
          referredUserId,
          milestone: "open_box_first_success",
        },
      },
      select: { id: true },
    });

    await logAudit({
      userId: referredUserId,
      action: "referral_reward_triggered",
      details: {
        referrerId,
        sourceAction,
        transition: "JOINED_TO_ACTIVE",
      },
      tx: client,
    });

    await logAudit({
      userId: referrerId,
      action: "referral_reward",
      details: {
        rewardAmount: activationRewardAmount.toString(),
        referredUserId,
        sourceAction,
      },
      tx: client,
    });

    await emitReferralEvent({
      event: "referral_reward_granted",
      endpoint,
      inviterId: referrerId,
      referredUserId,
      rewardAmount: activationRewardAmount.toString(),
      status: "ACTIVE",
      referralId: rewardGrant.id,
      transactionId: referralTx.id,
      correlationId,
    });

    return {
      referredUserId,
      referrerId,
      rewardAmount: activationRewardAmount.toString(),
      referralId: rewardGrant.id,
      transactionId: referralTx.id,
    };
  };

  if (tx) {
    return runActivation(tx, "return-null");
  }

  return prisma.$transaction(async (client) => runActivation(client, "return-null"));
}

