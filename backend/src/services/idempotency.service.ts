// NEW: IdempotencyKey service
import { prisma } from "../config/db";
import { Prisma } from "@prisma/client";

const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

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
  return client.idempotencyKey.create({
    data: { id, userId, action, status: "PENDING", expiresAt },
  });
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
  await client.idempotencyKey.update({
    where: { id },
    data: { status: "COMPLETED", rewardAmount: response, expiresAt: new Date() },
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
  if (key.status === "COMPLETED") throw new Error("Idempotency key already completed");
  if (key.status === "PENDING" && key.expiresAt && key.expiresAt < new Date()) throw new Error("Idempotency key expired");
  return key;
}
