// NEW: AdminAuditLog for admin actions
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';

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
  const client = tx || prisma;
  await client.adminAuditLog.create({
    data: {
      action,
      entity: "User",
      entityId: targetUserId,
      data: {
        adminId,
        metadata: metadata || null,
      },
    },
  });
}

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
