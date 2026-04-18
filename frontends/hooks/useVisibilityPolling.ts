"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PollingCallback = () => void | Promise<void>;

export function useVisibilityPolling(callback: PollingCallback, intervalMs: number) {
  const callbackRef = useRef(callback);
  const intervalRef = useRef<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsRunning(false);
    }
  }, []);

  const start = useCallback(() => {
    if (document.visibilityState !== "visible" || intervalRef.current !== null) {
      return;
    }

    intervalRef.current = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void callbackRef.current();
      }
    }, intervalMs);
    setIsRunning(true);
  }, [intervalMs]);

  const restart = useCallback(() => {
    stop();
    start();
  }, [start, stop]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void callbackRef.current();
        restart();
      } else {
        stop();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (document.visibilityState === "visible") {
      void callbackRef.current();
      start();
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stop();
    };
  }, [restart, start, stop]);

  return { start, stop, isRunning };
}
