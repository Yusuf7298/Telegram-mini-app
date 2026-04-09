import { Prisma } from '@prisma/client';
import { D, lte, lt } from '../utils/money';

type BoxRewardInput = {
  weight: number;
  reward: number | Prisma.Decimal;
  isJackpot?: boolean;
  maxWinners?: number | null;
  category?: string;
  label?: string;
};

export function validateBoxRewardInput(data: any) {
  try {
    data.weight = new Prisma.Decimal(data.weight);
  } catch {
    throw new Error('Weight must be a valid decimal value.');
  }
  try {
    data.reward = new Prisma.Decimal(data.reward);
  } catch {
    throw new Error('Reward must be a valid decimal value.');
  }
  if (lte(data.weight, D(0))) {
    throw new Error('Weight must be a positive number.');
  }
  if (lt(data.reward, D(0))) {
    throw new Error('Reward must be greater than or equal to 0.');
  }
  if (data.isJackpot) {
    try {
      data.maxWinners = new Prisma.Decimal(data.maxWinners);
    } catch {
      throw new Error('maxWinners must be a valid decimal value.');
    }
    if (lte(data.maxWinners, D(0))) {
      throw new Error('Jackpot rewards must have maxWinners > 0.');
    }
  }
  if (typeof data.category === 'string') {
    data.category = data.category.trim();
  }
  if (typeof data.label === 'string') {
    data.label = data.label.trim();
  }
}
