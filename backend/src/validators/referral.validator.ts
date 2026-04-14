import { z } from "zod";

export const referralCodeSchema = z.object({
  referralCode: z.string().min(4).max(16).regex(/^[A-Z0-9]+$/i),
}).strict();

export type ReferralCodeInput = z.infer<typeof referralCodeSchema>;
