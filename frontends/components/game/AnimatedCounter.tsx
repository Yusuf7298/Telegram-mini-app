"use client";

import { useEffect, useRef, useState } from "react";

type AnimatedCounterProps = {
  value: number;
  durationMs?: number;
  format?: (value: number) => string;
  className?: string;
};

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function AnimatedCounter({
  value,
  durationMs = 700,
  format = (next) => next.toLocaleString(),
  className,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValueRef = useRef(value);

  useEffect(() => {
    const from = previousValueRef.current;
    const to = value;

    if (from === to) {
      setDisplayValue(to);
      return;
    }

    let rafId: number | null = null;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / durationMs, 1);
      const eased = easeOutCubic(progress);
      const nextValue = Math.round(from + (to - from) * eased);
      setDisplayValue(nextValue);

      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }

      previousValueRef.current = to;
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [durationMs, value]);

  return <span className={className}>{format(displayValue)}</span>;
}
