import { Prisma, PrismaClient } from '@prisma/client';

type BoxReward = Prisma.BoxRewardGetPayload<{}>;

const boxRewardCache = new Map<string, { rewards: BoxReward[]; expires: number }>();
const CACHE_TTL_MS = 60_000;

export async function getBoxRewards(
  boxId: string,
  tx: Prisma.TransactionClient
): Promise<BoxReward[]> {
  const now = Date.now();
  const cached = boxRewardCache.get(boxId);
  if (cached && cached.expires > now) {
    return cached.rewards;
  }
  const rewards = await tx.boxReward.findMany({ where: { boxId } });
  boxRewardCache.set(boxId, { rewards, expires: now + CACHE_TTL_MS });
  return rewards;
}
