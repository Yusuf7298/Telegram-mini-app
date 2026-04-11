import { z } from "zod";

export const openBoxSchema = z.object({
  boxId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  idempotencyKey: z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  timestamp: z.number().int().positive(),
}).strict();

export const freeBoxSchema = z.object({
  idempotencyKey: z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  timestamp: z.number().int().positive(),
}).strict();

export type OpenBoxInput = z.infer<typeof openBoxSchema>;
export type FreeBoxInput = z.infer<typeof freeBoxSchema>;
