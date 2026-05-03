import { z } from "zod";


export const referralCodeSchema = z.object({
  referralCode: z.string().min(4).max(16).regex(/^[A-Z0-9]+$/i),
  idempotencyKey: z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/),
}).strict();

export type ReferralCodeInput = z.infer<typeof referralCodeSchema>;
