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

export type AdminActionInput = z.infer<typeof adminActionSchema>;
