"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Crown } from "lucide-react";

type BigWinBannerProps = {
  amount: number | null;
};

export function BigWinBanner({ amount }: BigWinBannerProps) {
  return (
    <AnimatePresence>
      {typeof amount === "number" ? (
        <motion.div
          key="big-win-banner"
          initial={{ opacity: 0, y: -20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.96 }}
          transition={{ duration: 0.28 }}
          className="pointer-events-none fixed left-1/2 top-4 z-[60] w-[min(94vw,460px)] -translate-x-1/2"
        >
          <div className="big-win-banner-glow rounded-2xl border border-yellow-300/45 bg-gradient-to-r from-[#6d4a00] via-[#a87400] to-[#f4c245] px-4 py-3 text-black shadow-[0_16px_60px_rgba(255,193,7,0.25)]">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-black/20">
                <Crown className="h-5 w-5 text-yellow-100" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-100/90">Big Win</div>
                <div className="truncate text-lg font-black">You just won ₦{amount.toLocaleString()}!</div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
