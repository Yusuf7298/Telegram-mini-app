import { z } from "zod";

export const adminActionSchema = z.object({
  action: z.string().min(3).max(32),
  targetId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  reason: z.string().min(3).max(256).optional(),
}).strict();

export type AdminActionInput = z.infer<typeof adminActionSchema>;
