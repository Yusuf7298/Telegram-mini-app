import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface BoxOpenAnimationProps {
  reward: string | number;
  bigWin?: boolean;
  onComplete: () => void;
}

export default function BoxOpenAnimation({ reward, bigWin, onComplete }: BoxOpenAnimationProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Step 0: Shake, Step 1: Lid open, Step 2: Flash, Step 3: Confetti (if bigWin)
    const timers = [
      setTimeout(() => setStep(1), 700), // shake
      setTimeout(() => setStep(2), 1200), // lid open
      setTimeout(() => setStep(3), 1700), // flash
      setTimeout(() => { onComplete(); }, bigWin ? 2700 : 2200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [bigWin, onComplete]);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[180px]">
      {/* Box with lid */}
      <motion.div
        className="relative z-10"
        animate={step === 0 ? { x: [0, -10, 10, -10, 10, 0] } : { x: 0 }}
        transition={{ duration: 0.7, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }}
      >
        {/* Lid */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 top-0"
          style={{ width: 80, height: 30 }}
          animate={step >= 1 ? { rotate: -60, y: -40 } : { rotate: 0, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Image src="/box-lid.png" alt="Lid" width={80} height={30} />
        </motion.div>
        {/* Box base */}
        <Image src="/background.png" alt="Box" width={80} height={80} className="relative z-10" />
      </motion.div>
      {/* Flash reward reveal */}
      <AnimatePresence>
        {step >= 2 && (
          <motion.div
            key="reward"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
          >
            <div className="text-2xl font-bold text-yellow-400 drop-shadow-lg bg-black/60 rounded-xl px-6 py-3 border-4 border-yellow-300 animate-pulse">
              {reward}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Confetti for big win */}
      <AnimatePresence>
        {bigWin && step >= 3 && (
          <motion.div
            key="confetti"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 pointer-events-none"
          >
            <ConfettiBurst />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ConfettiBurst generates random confetti positions/delays only once per mount
function ConfettiBurst() {
  const [confetti] = useState<Array<{ x: number; y: number; delay: number }>>(
    () =>
      Array.from({ length: 30 }, () => ({
        x: Math.random() * 160 - 80,
        y: Math.random() * 120 - 60,
        delay: 0.1 * Math.random(),
      }))
  );

  return (
    <div className="w-full h-full flex flex-wrap">
      {confetti.map((c, i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-pink-400 absolute"
          initial={{ x: 40, y: 40, opacity: 1 }}
          animate={{ x: c.x, y: c.y, opacity: 0 }}
          transition={{ duration: 1.2, delay: c.delay }}
        />
      ))}
    </div>
  );
}
