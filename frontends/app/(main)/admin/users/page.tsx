"use client";

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Button } from '@/components/ui/Button';
import { useAdminContext } from '@/components/admin/AdminContext';
import { useToast } from '@/components/ui/ToastProvider';
import {
  AdminUser,
  freezeUser,
  getAdminUsers,
  unfreezeUser,
} from '@/lib/adminApi';

const ConfirmModal = dynamic(
  () => import('@/components/admin/ConfirmModal').then((mod) => mod.ConfirmModal)
);

function formatCurrency(value: string | number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return numeric.toLocaleString();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export default function AdminUsersPage() {
  const { adminSecret } = useAdminContext();
  const { showToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const modalAction = useMemo(() => {
    if (!selectedUser) return null;
    const isFrozen = selectedUser.accountStatus.toLowerCase() === 'frozen';
    return isFrozen ? 'unfreeze' : 'freeze';
  }, [selectedUser]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminUsers(adminSecret);
      setUsers(data);
    } catch (error) {
      void error;
    } finally {
      setLoading(false);
    }
  }, [adminSecret]);

  useEffect(() => {
    if (!adminSecret.trim()) return;
    void loadUsers();
  }, [adminSecret]);

  const handleConfirmAction = async () => {
    if (!selectedUser || !modalAction) return;

    setActing(true);
    try {
      if (modalAction === 'freeze') {
        await freezeUser(selectedUser.id, adminSecret);
        showToast({ type: 'success', message: 'User frozen successfully' });
      } else {
        await unfreezeUser(selectedUser.id, adminSecret);
        showToast({ type: 'success', message: 'User unfrozen successfully' });
      }
      setSelectedUser(null);
      await loadUsers();
    } catch (error) {
      void error;
    } finally {
      setActing(false);
    }
  };

  const columns = useMemo(
    () => [
      { key: 'id', title: 'ID', render: (row: AdminUser) => row.id },
      {
        key: 'balance',
        title: 'Balance',
        render: (row: AdminUser) => {
          const cash = row.wallet?.cashBalance ?? '0';
          const bonus = row.wallet?.bonusBalance ?? '0';
          return `₦${formatCurrency(Number(cash) + Number(bonus))}`;
        },
      },
      {
        key: 'status',
        title: 'Status',
        render: (row: AdminUser) => <StatusBadge status={row.accountStatus} />,
      },
      {
        key: 'createdAt',
        title: 'Created',
        render: (row: AdminUser) => formatDate(row.createdAt),
      },
      {
        key: 'actions',
        title: 'Action',
        render: (row: AdminUser) => {
          const isFrozen = row.accountStatus.toLowerCase() === 'frozen';
          return (
            <Button
              variant={isFrozen ? 'primary' : 'secondary'}
              className="!px-3 !py-1 text-xs"
              disabled={acting || !adminSecret.trim()}
              onClick={() => setSelectedUser(row)}
            >
              {isFrozen ? 'Unfreeze' : 'Freeze'}
            </Button>
          );
        },
      },
    ],
    [acting, adminSecret]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Users</h2>
        <Button onClick={() => void loadUsers()} disabled={loading || !adminSecret.trim()}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <DataTable
        rows={users}
        loading={loading}
        pageSize={8}
        emptyText="No users available"
        columns={columns}
      />

      <ConfirmModal
        isOpen={Boolean(selectedUser)}
        title={modalAction === 'unfreeze' ? 'Unfreeze User' : 'Freeze User'}
        description={`Are you sure you want to ${modalAction ?? 'freeze'} user ${selectedUser?.id ?? ''}?`}
        confirmLabel={modalAction === 'unfreeze' ? 'Confirm Unfreeze' : 'Confirm Freeze'}
        loading={acting}
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setSelectedUser(null)}
      />
    </div>
  );
}
