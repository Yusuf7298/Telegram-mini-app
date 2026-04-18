import { Request, Response } from "express";
import { failure, success } from "../../utils/responder";
import { claimDailyReward, getDailyRewardStatus, getWinHistory } from "./rewards.service";

function getRequestUserId(req: Request): string | undefined {
  return (req as Request & { userId?: string }).userId;
}

function parseLimit(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function getDailyRewardStatusHandler(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    if (!userId) {
      return failure(res, "UNAUTHORIZED", "Unauthorized");
    }

    const status = await getDailyRewardStatus(userId);
    return success(res, status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch daily reward status";
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function claimDailyRewardHandler(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    if (!userId) {
      return failure(res, "UNAUTHORIZED", "Unauthorized");
    }

    const claimResult = await claimDailyReward(userId);
    return success(res, claimResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to claim daily reward";
    if (message === "Daily reward already claimed") {
      return failure(res, "INVALID_INPUT", message);
    }

    if (message === "Account restricted") {
      return failure(res, "FORBIDDEN", message);
    }

    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function getWinHistoryHandler(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    if (!userId) {
      return failure(res, "UNAUTHORIZED", "Unauthorized");
    }

    const history = await getWinHistory(userId, parseLimit(req.query.limit));
    return success(res, history);
  } catch {
    return failure(res, "INTERNAL_ERROR", "Failed to fetch win history");
  }
}
