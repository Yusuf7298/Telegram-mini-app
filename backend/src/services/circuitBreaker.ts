// Simple in-memory circuit breaker for DB reliability
// Usage: wrap DB calls with circuitBreaker.run(async () => ...)

export class CircuitBreaker {
  private failureCount = 0;
  private lastFailure = 0;
  private openUntil = 0;
  private readonly failureThreshold: number;
  private readonly openSeconds: number;

  constructor(failureThreshold = 5, openSeconds = 30) {
    this.failureThreshold = failureThreshold;
    this.openSeconds = openSeconds;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    if (this.openUntil > now) {
      throw new Error(`Circuit breaker open: DB unavailable until ${new Date(this.openUntil).toISOString()}`);
    }
    try {
      const result = await fn();
      this.failureCount = 0;
      return result;
    } catch (err) {
      this.failureCount++;
      this.lastFailure = now;
      if (this.failureCount >= this.failureThreshold) {
        this.openUntil = now + this.openSeconds * 1000;
      }
      throw err;
    }
  }
}

export const dbCircuitBreaker = new CircuitBreaker(5, 30);
