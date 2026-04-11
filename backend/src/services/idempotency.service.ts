// NEW: IdempotencyKey service
import { prisma } from "../config/db";
import { Prisma } from "@prisma/client";

const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

function toSerializable(value: any): any {
  if (value instanceof Prisma.Decimal) {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(toSerializable);
  }
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = toSerializable(val);
    }
    return out;
  }
  return value;
}

function extractRewardAmount(response: any): Prisma.Decimal {
  if (response instanceof Prisma.Decimal) {
    return response;
  }

  if (typeof response === "number" || typeof response === "string") {
    try {
      return new Prisma.Decimal(response);
    } catch {
      return new Prisma.Decimal(0);
    }
  }

  if (response && typeof response === "object") {
    const rewardLike = (response as Record<string, any>).reward ?? (response as Record<string, any>).amount;
    if (rewardLike !== undefined) {
      try {
        return new Prisma.Decimal(rewardLike);
      } catch {
        return new Prisma.Decimal(0);
      }
    }
  }

  return new Prisma.Decimal(0);
}

export async function createIdempotencyKey({
  id,
  userId,
  action,
  tx,
}: {
  id: string;
  userId: string;
  action: string;
  tx?: Prisma.TransactionClient;
}) {
  const client = tx || prisma;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_MS);
  const insertResult = await client.idempotencyKey.createMany({
    data: [
      {
        id,
        userId,
        boxId: "pending",
        rewardAmount: new Prisma.Decimal(0),
        action,
        status: "PENDING",
        expiresAt,
      },
    ],
    skipDuplicates: true,
  });

  if (insertResult.count === 0) {
    throw new Error("Idempotency key already exists");
  }

  return client.idempotencyKey.findUnique({ where: { id } });
}

export async function completeIdempotencyKey({
  id,
  userId,
  response,
  tx,
}: {
  id: string;
  userId: string;
  response: any;
  tx?: Prisma.TransactionClient;
}) {
  const client = tx || prisma;
  const rewardAmount = extractRewardAmount(response);
  const serializableResponse = toSerializable(response);
  await client.idempotencyKey.update({
    where: { id },
    data: {
      status: "COMPLETED",
      rewardAmount,
      response: serializableResponse,
      expiresAt: new Date(),
    },
  });
}

export async function checkIdempotencyKey({
  id,
  userId,
  tx,
}: {
  id: string;
  userId: string;
  tx?: Prisma.TransactionClient;
}) {
  const client = tx || prisma;
  const key = await client.idempotencyKey.findUnique({ where: { id } });
  if (!key) return null;
  if (key.userId !== userId) throw new Error("Idempotency key user mismatch");
  if (key.status === "PENDING" && key.expiresAt && key.expiresAt < new Date()) throw new Error("Idempotency key expired");
  return key;
}
