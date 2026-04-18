import { z } from "zod";

export const telegramLoginSchema = z.object({
  initData: z.string().min(1),
  referralCode: z.string().min(6).max(8).regex(/^[A-Z0-9]+$/i).optional(),
}).strict();

export type TelegramLoginInput = z.infer<typeof telegramLoginSchema>;
