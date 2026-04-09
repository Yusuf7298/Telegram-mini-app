import { motion } from 'framer-motion';

interface ProgressBarProps {
  value: number; // 0-100
}

export function ProgressBar({ value }: ProgressBarProps) {
  return (
    <div className="w-full h-3 bg-green-900 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-green-400 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.7, ease: 'easeInOut' }}
      />
    </div>
  );
}
