// NEW: AdminAuditLog for admin actions
export async function logAdminAudit({
  adminId,
  action,
  targetUserId,
  metadata,
  tx,
}: {
  adminId: string;
  action: string;
  targetUserId: string;
  metadata?: any;
  tx?: Prisma.TransactionClient;
}) {
  const client = tx || new PrismaClient();
  await client.adminAuditLog.create({
    data: {
      adminId,
      action,
      targetUserId,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    },
  });
}
import { Prisma, PrismaClient } from '@prisma/client';

export async function logAdminAction(
  action: string,
  entity: string,
  entityId: string | null,
  oldValues: any,
  newValues: any,
  tx: Prisma.TransactionClient
) {
  await tx.adminAuditLog.create({
    data: {
      action,
      entity,
      entityId,
      data: {
        old: oldValues,
        new: newValues,
      },
    },
  });
}
