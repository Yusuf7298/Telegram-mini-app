import { z } from "zod";

export const openBoxSchema = z.object({
  boxId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  idempotencyKey: z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/),
}).strict();

export type OpenBoxInput = z.infer<typeof openBoxSchema>;
