import React from 'react';

export function Skeleton({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse bg-gray-300/20 rounded-md ${className}`}
      {...props}
    />
  );
}
