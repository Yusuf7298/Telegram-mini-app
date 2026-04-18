import { z } from "zod";

export const adminActionSchema = z.object({
  action: z.string().min(3).max(32),
  targetId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  reason: z.string().min(3).max(256).optional(),
}).strict();

export const adminRewardSchema = z.object({
  boxId: z.string().min(1).max(64),
  reward: z.union([z.string(), z.number()]),
  weight: z.number().int().positive(),
  category: z.string().max(64).optional(),
  label: z.string().max(128).optional(),
  isJackpot: z.boolean().optional(),
  maxWinners: z.number().int().positive().optional(),
  currentWinners: z.number().int().nonnegative().optional(),
}).strict();

export const adminFreezeUserSchema = z.object({
  userId: z.string().min(1).max(64).optional(),
  targetId: z.string().min(1).max(64).optional(),
  reason: z.string().min(3).max(256).optional(),
}).refine((v) => Boolean(v.userId || v.targetId), {
  message: "userId or targetId is required",
});

export const adminRevokeSchema = z.object({
  transactionId: z.string().min(1).max(64).optional(),
  targetId: z.string().min(1).max(64).optional(),
  reason: z.string().min(3).max(256).optional(),
}).refine((v) => Boolean(v.transactionId || v.targetId), {
  message: "transactionId or targetId is required",
});

export const adminConfigUpdateSchema = z.record(z.string(), z.unknown());

export const adminCreateRemoveSchema = z.object({
  userId: z.string().min(1).max(64),
}).strict();

export const adminReferralBonusSchema = z.object({
  referralRewardAmount: z.union([z.string(), z.number()]),
}).strict();

const adminRewardConfigFields = {
  referralRewardAmount: z.union([z.string(), z.number()]).optional(),
  freeBoxRewardAmount: z.union([z.string(), z.number()]).optional(),
  minBoxReward: z.union([z.string(), z.number()]).optional(),
  maxBoxReward: z.union([z.string(), z.number()]).optional(),
  waitlistBonus: z.union([z.string(), z.number()]).optional(),
  maxPayoutMultiplier: z.union([z.string(), z.number()]).optional(),
  minRtpModifier: z.union([z.string(), z.number()]).optional(),
  maxRtpModifier: z.union([z.string(), z.number()]).optional(),
  maxPlaysPerDay: z.union([z.string(), z.number()]).optional(),
  withdrawMinPlays: z.union([z.string(), z.number()]).optional(),
  withdrawCooldownMs: z.union([z.string(), z.number()]).optional(),
  withdrawRiskThreshold: z.union([z.string(), z.number()]).optional(),
  maxReferralsPerIpPerDay: z.union([z.string(), z.number()]).optional(),
  waitlistRiskThreshold: z.union([z.string(), z.number()]).optional(),
  rapidOnboardingWindowMs: z.union([z.string(), z.number()]).optional(),
  minPlayIntervalMs: z.union([z.string(), z.number()]).optional(),
  referralWindowMs: z.union([z.string(), z.number()]).optional(),
};

export const adminConfigPatchSchema = z.object(adminRewardConfigFields).strict().refine(
  (value) =>
    value.referralRewardAmount !== undefined ||
    value.freeBoxRewardAmount !== undefined ||
    value.minBoxReward !== undefined ||
    value.maxBoxReward !== undefined ||
    value.waitlistBonus !== undefined ||
    value.maxPayoutMultiplier !== undefined ||
    value.minRtpModifier !== undefined ||
    value.maxRtpModifier !== undefined ||
    value.maxPlaysPerDay !== undefined ||
    value.withdrawMinPlays !== undefined ||
    value.withdrawCooldownMs !== undefined ||
    value.withdrawRiskThreshold !== undefined ||
    value.maxReferralsPerIpPerDay !== undefined ||
    value.waitlistRiskThreshold !== undefined ||
    value.rapidOnboardingWindowMs !== undefined ||
    value.minPlayIntervalMs !== undefined ||
    value.referralWindowMs !== undefined,
  {
    message: "At least one reward amount is required",
  },
);

export const adminGameRewardsConfigSchema = adminConfigPatchSchema;

export type AdminActionInput = z.infer<typeof adminActionSchema>;
