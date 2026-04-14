import { z } from "zod";

export const telegramLoginSchema = z.object({
  initData: z.string().min(1),
}).strict();

export type TelegramLoginInput = z.infer<typeof telegramLoginSchema>;
