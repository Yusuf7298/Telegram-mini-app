type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

type RetryableErrorLike = {
  status?: number;
  message?: string;
  code?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  const err = (error ?? {}) as RetryableErrorLike;
  const status = typeof err.status === "number" ? err.status : undefined;
  const message = String(err.message ?? "").toLowerCase();
  const code = String(err.code ?? "").toLowerCase();

  if (status === 408 || status === 409 || status === 425 || status === 429) {
    return true;
  }

  if (typeof status === "number" && status >= 500) {
    return true;
  }

  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("econn") ||
    message.includes("temporar") ||
    code.includes("econn") ||
    code.includes("network")
  );
}

export async function withRequestRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 300;
  const maxDelayMs = options.maxDelayMs ?? 2500;

  let attempt = 0;
  let delayMs = baseDelayMs;

  while (true) {
    attempt += 1;
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableError(error)) {
        throw error;
      }

      const jitterMs = Math.floor(Math.random() * 120);
      await sleep(delayMs + jitterMs);
      delayMs = Math.min(maxDelayMs, delayMs * 2);
    }
  }
}
