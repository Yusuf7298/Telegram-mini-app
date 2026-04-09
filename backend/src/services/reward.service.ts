import { assertDecimal } from '../utils/assertDecimal';
import { Prisma, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client-runtime-utils';
import { D, add, mul, eq, lte } from '../utils/money';
import { getBoxRewards } from './rewardCache';
import { logJackpotSkip, logError } from './logger';
import crypto from "crypto";

// RTP modifier integration

export async function generateRewardFromDB(
  boxId: string,
  tx: any
): Promise<{ amount: Decimal; category: string | null; label: string | null }> {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rewards = await getBoxRewards(boxId, tx);
    if (!rewards.length) {
      // Fallback: return ₦0 reward
      return {
        amount: new Decimal(0),
        category: 'No Win',
        label: 'No Reward',
      };
    }
    // Fetch RTP modifier
    const config = await tx['gameConfig']?.findUnique({ where: { id: 'global' } });
    const rtpModifier = config?.rtpModifier ?? 1;
    // Adjust jackpot weights only
    const adjustedRewards = rewards.map(r =>
      r.isJackpot ? { ...r, weight: Math.round(r.weight * rtpModifier) } : r
    );
    const totalWeight = adjustedRewards.reduce(
        (sum, r) => add(sum, D(r.weight)),
        D(0)
    );
    if (totalWeight.lte(0)) {
      return {
        amount: D(0),
        category: 'No Win',
        label: 'No Reward',
      };
    }
    let rand = crypto.randomInt(0, totalWeight.toNumber());
    let selected = adjustedRewards[0];
    for (const reward of adjustedRewards) {
      if (rand < reward.weight) {
        selected = reward;
        break;
      }
      rand -= reward.weight;
    }
    // Jackpot safety logic
    if (selected.isJackpot) {
      if (
        typeof selected.maxWinners === 'number' &&
        selected.currentWinners >= selected.maxWinners
      ) {
        await logJackpotSkip({
          rewardId: selected.id,
          currentWinners: selected.currentWinners,
          maxWinners: selected.maxWinners,
          boxId,
          timestamp: new Date().toISOString(),
        });
        continue;
      }
      const updateResult = await tx.boxReward.updateMany({
        where: {
          id: selected.id,
          currentWinners: { lt: selected.maxWinners ?? 0 },
        },
        data: { currentWinners: { increment: 1 } },
      });
      if (updateResult.count === 0) {
        await logJackpotSkip({
          rewardId: selected.id,
          currentWinners: selected.currentWinners,
          maxWinners: selected.maxWinners,
          boxId,
          race: true,
          timestamp: new Date().toISOString(),
        });
        continue;
      }
    }
    assertDecimal(selected.reward, 'reward');
    return {
      amount: selected.reward,
      category: selected.category ?? null,
      label: selected.label ?? null,
    };
  }
  await logError(new Error('Failed to select a valid reward after multiple attempts'), { boxId });
  assertDecimal(new Decimal(0), 'reward');
  return {
    amount: new Decimal(0),
    category: 'No Win',
    label: 'No Reward',
  };
}
