import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface BoxAnimationProps {
  onReveal: () => void;
}

export function BoxAnimation({ onReveal }: BoxAnimationProps) {
  const [opened, setOpened] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-[220px]">
      <AnimatePresence>
        {!opened && (
          <motion.div
            key="box"
            className="relative w-28 h-28 flex items-end justify-center"
            initial={{ rotate: 0 }}
            animate={{ rotate: [0, -10, 10, -8, 8, 0] }}
            transition={{ duration: 0.7, repeat: 2 }}
            onAnimationComplete={() => setOpened(true)}
          >
            {/* Box base */}
            <div className="absolute bottom-0 w-28 h-20 bg-blue-500 rounded-b-xl z-10" />
            {/* Box lid */}
            <motion.div
              className="absolute top-0 w-28 h-10 bg-blue-400 rounded-t-xl z-20"
              animate={opened ? { rotateX: 70, y: -30 } : { rotateX: 0, y: 0 }}
              transition={{ duration: 0.5 }}
            />
            {/* Glow */}
            {opened && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center z-30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, scale: [1, 1.2, 1] }}
                transition={{ duration: 0.7, repeat: 1 }}
              >
                <div className="w-20 h-20 rounded-full bg-yellow-300/60 blur-2xl" />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {opened && (
        <motion.div
          key="reveal"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <Button onClick={onReveal} className="mt-6">Reveal Reward</Button>
        </motion.div>
      )}
    </div>
  );
}

import { Button } from '@/components/ui/Button';
