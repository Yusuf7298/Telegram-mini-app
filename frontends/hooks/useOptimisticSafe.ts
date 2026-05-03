import { useState } from 'react';

// Only use for safe optimistic UI (not wallet or rewards)
export function useOptimisticSafe<T>(initial: T) {
  // Runtime guard: throw if used for forbidden keys
  const forbiddenKeys = ['balance', 'reward', 'referral', 'withdraw', 'wallet', 'status'];
  if (typeof initial === 'object' && initial !== null) {
    for (const key of Object.keys(initial)) {
      if (forbiddenKeys.some(fk => key.toLowerCase().includes(fk))) {
        throw new Error(
          `useOptimisticSafe is forbidden for financial or referral state: found key '${key}'.\n` +
          'Do not use for wallet, rewards, referral activation, withdraw, or any financial state.'
        );
      }
    }
  }
  const [state, setState] = useState(initial);
  const [pending, setPending] = useState(false);

  const run = async (fn: () => Promise<T>) => {
    // Also check at runtime for forbidden optimistic updates
    if (typeof state === 'object' && state !== null) {
      for (const key of Object.keys(state)) {
        if (forbiddenKeys.some(fk => key.toLowerCase().includes(fk))) {
          throw new Error(
            `Optimistic update attempted on forbidden key '${key}'.\n` +
            'Do not use useOptimisticSafe for wallet, rewards, referral activation, withdraw, or any financial state.'
          );
        }
      }
    }
    setPending(true);
    try {
      const optimistic = fn();
      // Only update state optimistically for safe flows
      optimistic.then(setState).catch(() => {});
      return optimistic;
    } finally {
      setPending(false);
    }
  };

  return { state, setState, pending, run };
}
