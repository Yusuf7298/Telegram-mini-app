import { z } from "zod";

export const claimVaultSchema = z.object({
  vaultId: z.string().min(1).max(64),
}).strict();

export type ClaimVaultInput = z.infer<typeof claimVaultSchema>;
