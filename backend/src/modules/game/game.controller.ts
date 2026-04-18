import { Request, Response } from "express";
import { getBoxes, openBox, openFreeBox } from "./game.service";
import { prisma } from "../../config/db";
import { failure, success } from "../../utils/responder";
import { extractIdempotencyKey } from "../../utils/idempotencyKey";

function getRequestUserId(req: Request): string | undefined {
  return (req as Request & { userId?: string }).userId;
}

async function ensureWalletSnapshotInResponseData(payload: unknown, userId: string) {
  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    if (data.walletSnapshot && typeof data.walletSnapshot === "object") {
      return payload;
    }
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: {
      cashBalance: true,
      bonusBalance: true,
    },
  });

  if (!wallet) {
    return payload;
  }

  const walletSnapshot = {
    cashBalance: wallet.cashBalance,
    bonusBalance: wallet.bonusBalance,
    airtimeBalance: 0,
  };

  if (payload && typeof payload === "object") {
    return {
      ...(payload as Record<string, unknown>),
      walletSnapshot,
    };
  }

  return { walletSnapshot };
}

export async function openBoxController(req: Request, res: Response) {
  try {
    const { boxId } = req.body;
    const idempotencyKey = extractIdempotencyKey(req);
    const userId = getRequestUserId(req);

    if (!userId) {
      return failure(res, "INVALID_INPUT", "userId is required");
    }

    if (!boxId) {
      return failure(res, "INVALID_INPUT", "boxId is required");
    }

    if (!idempotencyKey) {
      return failure(res, "INVALID_INPUT", "idempotencyKey is required");
    }

    const replaySafeResponse = await openBox(
      userId,
      boxId,
      idempotencyKey,
      req.ip,
      req.headers["x-device-id"] as string | undefined
    ) as { success: true; data: unknown; error: null };
    const responseDataWithWalletSnapshot = await ensureWalletSnapshotInResponseData(
      replaySafeResponse.data,
      userId
    );

    return success(res, responseDataWithWalletSnapshot);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function freeBoxController(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    const idempotencyKey = extractIdempotencyKey(req);

    if (!userId) {
      return failure(res, "INVALID_INPUT", "userId is required");
    }

    if (!idempotencyKey) {
      return failure(res, "INVALID_INPUT", "idempotencyKey is required");
    }

    const freeBoxResult = await openFreeBox(
      userId,
      idempotencyKey,
      req.ip,
      req.headers["x-device-id"] as string | undefined
    ) as { success: true; data: unknown; error: null };
    const responseDataWithWalletSnapshot = await ensureWalletSnapshotInResponseData(
      freeBoxResult.data,
      userId
    );

    return success(res, responseDataWithWalletSnapshot);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function getBoxesController(_req: Request, res: Response) {
  try {
    const boxes = await getBoxes();
    return success(res, boxes);
  } catch {
    return failure(res, "INTERNAL_ERROR", "Failed to load boxes");
  }
}