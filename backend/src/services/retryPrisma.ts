const DEFAULT_RETRY_DELAYS_MS = [100, 300, 700, 1500] as const;
const MAX_JITTER_MS = 120;

function parseDelayPattern(raw: string | undefined): number[] {
  if (!raw) {
    return [...DEFAULT_RETRY_DELAYS_MS];
  }

  const parsed = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.floor(value));

  return parsed.length > 0 ? parsed : [...DEFAULT_RETRY_DELAYS_MS];
}

export const RETRY_DELAYS_MS = parseDelayPattern(process.env.PRISMA_RETRY_DELAYS_MS);
export const RETRY_MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryablePrismaError(error: unknown): boolean {
  const err = error as { code?: string; message?: string; meta?: { code?: string } };
  const code = err.code ?? err.meta?.code;
  const message = String(err.message ?? "");

  const connectionErrorCodes = new Set(["P1001", "P1017", "P2024", "08000", "08006", "08003", "57P01", "57P02"]);
  if (code && connectionErrorCodes.has(code)) {
    return true;
  }

  if (code === "P2028" || code === "P2034") {
    return true;
  }

  return (
    /timeout/i.test(message) ||
    /timed out/i.test(message) ||
    /timeout exceeded/i.test(message) ||
    /connection terminated unexpectedly/i.test(message) ||
    /connection/i.test(message) ||
    /econnreset|econnrefused|ehostunreach|etimedout/i.test(message) ||
    /not queryable|terminating connection|server closed the connection/i.test(message)
  );
}

export async function retryPrisma<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      const canRetry = isRetryablePrismaError(error);
      if (!canRetry || attempt >= RETRY_DELAYS_MS.length) {
        throw error;
      }

      const jitterMs = Math.floor(Math.random() * MAX_JITTER_MS);
      const waitMs = RETRY_DELAYS_MS[attempt] + jitterMs;
      attempt += 1;
      await sleep(waitMs);
    }
  }
}

export async function withPrismaRetry<T>(fn: () => Promise<T>): Promise<T> {
	return retryPrisma(fn);
}

export async function retryCriticalWrite<T>(fn: () => Promise<T>): Promise<T> {
  return retryPrisma(fn);
}
