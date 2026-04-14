import { z } from "zod";

export const registerUserSchema = z.object({
  platformId: z.string().min(1).max(128),
  username: z.string().min(1).max(64).optional(),
  referrerId: z.string().min(1).max(64).optional(),
}).strict();

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
