import { ReactNode } from 'react';

export function PageWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <div className="max-w-md mx-auto px-3 pt-3">{children}</div>
    </div>
  );
}
