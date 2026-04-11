import { prisma } from '../config/db';
import { validateBoxRewardInput } from './validation';
import { logAdminAction } from './adminAuditLog.service';

// Helper to compute expected value of rewards
function computeExpectedValue(rewards: { reward: any, weight: any }[], boxPrice: number) {
  const totalWeight = rewards.reduce((sum, r) => sum + Number(r.weight), 0);
  if (totalWeight === 0) return 0;
  let expected = 0;
  for (const r of rewards) {
    expected += (Number(r.reward) * Number(r.weight)) / totalWeight;
  }
  return expected;
}
export async function createBoxReward(data: any, tx: any) {
  validateBoxRewardInput(data);
  // Fetch all rewards for this box (including the new one)
  const boxId = data.boxId;
  const box = await tx.box.findUnique({ where: { id: boxId } });
  if (!box) throw new Error('Box not found');
  const rewards = await tx.boxReward.findMany({ where: { boxId } });
  const allRewards = [...rewards, { reward: data.reward, weight: data.weight }];
  const expected = computeExpectedValue(allRewards, Number(box.price));
  if (expected > Number(box.price) * 0.75) {
    throw new Error(`Expected value (₦${expected.toFixed(2)}) exceeds 75% of box price (₦${box.price})`);
  }
  const reward = await tx.boxReward.create({ data });
  await logAdminAction('create', 'BoxReward', reward.id, null, reward, tx);
  return filterBoxReward(reward);
}

export async function updateBoxReward(id: string, data: any, tx: any) {
  validateBoxRewardInput(data);
  // Fetch all rewards for this box (with this one updated)
  const oldReward = await tx.boxReward.findUnique({ where: { id } });
  if (!oldReward) throw new Error('Reward not found');
  const boxId = oldReward.boxId;
  const box = await tx.box.findUnique({ where: { id: boxId } });
  if (!box) throw new Error('Box not found');
  const rewards = await tx.boxReward.findMany({ where: { boxId } });
  const updatedRewards = rewards.map((r: any) => (r.id === id ? { ...r, ...data } : r));
  const expected = computeExpectedValue(updatedRewards, Number(box.price));
  if (expected > Number(box.price) * 0.75) {
    throw new Error(`Expected value (₦${expected.toFixed(2)}) exceeds 75% of box price (₦${box.price})`);
  }
  const reward = await tx.boxReward.update({ where: { id }, data });
  await logAdminAction('update', 'BoxReward', id, oldReward, reward, tx);
  return filterBoxReward(reward);
}

export async function deleteBoxReward(id: string, tx: any) {
  const reward = await tx.boxReward.findUnique({ where: { id } });
  if (!reward) throw new Error('Reward not found');
  if (reward.isJackpot && reward.currentWinners > 0) {
    throw new Error('Cannot delete jackpot reward with winners already claimed.');
  }
  await tx.boxReward.delete({ where: { id } });
  await logAdminAction('delete', 'BoxReward', id, reward, null, tx);
  return { success: true };
}

export async function listBoxRewardsByBox(boxId: string, tx: any) {
  const rewards = await tx.boxReward.findMany({ where: { boxId } });
  return rewards.map(filterBoxReward);
}

function filterBoxReward(reward: any) {
  return {
    id: reward.id,
    boxId: reward.boxId,
    reward: reward.reward,
    weight: reward.weight,
    category: reward.category,
    label: reward.label,
    isJackpot: reward.isJackpot,
    maxWinners: reward.maxWinners,
    currentWinners: reward.currentWinners,
  };
}
