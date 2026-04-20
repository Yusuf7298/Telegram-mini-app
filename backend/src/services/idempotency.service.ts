// NEW: IdempotencyKey service
import { prisma } from "../config/db";
import { IdempotencyKey, Prisma } from "@prisma/client";
import { logStructuredEvent } from "./logger";

const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const IDEMPOTENCY_PENDING_WAIT_DEFAULT_MS = 8000;
const IDEMPOTENCY_PENDING_POLL_MS = 200;
const IDEMPOTENCY_STALE_PENDING_MS = 5000;

export type IdempotencyStoredResponse = {
  success: true;
  data: any;
  error: null;
};

function toDecimalString(value: any): string {
  try {
    return new Prisma.Decimal(value ?? 0).toString();
  } catch {
    return new Prisma.Decimal(0).toString();
  }
}

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

function isSuccessEnvelope(response: any): response is IdempotencyStoredResponse {
  return Boolean(
    response &&
      typeof response === "object" &&
      response.success === true &&
      Object.prototype.hasOwnProperty.call(response, "data") &&
      response.error === null
  );
}

function toSuccessEnvelope(response: any): IdempotencyStoredResponse {
  if (isSuccessEnvelope(response)) {
    return {
      success: true,
      data: toSerializable(response.data),
      error: null,
    };
  }

  return {
    success: true,
    data: toSerializable(response),
    error: null,
  };
}

function normalizeIdempotencyResponse(response: any, metadata?: Record<string, any>): IdempotencyStoredResponse {
  const envelope = toSuccessEnvelope(response);
  if (!metadata || Object.keys(metadata).length === 0) {
    return envelope;
  }

  const data = envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)
    ? { ...envelope.data }
    : { value: envelope.data };

  return {
    success: true,
    data: {
      ...data,
      metadata: {
        ...(typeof data.metadata === "object" && data.metadata ? data.metadata : {}),
        ...toSerializable(metadata),
      },
    },
    error: null,
  };
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

  await logStructuredEvent("idempotency_operation", {
    userId,
    action: "idempotency_create_attempt",
    amount: "0",
    idempotencyKey: id,
    timestamp: new Date().toISOString(),
  });

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

  await logStructuredEvent("idempotency_created", {
    userId,
    endpoint: action,
    idempotencyKey: id,
    action,
    timestamp: new Date().toISOString(),
  });

  return client.idempotencyKey.findUnique({ where: { id } });
}

export async function completeIdempotencyKey({
  id,
  userId,
  response,
  metadata,
  tx,
}: {
  id: string;
  userId: string;
  response: any;
  metadata?: Record<string, any>;
  tx?: Prisma.TransactionClient;
}) {
  const client = tx || prisma;
  const existingKey = await client.idempotencyKey.findUnique({ where: { id } });
  if (!existingKey) {
    throw new Error("Idempotency key not found");
  }

  if (existingKey.userId !== userId) {
    throw new Error("Idempotency key user mismatch");
  }

  const rewardAmount = extractRewardAmount(response);
  const normalizedResponse = normalizeIdempotencyResponse(response, metadata);

  await logStructuredEvent("idempotency_operation", {
    userId,
    action: "idempotency_complete_before",
    reward: rewardAmount.toString(),
    idempotencyKey: id,
    timestamp: new Date().toISOString(),
  });

  await client.idempotencyKey.update({
    where: { id },
    data: {
      status: "COMPLETED",
      rewardAmount,
      response: normalizedResponse,
      expiresAt: new Date(),
    },
  });

  await logStructuredEvent("idempotency_operation", {
    userId,
    action: "idempotency_complete_after",
    reward: rewardAmount.toString(),
    idempotencyKey: id,
    timestamp: new Date().toISOString(),
  });

  return normalizedResponse;
}

export async function checkIdempotencyKey({
  id,
  userId,
  tx,
  waitForCompletionMs = 0,
  pollIntervalMs = IDEMPOTENCY_PENDING_POLL_MS,
  pendingStaleAfterMs = IDEMPOTENCY_STALE_PENDING_MS,
  recoverPending,
}: {
  id: string;
  userId: string;
  tx?: Prisma.TransactionClient;
  waitForCompletionMs?: number;
  pollIntervalMs?: number;
  pendingStaleAfterMs?: number;
  recoverPending?: (params: {
    id: string;
    userId: string;
    key: IdempotencyKey;
    tx?: Prisma.TransactionClient;
  }) => Promise<any | null>;
}) {
  const client = tx || prisma;
  const maxWaitMs = Math.max(0, waitForCompletionMs || 0);
  const maxDeadline = Date.now() + (maxWaitMs || IDEMPOTENCY_PENDING_WAIT_DEFAULT_MS);
  let recoveryAttempted = false;

  const loadKey = async () => {
    const key = await client.idempotencyKey.findUnique({ where: { id } });
    if (!key) return null;
    if (key.userId !== userId) throw new Error("Idempotency key user mismatch");
    if (key.status === "PENDING" && key.expiresAt && key.expiresAt < new Date()) {
      throw new Error("Idempotency key expired");
    }

    if (key.status === "COMPLETED") {
      const replayReward = toDecimalString((key.response as Record<string, any> | null)?.data?.reward ?? key.rewardAmount);

      await logStructuredEvent("idempotency_hit", {
        userId,
        endpoint: key.action,
        idempotencyKey: id,
        action: key.action,
        timestamp: new Date().toISOString(),
      });

      await logStructuredEvent("idempotency_operation", {
        userId,
        action: "idempotency_replay",
        reward: replayReward,
        idempotencyKey: id,
        timestamp: new Date().toISOString(),
      });

      return {
        ...key,
        response: normalizeIdempotencyResponse(key.response),
      };
    }

    return key;
  };

  while (true) {
    const key = await loadKey();
    if (!key) {
      return null;
    }

    if (key.status !== "PENDING") {
      return key;
    }

    if (!maxWaitMs) {
      return key;
    }

    const ageMs = Date.now() - key.createdAt.getTime();
    if (!recoveryAttempted && recoverPending && ageMs >= pendingStaleAfterMs) {
      recoveryAttempted = true;

      const recovered = await recoverPending({ id, userId, key, tx });
      if (recovered) {
        try {
          await completeIdempotencyKey({
            id,
            userId,
            response: recovered,
            metadata: {
              action: key.action,
              recoveredFromPending: true,
            },
            tx,
          });
        } catch {
          // Another request may complete the key concurrently; proceed to final read.
        }

        const completed = await loadKey();
        if (completed && completed.status === "COMPLETED") {
          return completed;
        }
      }
    }

    if (Date.now() >= maxDeadline) {
      return key;
    }

    const sleepMs = Math.max(10, pollIntervalMs);
    await new Promise((resolve) => setTimeout(resolve, sleepMs));
  }
}
