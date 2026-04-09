import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-gray-300 text-sm mb-1">{label}</label>}
      <input
        ref={ref}
        className={cn(
          'w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition bg-[#19233A] text-white placeholder-gray-500',
          className
        )}
        {...props}
      />
      {error && <div className="text-red-400 text-xs mt-1">{error}</div>}
    </div>
  )
);
Input.displayName = 'Input';
