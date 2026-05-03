import { useRef, useState } from 'react';

type RunOptions = {
  cooldownMs?: number; // brief debounce window allowed after completion
};

export function useActionLock() {
  const running = useRef(new Map<string, Promise<any>>());
  const cooldowns = useRef(new Map<string, number>());
  const [lockedCount, setLockedCount] = useState(0);

  function isLocked(key?: string) {
    if (!key) return lockedCount > 0;
    const p = running.current.get(key);
    if (p) return true;
    const expires = cooldowns.current.get(key) ?? 0;
    return Date.now() < expires;
  }

  async function run<T = any>(key: string | undefined, fn: () => Promise<T>, opts: RunOptions = {}) {
    const k = key ?? '__global__';

    // If already running for this key, return the existing promise (dedupe)
    const existing = running.current.get(k);
    if (existing) return existing as Promise<T>;

    // If in cooldown period, avoid re-running; return rejected promise to indicate blocked
    const expires = cooldowns.current.get(k) ?? 0;
    if (Date.now() < expires) {
      return Promise.reject(new Error('action_blocked')) as Promise<T>;
    }

    const p = (async () => {
      try {
        setLockedCount((c) => c + 1);
        const result = await fn();
        return result;
      } finally {
        // apply cooldown if requested
        if (opts.cooldownMs && opts.cooldownMs > 0) {
          cooldowns.current.set(k, Date.now() + opts.cooldownMs);
        }
        running.current.delete(k);
        setLockedCount((c) => Math.max(0, c - 1));
      }
    })();

    running.current.set(k, p as Promise<any>);
    return p as Promise<T>;
  }

  return { isLocked, run, lockedCount } as const;
}
