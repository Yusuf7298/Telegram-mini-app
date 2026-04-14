import { Request, Response } from "express";
import { prisma } from "../../config/db";
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
