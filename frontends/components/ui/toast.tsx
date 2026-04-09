import { toast as shadcnToast } from "sonner";

export function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  shadcnToast(message, {
    className:
      type === 'success'
        ? 'bg-green-500 text-white'
        : type === 'error'
        ? 'bg-red-500 text-white'
        : 'bg-gray-800 text-white',
    duration: 3000,
  });
}
