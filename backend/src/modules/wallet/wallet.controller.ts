import { Request, Response } from "express";
import { prisma } from "../../config/db";
import { depositWallet, withdrawWallet } from "./wallet.service";
import { Prisma } from '@prisma/client';
import { failure, success } from "../../utils/responder";
import { extractIdempotencyKey } from "../../utils/idempotencyKey";
import { logError } from "../../services/logger";

function getRequestUserId(req: Request): string | undefined {
  return (req as Request & { userId?: string }).userId;
}


function parsePositiveDecimal(value: unknown): Prisma.Decimal | null {
  try {
    const normalized =
      typeof value === "number" || typeof value === "string"
        ? value
        : null;

    if (normalized === null) {
      return null;
    }

    const decimal = new Prisma.Decimal(normalized);
    if (decimal.lte(0)) return null;
    return decimal;
  } catch {
    return null;
  }
}

export async function getWallet(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    if (typeof userId !== "string" || !userId.trim()) {
      return failure(res, "INVALID_INPUT", "userId is required");
    }
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      return failure(res, "NOT_FOUND", "Wallet not found");
    }
    return success(res, wallet);
  } catch (err) {
    return failure(res, "INTERNAL_ERROR", "Failed to fetch wallet");
  }
}

export async function depositToWallet(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    const amount = parsePositiveDecimal(req.body?.amount);
    const idempotencyKey = extractIdempotencyKey(req);

    if (typeof userId !== "string" || !userId.trim()) {
      return failure(res, "INVALID_INPUT", "userId is required");
    }

    if (amount === null) {
      return failure(res, "INVALID_INPUT", "Valid amount is required");
    }

    if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
      return failure(res, "INVALID_INPUT", "idempotencyKey is required");
    }

    const replaySafeResponse = await depositWallet(userId, amount, idempotencyKey) as {
      success: true;
      data: unknown;
      error: null;
    };

    return success(res, replaySafeResponse.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to deposit funds";
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function withdrawFromWallet(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    const amount = parsePositiveDecimal(req.body?.amount);
    const idempotencyKey = extractIdempotencyKey(req);

    if (typeof userId !== "string" || !userId.trim()) {
      return failure(res, "INVALID_INPUT", "userId is required");
    }

    if (amount === null) {
      return failure(res, "INVALID_INPUT", "Valid amount is required");
    }

    if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
      return failure(res, "INVALID_INPUT", "idempotencyKey is required");
    }

    const replaySafeResponse = await withdrawWallet(userId, amount, idempotencyKey) as {
      success: true;
      data: unknown;
      error: null;
    };

    return success(res, replaySafeResponse.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to withdraw funds";
    await logError(err instanceof Error ? err : new Error(message), {
      endpoint: "/wallet/withdraw",
      userId: getRequestUserId(req) ?? null,
    });
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function getWalletTransactions(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);

    if (typeof userId !== "string" || !userId.trim()) {
      return failure(res, "INVALID_INPUT", "userId is required");
    }

    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.floor(limitRaw), 1), 50)
      : 20;

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        amount: true,
        createdAt: true,
        box: {
          select: {
            name: true,
          },
        },
      },
    });

    return success(res, transactions);
  } catch {
    return failure(res, "INTERNAL_ERROR", "Failed to fetch transactions");
  }
}

export async function getTransactions(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    if (!userId) return failure(res, "UNAUTHORIZED", "Unauthorized");
    // Pagination
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const skip = (page - 1) * pageSize;
    // Filters
    const type = req.query.type as string | undefined;
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;
    const where: any = { userId };
    if (type) where.type = type;
    if (dateFrom || dateTo) where.createdAt = {};
    if (dateFrom) where.createdAt.gte = dateFrom;
    if (dateTo) where.createdAt.lte = dateTo;
    // Query
    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          createdAt: true,
        },
      }),
    ]);
    // Unity-optimized response
    return success(res, {
      page,
      pageSize,
      total,
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount.toNumber(),
        balanceAfter: t.balanceAfter.toNumber(),
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return failure(res, "INTERNAL_ERROR", "Failed to fetch transactions");
  }
}