import { Request, Response } from "express";
import { prisma } from "../../config/db";
import { Prisma } from "@prisma/client";
import {
  createBoxReward,
  updateBoxReward,
  deleteBoxReward,
  listBoxRewardsByBox,
} from "../../services/boxRewardAdmin.service";
import {
  freezeUser as freezeUserService,
  unfreezeUser,
  revokeReward as revokeRewardService,
} from "../../services/admin.service";
import { verifySystemIntegrity, getSystemMetrics, verifyWalletConstraintIntegrity } from "../../services/systemStats.service";
import { runRuntimeCheck } from "../../services/runtimeCheck.service";
import { failure, success } from "../../utils/responder";
import { getFraudEvents, getHighRiskUsers } from "../../services/adminMonitoring.service";
import { getValidatedGameConfig, invalidateGameConfigCache } from "../../services/gameConfig.service";

function parseDecimal(value: unknown): Prisma.Decimal | null {
  try {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    return new Prisma.Decimal(value as string | number);
  } catch {
    return null;
  }
}

export async function getMetrics(_req: Request, res: Response) {
  try {
    const metrics = await getSystemMetrics();
    return success(res, metrics);
  } catch {
    return failure(res, "INTERNAL_ERROR", "Failed to fetch metrics");
  }
}

export async function getFraudEventsHandler(_req: Request, res: Response) {
  try {
    const events = await getFraudEvents();
    return success(res, events);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch fraud events";
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function getHighRiskUsersHandler(_req: Request, res: Response) {
  try {
    const users = await getHighRiskUsers();
    return success(res, users);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch high-risk users";
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function verifySystemIntegrityHandler(_req: Request, res: Response) {
  try {
    const result = await verifySystemIntegrity();
    return success(res, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function verifyWalletConstraintIntegrityHandler(_req: Request, res: Response) {
  try {
    const result = await verifyWalletConstraintIntegrity();
    return success(res, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function runtimeCheckHandler(_req: Request, res: Response) {
  try {
    const result = await runRuntimeCheck();
    return success(res, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Runtime check failed";
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function createReward(req: Request, res: Response) {
  try {
    const tx = (req as any).tx ?? prisma;
    const reward = await createBoxReward(req.body, tx);
    return success(res, reward, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create reward";
    return failure(res, "INVALID_INPUT", message);
  }
}

export async function updateReward(req: Request, res: Response) {
  try {
    const tx = (req as any).tx ?? prisma;
    const reward = await updateBoxReward(String(req.params.id), req.body, tx);
    return success(res, reward);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update reward";
    return failure(res, "INVALID_INPUT", message);
  }
}

export async function deleteReward(req: Request, res: Response) {
  try {
    const tx = (req as any).tx ?? prisma;
    await deleteBoxReward(String(req.params.id), tx);
    return success(res, {});
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete reward";
    return failure(res, "INVALID_INPUT", message);
  }
}

export async function listRewardsByBox(req: Request, res: Response) {
  try {
    const tx = (req as any).tx ?? prisma;
    const rewards = await listBoxRewardsByBox(String(req.params.boxId), tx);
    return success(res, rewards);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list rewards";
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function freezeUserHandler(req: Request, res: Response) {
  try {
    const userId = req.body?.targetId || req.body?.userId;
    if (!userId) {
      return failure(res, "INVALID_INPUT", "userId is required");
    }

    await freezeUserService(String(userId));
    return success(res, {});
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to freeze user";
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function unfreezeUserHandler(req: Request, res: Response) {
  try {
    const userId = req.body?.targetId || req.body?.userId;
    if (!userId) {
      return failure(res, "INVALID_INPUT", "userId is required");
    }

    await unfreezeUser(String(userId));
    return success(res, {});
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to unfreeze user";
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function revokeRewardHandler(req: Request, res: Response) {
  try {
    const transactionId = req.body?.targetId || req.body?.transactionId;
    const reason = req.body?.reason || "admin_action";

    if (!transactionId) {
      return failure(res, "INVALID_INPUT", "transactionId is required");
    }

    await revokeRewardService(String(transactionId), String(reason));
    return success(res, {});
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to revoke reward";
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function freezeUser(req: Request, res: Response) {
  return freezeUserHandler(req, res);
}

export async function revokeReward(req: Request, res: Response) {
  return revokeRewardHandler(req, res);
}

export async function updateConfig(_req: Request, res: Response) {
  return success(res, {});
}

export async function getAdminConfig(_req: Request, res: Response) {
  try {
    const config = await getValidatedGameConfig({ bypassCache: true });
    return success(res, { config });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch admin config";
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function listAdmins(req: Request, res: Response) {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: {
          in: ["ADMIN", "SUPER_ADMIN"],
        },
      },
      orderBy: [{ role: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        platformId: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    return success(res, {
      requestedBy: req.user?.role ?? null,
      admins,
    });
  } catch {
    return failure(res, "INTERNAL_ERROR", "Failed to list admins");
  }
}

export async function createAdmin(req: Request, res: Response) {
  try {
    const userId = String(req.body?.userId || "").trim();
    if (!userId) {
      return failure(res, "INVALID_INPUT", "userId is required");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: "ADMIN" },
      select: {
        id: true,
        platformId: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    return success(res, {
      message: "Admin created",
      user: updated,
    });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return failure(res, "NOT_FOUND", "User not found");
    }
    return failure(res, "INTERNAL_ERROR", "Failed to create admin");
  }
}

export async function removeAdmin(req: Request, res: Response) {
  try {
    const userId = String(req.body?.userId || "").trim();
    if (!userId) {
      return failure(res, "INVALID_INPUT", "userId is required");
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!target) {
      return failure(res, "NOT_FOUND", "User not found");
    }

    if (target.role === "SUPER_ADMIN") {
      return failure(res, "FORBIDDEN", "Cannot remove SUPER_ADMIN");
    }

    if (target.role !== "ADMIN") {
      return failure(res, "INVALID_INPUT", "Target user is not an admin");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: "USER" },
      select: {
        id: true,
        platformId: true,
        username: true,
        role: true,
      },
    });

    return success(res, {
      message: "Admin removed",
      user: updated,
    });
  } catch {
    return failure(res, "INTERNAL_ERROR", "Failed to remove admin");
  }
}

export async function updateReferralBonus(req: Request, res: Response) {
  try {
    const referralRewardAmount = parseDecimal(req.body?.referralRewardAmount);
    if (!referralRewardAmount || referralRewardAmount.lte(0)) {
      return failure(res, "INVALID_INPUT", "referralRewardAmount must be greater than 0");
    }

    const config = await prisma.gameConfig.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        referralRewardAmount,
      },
      update: {
        referralRewardAmount,
      },
      select: {
        id: true,
        referralRewardAmount: true,
      },
    });

    invalidateGameConfigCache();

    return success(res, {
      message: "Referral bonus updated",
      config,
    });
  } catch {
    return failure(res, "INTERNAL_ERROR", "Failed to update referral bonus");
  }
}

export async function getGameRewardsConfig(_req: Request, res: Response) {
  return getAdminConfig(_req, res);
}

export async function updateGameRewardsConfig(req: Request, res: Response) {
  try {
    const currentConfig = await getValidatedGameConfig({ bypassCache: true });

    const referralRewardAmount =
      req.body?.referralRewardAmount === undefined
        ? undefined
        : parseDecimal(req.body?.referralRewardAmount);
    const freeBoxRewardAmount =
      req.body?.freeBoxRewardAmount === undefined
        ? undefined
        : parseDecimal(req.body?.freeBoxRewardAmount);
    const minBoxReward =
      req.body?.minBoxReward === undefined ? undefined : Number(req.body?.minBoxReward);
    const maxBoxReward =
      req.body?.maxBoxReward === undefined ? undefined : Number(req.body?.maxBoxReward);
    const waitlistBonus =
      req.body?.waitlistBonus === undefined ? undefined : Number(req.body?.waitlistBonus);
    const maxPayoutMultiplier =
      req.body?.maxPayoutMultiplier === undefined
        ? undefined
        : parseDecimal(req.body?.maxPayoutMultiplier);
    const minRtpModifier =
      req.body?.minRtpModifier === undefined
        ? undefined
        : parseDecimal(req.body?.minRtpModifier);
    const maxRtpModifier =
      req.body?.maxRtpModifier === undefined
        ? undefined
        : parseDecimal(req.body?.maxRtpModifier);
    const maxPlaysPerDay =
      req.body?.maxPlaysPerDay === undefined ? undefined : Number(req.body?.maxPlaysPerDay);
    const withdrawMinPlays =
      req.body?.withdrawMinPlays === undefined ? undefined : Number(req.body?.withdrawMinPlays);
    const withdrawCooldownMs =
      req.body?.withdrawCooldownMs === undefined ? undefined : Number(req.body?.withdrawCooldownMs);
    const withdrawRiskThreshold =
      req.body?.withdrawRiskThreshold === undefined ? undefined : Number(req.body?.withdrawRiskThreshold);
    const maxReferralsPerIpPerDay =
      req.body?.maxReferralsPerIpPerDay === undefined
        ? undefined
        : Number(req.body?.maxReferralsPerIpPerDay);
    const waitlistRiskThreshold =
      req.body?.waitlistRiskThreshold === undefined ? undefined : Number(req.body?.waitlistRiskThreshold);
    const rapidOnboardingWindowMs =
      req.body?.rapidOnboardingWindowMs === undefined
        ? undefined
        : Number(req.body?.rapidOnboardingWindowMs);
    const minPlayIntervalMs =
      req.body?.minPlayIntervalMs === undefined ? undefined : Number(req.body?.minPlayIntervalMs);
    const referralWindowMs =
      req.body?.referralWindowMs === undefined ? undefined : Number(req.body?.referralWindowMs);

    if (referralRewardAmount !== undefined && (!referralRewardAmount || referralRewardAmount.lte(0))) {
      return failure(res, "INVALID_INPUT", "referralRewardAmount must be greater than 0");
    }

    if (freeBoxRewardAmount !== undefined && (!freeBoxRewardAmount || freeBoxRewardAmount.lt(0))) {
      return failure(res, "INVALID_INPUT", "freeBoxRewardAmount must be a non-negative number");
    }
    if (minBoxReward !== undefined && (!Number.isInteger(minBoxReward) || minBoxReward < 0)) {
      return failure(res, "INVALID_INPUT", "minBoxReward must be a non-negative integer");
    }
    if (maxBoxReward !== undefined && (!Number.isInteger(maxBoxReward) || maxBoxReward < 0)) {
      return failure(res, "INVALID_INPUT", "maxBoxReward must be a non-negative integer");
    }
    if (waitlistBonus !== undefined && (!Number.isInteger(waitlistBonus) || waitlistBonus < 0)) {
      return failure(res, "INVALID_INPUT", "waitlistBonus must be a non-negative integer");
    }
    if (maxPayoutMultiplier !== undefined && (!maxPayoutMultiplier || maxPayoutMultiplier.lte(0))) {
      return failure(res, "INVALID_INPUT", "maxPayoutMultiplier must be greater than 0");
    }
    if (minRtpModifier !== undefined && (!minRtpModifier || minRtpModifier.lte(0))) {
      return failure(res, "INVALID_INPUT", "minRtpModifier must be greater than 0");
    }
    if (maxRtpModifier !== undefined && (!maxRtpModifier || maxRtpModifier.lte(0))) {
      return failure(res, "INVALID_INPUT", "maxRtpModifier must be greater than 0");
    }
    if (maxPlaysPerDay !== undefined && (!Number.isInteger(maxPlaysPerDay) || maxPlaysPerDay <= 0)) {
      return failure(res, "INVALID_INPUT", "maxPlaysPerDay must be a positive integer");
    }
    if (withdrawMinPlays !== undefined && (!Number.isInteger(withdrawMinPlays) || withdrawMinPlays <= 0)) {
      return failure(res, "INVALID_INPUT", "withdrawMinPlays must be a positive integer");
    }
    if (withdrawCooldownMs !== undefined && (!Number.isInteger(withdrawCooldownMs) || withdrawCooldownMs <= 0)) {
      return failure(res, "INVALID_INPUT", "withdrawCooldownMs must be a positive integer");
    }
    if (withdrawRiskThreshold !== undefined && (!Number.isInteger(withdrawRiskThreshold) || withdrawRiskThreshold < 0)) {
      return failure(res, "INVALID_INPUT", "withdrawRiskThreshold must be a non-negative integer");
    }
    if (
      maxReferralsPerIpPerDay !== undefined &&
      (!Number.isInteger(maxReferralsPerIpPerDay) || maxReferralsPerIpPerDay <= 0)
    ) {
      return failure(res, "INVALID_INPUT", "maxReferralsPerIpPerDay must be a positive integer");
    }
    if (waitlistRiskThreshold !== undefined && (!Number.isInteger(waitlistRiskThreshold) || waitlistRiskThreshold < 0)) {
      return failure(res, "INVALID_INPUT", "waitlistRiskThreshold must be a non-negative integer");
    }
    if (
      rapidOnboardingWindowMs !== undefined &&
      (!Number.isInteger(rapidOnboardingWindowMs) || rapidOnboardingWindowMs <= 0)
    ) {
      return failure(res, "INVALID_INPUT", "rapidOnboardingWindowMs must be a positive integer");
    }
    if (minPlayIntervalMs !== undefined && (!Number.isInteger(minPlayIntervalMs) || minPlayIntervalMs <= 0)) {
      return failure(res, "INVALID_INPUT", "minPlayIntervalMs must be a positive integer");
    }
    if (referralWindowMs !== undefined && (!Number.isInteger(referralWindowMs) || referralWindowMs <= 0)) {
      return failure(res, "INVALID_INPUT", "referralWindowMs must be a positive integer");
    }

    const effectiveMinBoxReward = minBoxReward ?? currentConfig.minBoxReward;
    const effectiveMaxBoxReward = maxBoxReward ?? currentConfig.maxBoxReward;
    if (!(effectiveMinBoxReward < effectiveMaxBoxReward)) {
      return failure(res, "INVALID_INPUT", "minBoxReward must be less than maxBoxReward");
    }

    const effectiveMinRtpModifier =
      minRtpModifier?.toNumber() ?? currentConfig.minRtpModifier.toNumber();
    const effectiveMaxRtpModifier =
      maxRtpModifier?.toNumber() ?? currentConfig.maxRtpModifier.toNumber();

    if (!(effectiveMinRtpModifier <= effectiveMaxRtpModifier)) {
      return failure(res, "INVALID_INPUT", "minRtpModifier must be less than or equal to maxRtpModifier");
    }

    if (!(currentConfig.rtpModifier >= effectiveMinRtpModifier && currentConfig.rtpModifier <= effectiveMaxRtpModifier)) {
      return failure(
        res,
        "INVALID_INPUT",
        "rtpModifier must remain within [minRtpModifier, maxRtpModifier]"
      );
    }

    const config = await prisma.gameConfig.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        ...(referralRewardAmount !== undefined ? { referralRewardAmount } : {}),
        ...(freeBoxRewardAmount !== undefined ? { freeBoxRewardAmount } : {}),
        ...(minBoxReward !== undefined ? { minBoxReward } : {}),
        ...(maxBoxReward !== undefined ? { maxBoxReward } : {}),
        ...(waitlistBonus !== undefined ? { waitlistBonus } : {}),
        ...(maxPayoutMultiplier !== undefined ? { maxPayoutMultiplier } : {}),
        ...(minRtpModifier !== undefined ? { minRtpModifier } : {}),
        ...(maxRtpModifier !== undefined ? { maxRtpModifier } : {}),
        ...(maxPlaysPerDay !== undefined ? { maxPlaysPerDay } : {}),
        ...(withdrawMinPlays !== undefined ? { withdrawMinPlays } : {}),
        ...(withdrawCooldownMs !== undefined ? { withdrawCooldownMs } : {}),
        ...(withdrawRiskThreshold !== undefined ? { withdrawRiskThreshold } : {}),
        ...(maxReferralsPerIpPerDay !== undefined ? { maxReferralsPerIpPerDay } : {}),
        ...(waitlistRiskThreshold !== undefined ? { waitlistRiskThreshold } : {}),
        ...(rapidOnboardingWindowMs !== undefined ? { rapidOnboardingWindowMs } : {}),
        ...(minPlayIntervalMs !== undefined ? { minPlayIntervalMs } : {}),
        ...(referralWindowMs !== undefined ? { referralWindowMs } : {}),
      },
      update: {
        ...(referralRewardAmount !== undefined ? { referralRewardAmount } : {}),
        ...(freeBoxRewardAmount !== undefined ? { freeBoxRewardAmount } : {}),
        ...(minBoxReward !== undefined ? { minBoxReward } : {}),
        ...(maxBoxReward !== undefined ? { maxBoxReward } : {}),
        ...(waitlistBonus !== undefined ? { waitlistBonus } : {}),
        ...(maxPayoutMultiplier !== undefined ? { maxPayoutMultiplier } : {}),
        ...(minRtpModifier !== undefined ? { minRtpModifier } : {}),
        ...(maxRtpModifier !== undefined ? { maxRtpModifier } : {}),
        ...(maxPlaysPerDay !== undefined ? { maxPlaysPerDay } : {}),
        ...(withdrawMinPlays !== undefined ? { withdrawMinPlays } : {}),
        ...(withdrawCooldownMs !== undefined ? { withdrawCooldownMs } : {}),
        ...(withdrawRiskThreshold !== undefined ? { withdrawRiskThreshold } : {}),
        ...(maxReferralsPerIpPerDay !== undefined ? { maxReferralsPerIpPerDay } : {}),
        ...(waitlistRiskThreshold !== undefined ? { waitlistRiskThreshold } : {}),
        ...(rapidOnboardingWindowMs !== undefined ? { rapidOnboardingWindowMs } : {}),
        ...(minPlayIntervalMs !== undefined ? { minPlayIntervalMs } : {}),
        ...(referralWindowMs !== undefined ? { referralWindowMs } : {}),
      },
      select: {
        id: true,
        referralRewardAmount: true,
        freeBoxRewardAmount: true,
        minBoxReward: true,
        maxBoxReward: true,
        waitlistBonus: true,
        maxPayoutMultiplier: true,
        minRtpModifier: true,
        maxRtpModifier: true,
        maxPlaysPerDay: true,
        withdrawMinPlays: true,
        withdrawCooldownMs: true,
        withdrawRiskThreshold: true,
        maxReferralsPerIpPerDay: true,
        waitlistRiskThreshold: true,
        rapidOnboardingWindowMs: true,
        minPlayIntervalMs: true,
        referralWindowMs: true,
      },
    });

    invalidateGameConfigCache();

    return success(res, {
      message: "Game rewards config updated",
      config,
    });
  } catch {
    return failure(res, "INTERNAL_ERROR", "Failed to update game rewards config");
  }
}

export async function patchAdminConfig(req: Request, res: Response) {
  return updateGameRewardsConfig(req, res);
}
