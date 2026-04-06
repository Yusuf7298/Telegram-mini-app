// System-wide financial integrity verification
export async function verifySystemIntegrity() {
  const issues: string[] = [];
  // 1. Sum of all wallet balances == sum of all transaction amounts
  const wallets = await prisma.wallet.findMany();
  const transactions = await prisma.transaction.findMany();
  const walletSum = wallets.reduce((sum, w) => sum.plus(w.cashBalance).plus(w.bonusBalance), D(0));
  const txSum = transactions.reduce((sum, t) => sum.plus(t.amount), D(0));
  if (!walletSum.equals(txSum)) {
    issues.push(`Wallet sum (${walletSum.toString()}) != Transaction sum (${txSum.toString()})`);
  }

  // 2. totalIn / totalOut consistency
  const stats = await prisma.systemStats.findUnique({ where: { id: 'global' } });
  if (stats) {
    const totalIn = D(stats.totalIn);
    const totalOut = D(stats.totalOut);
    const txIn = transactions.filter(t => t.amount.gt(0)).reduce((sum, t) => sum.plus(t.amount), D(0));
    const txOut = transactions.filter(t => t.amount.lt(0)).reduce((sum, t) => sum.plus(t.amount.abs()), D(0));
    if (!totalIn.equals(txIn)) {
      issues.push(`Stats totalIn (${totalIn.toString()}) != sum of positive transactions (${txIn.toString()})`);
    }
    if (!totalOut.equals(txOut)) {
      issues.push(`Stats totalOut (${totalOut.toString()}) != sum of negative transactions (${txOut.toString()})`);
    }
  } else {
    issues.push('System stats not found');
  }

  // 3. No negative balances exist
  const negativeWallets = wallets.filter(w => w.cashBalance.lt(0) || w.bonusBalance.lt(0));
  if (negativeWallets.length > 0) {
    issues.push(`Negative wallet balances found for userIds: ${negativeWallets.map(w => w.userId).join(', ')}`);
  }

  // 4. RTP is within expected range (e.g., 40% - 99.9%)
  if (stats) {
    const rtp = calculateRTP(stats.totalIn, stats.totalOut);
    if (rtp.lt(40) || rtp.gt(99.9)) {
      issues.push(`RTP out of range: ${rtp.toString()}%`);
    }
  }

  return { valid: issues.length === 0, issues };
}

import { PrismaClient } from '@prisma/client';
import { D, div, gt, mul, lte } from '../utils/money';
const prisma = new PrismaClient();
// Centralized RTP calculation
export function calculateRTP(totalIn: any, totalOut: any) {
  totalIn = D(totalIn);
  totalOut = D(totalOut);
  if (lte(totalIn, D(0))) return D(0);
  return div(totalOut, totalIn).mul(D(100)).toDecimalPlaces(2);
}

// Sanity guard: totalOut must not exceed totalIn * 2
function assertStatsSanity(totalIn: any, totalOut: any) {
  totalIn = D(totalIn);
  totalOut = D(totalOut);
  if (totalOut.gt(totalIn.mul(D(2)))) {
    throw new Error('Stats integrity error: totalOut exceeds twice totalIn');
  }
}

// Remove all standalone stats updates. All stats must be updated inside the main transactional flow (e.g., in game.service.ts)

  const stats = await prisma.systemStats.findUnique({ where: { id: 'global' } });
  const totalIn = stats?.totalIn ? D(stats.totalIn) : D(0);
  const totalOut = stats?.totalOut ? D(stats.totalOut) : D(0);
  const totalBoxesOpened = stats?.totalBoxesOpened ?? 0;
  const jackpotWins = stats?.jackpotWins ?? 0;
  assertStatsSanity(totalIn, totalOut);
  const rtp = calculateRTP(totalIn, totalOut);
  return {
    totalIn: totalIn.toString(),
    totalOut: totalOut.toString(),
    rtp: rtp.toString(),
    totalBoxesOpened,
    jackpotWins,
  };
}

// Integrity check: recompute RTP from DB and compare with stored value
export async function checkStatsIntegrity() {
  const stats = await prisma.systemStats.findUnique({ where: { id: 'global' } });
  if (!stats) return;
  const totalIn = D(stats.totalIn);
  const totalOut = D(stats.totalOut);
  const computedRTP = calculateRTP(totalIn, totalOut);
  // If you store RTP in DB, compare here. For now, just log
  if (stats.rtp && !D(stats.rtp).equals(computedRTP)) {
    console.error('[INTEGRITY] RTP mismatch:', { stored: stats.rtp, computed: computedRTP.toString() });
  }
  assertStatsSanity(totalIn, totalOut);
}
}
