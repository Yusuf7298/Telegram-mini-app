import { useEffect, useState } from 'react';

export function OfflineBanner({ onRetry }: { onRetry?: () => void }) {
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }

    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="w-full bg-yellow-500 text-black px-4 py-2 text-center font-semibold">
      You are offline. Some features are unavailable.
      {onRetry ? (
        <button
          onClick={() => onRetry()}
          className="ml-3 rounded bg-black/10 px-2 py-1 text-sm font-medium"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
