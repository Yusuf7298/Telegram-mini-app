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
import { verifySystemIntegrity, getSystemMetrics } from "../../services/systemStats.service";

export async function getMetrics(_req: Request, res: Response) {
  try {
    const metrics = await getSystemMetrics();
    return res.json(metrics);
  } catch {
    return res.status(500).json({ error: "Failed to fetch metrics" });
  }
}

export async function verifySystemIntegrityHandler(_req: Request, res: Response) {
  try {
    const result = await verifySystemIntegrity();
    return res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return res.status(500).json({ error: message });
  }
}

export async function createReward(req: Request, res: Response) {
  try {
    const tx = (req as any).tx ?? prisma;
    const reward = await createBoxReward(req.body, tx);
    return res.status(201).json(reward);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create reward";
    return res.status(400).json({ error: message });
  }
}

export async function updateReward(req: Request, res: Response) {
  try {
    const tx = (req as any).tx ?? prisma;
    const reward = await updateBoxReward(String(req.params.id), req.body, tx);
    return res.json(reward);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update reward";
    return res.status(400).json({ error: message });
  }
}

export async function deleteReward(req: Request, res: Response) {
  try {
    const tx = (req as any).tx ?? prisma;
    await deleteBoxReward(String(req.params.id), tx);
    return res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete reward";
    return res.status(400).json({ error: message });
  }
}

export async function listRewardsByBox(req: Request, res: Response) {
  try {
    const tx = (req as any).tx ?? prisma;
    const rewards = await listBoxRewardsByBox(String(req.params.boxId), tx);
    return res.json(rewards);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list rewards";
    return res.status(400).json({ error: message });
  }
}

export async function freezeUserHandler(req: Request, res: Response) {
  try {
    const userId = req.body?.targetId || req.body?.userId;
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    await freezeUserService(String(userId));
    return res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to freeze user";
    return res.status(400).json({ success: false, error: message });
  }
}

export async function unfreezeUserHandler(req: Request, res: Response) {
  try {
    const userId = req.body?.targetId || req.body?.userId;
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    await unfreezeUser(String(userId));
    return res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to unfreeze user";
    return res.status(400).json({ success: false, error: message });
  }
}

export async function revokeRewardHandler(req: Request, res: Response) {
  try {
    const transactionId = req.body?.targetId || req.body?.transactionId;
    const reason = req.body?.reason || "admin_action";

    if (!transactionId) {
      return res.status(400).json({ success: false, error: "transactionId is required" });
    }

    await revokeRewardService(String(transactionId), String(reason));
    return res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to revoke reward";
    return res.status(400).json({ success: false, error: message });
  }
}

export async function freezeUser(req: Request, res: Response) {
  return freezeUserHandler(req, res);
}

export async function revokeReward(req: Request, res: Response) {
  return revokeRewardHandler(req, res);
}

export async function updateConfig(_req: Request, res: Response) {
  return res.json({ success: true });
}
