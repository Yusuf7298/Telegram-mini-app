import { useEffect, useState } from 'react';

export function useCountdown(targetTime: number) {
  const [now, setNow] = useState(Date.now());
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (isFinished) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isFinished]);

  const diff = Math.max(0, targetTime - now);
  const minutes = Math.floor(diff / 1000 / 60);
  const seconds = Math.floor((diff / 1000) % 60);

  useEffect(() => {
    if (diff <= 0 && !isFinished) setIsFinished(true);
  }, [diff, isFinished]);

  return { minutes, seconds, isFinished };
}
