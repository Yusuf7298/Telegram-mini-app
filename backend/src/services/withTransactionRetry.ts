import { PrismaClient } from "@prisma/client";

const DEFAULT_TRANSACTION_MAX_RETRIES = Number(process.env.PRISMA_TX_MAX_RETRIES ?? "2");
const DEFAULT_TRANSACTION_MAX_WAIT_MS = Number(process.env.PRISMA_TX_MAX_WAIT_MS ?? "5000");
const DEFAULT_TRANSACTION_TIMEOUT_MS = Number(process.env.PRISMA_TX_TIMEOUT_MS ?? "20000");
const DEFAULT_BACKOFF_MS = [75, 200] as const;

type TransactionErrorKind = "retryable" | "non-retryable";

function classifyTransactionError(error: unknown): TransactionErrorKind {
  const err = error as { code?: string; meta?: { code?: string }; message?: string };
  const code = err.code ?? err.meta?.code;
  const message = String(err.message ?? "");

  const retryableCodes = new Set([
    "P1001",
    "P1017",
    "P2024",
    "P2028",
    "P2034",
    "08000",
    "08003",
    "08006",
    "40P01",
    "40001",
    "53300",
    "57P01",
    "57014",
  ]);

  if (code && retryableCodes.has(code)) {
    return "retryable";
  }

  if (
    /transaction api error/i.test(message) ||
    /expired transaction/i.test(message) ||
    /unable to start a transaction in the given time/i.test(message) ||
    /timeout/i.test(message) ||
    /timed out/i.test(message) ||
    /ECONNRESET|EPIPE|ETIMEDOUT|ECONNREFUSED/i.test(message) ||
    /connection error|not queryable|terminating connection/i.test(message)
  ) {
    return "retryable";
  }

  return "non-retryable";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// maxRetries means retries after the initial attempt.
async function runWithTransactionRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  // optional metadata for logging or metrics; kept for compatibility
  _actionType?: string,
  _userId?: string
): Promise<T> {
  const safeRetries = Number.isFinite(maxRetries) ? Math.max(0, Math.floor(maxRetries)) : 0;

  for (let attempt = 0; attempt <= safeRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const shouldRetry = classifyTransactionError(error) === "retryable";
      const isLastAttempt = attempt >= safeRetries;
      if (!shouldRetry || isLastAttempt) {
        throw error;
      }

      const delayMs = DEFAULT_BACKOFF_MS[Math.min(attempt, DEFAULT_BACKOFF_MS.length - 1)] ?? 200;
      await sleep(delayMs);
    }
  }

  throw new Error("Transaction retry exhaustion");
}

import { dbCircuitBreaker } from "./circuitBreaker";
import { withPrismaRetry } from "./retryPrisma";
import { getCorrelationId } from "./requestContext.service";
import { logStructuredEvent } from "./logger";

export async function withTransactionRetry<T>(
  prisma: PrismaClient,
  fn: (tx: any) => Promise<T>,
  maxRetries = DEFAULT_TRANSACTION_MAX_RETRIES,
  actionType?: string,
  userId?: string
): Promise<T> {
  return runWithTransactionRetry(
    () =>
      withPrismaRetry(() =>
        dbCircuitBreaker.run(() =>
          prisma.$transaction(async (tx) => fn(tx), {
            maxWait: Number.isFinite(DEFAULT_TRANSACTION_MAX_WAIT_MS)
              ? DEFAULT_TRANSACTION_MAX_WAIT_MS
              : 5_000,
            timeout: Number.isFinite(DEFAULT_TRANSACTION_TIMEOUT_MS)
              ? DEFAULT_TRANSACTION_TIMEOUT_MS
              : 20_000,
          })
        )
      ),
    maxRetries,
    actionType,
    userId
  );
}
