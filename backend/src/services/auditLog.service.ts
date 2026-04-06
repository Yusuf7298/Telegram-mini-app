// NEW: AuditLog service
import { prisma } from "../config/db";
import { Prisma } from "@prisma/client";

export async function logAudit({
  userId,
  action,
  details,
  tx,
}: {
  userId: string;
  action: string;
  details?: any;
  tx?: Prisma.TransactionClient;
}) {
  const client = tx || prisma;
  await client.auditLog.create({
    data: {
      userId,
      action,
      details: details ? JSON.stringify(details) : undefined,
    },
  });
}
