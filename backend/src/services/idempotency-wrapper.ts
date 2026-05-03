import { Prisma } from "@prisma/client";
import { createIdempotencyKey, checkIdempotencyKey, completeIdempotencyKey } from "./idempotency.service";

type Tx = Prisma.TransactionClient;

export async function runIdempotentTx<T>(opts: {
  tx: Tx;
  id: string;
  userId: string;
  action: string;
  processor: (tx: Tx) => Promise<T>;
  recoverPending?: () => Promise<T | null>;
}) {
  const { tx, id, userId, action, processor, recoverPending } = opts;

  // Check existing key
  const existing = await checkIdempotencyKey({ id, userId, tx });
  if (existing?.status === "COMPLETED") {
    // Return cached response if present
    if (existing.response && typeof existing.response === "object" && "data" in existing.response) {
      return (existing.response as any).data as T;
    }
    throw new Error("Idempotency cache hit but no stored response");
  }
  if (existing?.status === "PENDING") {
    if (recoverPending) {
      const recovered = await recoverPending();
      if (recovered) return recovered;
    }
    throw new Error("Idempotent request is still processing");
  }

  // Try to create a new idempotency key (fast, may throw if duplicate)
  try {
    await createIdempotencyKey({ id, userId, action, tx });
  } catch (err) {
    // Another process created it concurrently — check again
    const duplicate = await checkIdempotencyKey({ id, userId, tx });
    if (duplicate?.status === "COMPLETED") {
      if (duplicate.response && typeof duplicate.response === "object" && "data" in duplicate.response) {
        return (duplicate.response as any).data as T;
      }
      throw new Error("Idempotency duplicate found but no cached response");
    }
    if (duplicate?.status === "PENDING") {
      if (recoverPending) {
        const recovered = await recoverPending();
        if (recovered) return recovered;
      }
      throw new Error("Idempotent request is still processing");
    }
    throw err;
  }

  // Process the action within the same transaction (caller ensures tx scope)
  const result = await processor(tx);

  // Store response atomically
  await completeIdempotencyKey({ id, userId, response: result, tx });

  return result;
}

export default runIdempotentTx;
