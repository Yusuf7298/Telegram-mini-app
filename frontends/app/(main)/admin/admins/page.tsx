"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/admin/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAdminContext } from '@/components/admin/AdminContext';
import { useToast } from '@/components/ui/ToastProvider';
import { useAuthStore } from '@/store/authStore';
import {
  AdminAccount,
  createAdminAccount,
  getSafeErrorMessage,
  listAdminAccounts,
  removeAdminAccount,
} from '@/lib/adminApi';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export default function AdminControlPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { adminSecret } = useAdminContext();
  const { showToast } = useToast();
  const [targetUserId, setTargetUserId] = useState('');
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (user && !isSuperAdmin) {
      router.replace('/admin/rewards');
    }
  }, [isSuperAdmin, router, user]);

  const loadAdmins = async () => {
    if (!adminSecret.trim()) return;
    setLoading(true);
    try {
      const list = await listAdminAccounts(adminSecret);
      setAdmins(list);
    } catch (error) {
      showToast({ type: 'error', message: getSafeErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAdmins();
  }, [adminSecret]);

  const createAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userId = targetUserId.trim();
    if (!userId) {
      showToast({ type: 'error', message: 'userId is required' });
      return;
    }

    setSaving(true);
    try {
      await createAdminAccount(userId, adminSecret);
      showToast({ type: 'success', message: 'Admin created successfully' });
      setTargetUserId('');
      await loadAdmins();
    } catch (error) {
      showToast({ type: 'error', message: getSafeErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const removeAdmin = async (userId: string) => {
    setSaving(true);
    try {
      await removeAdminAccount(userId, adminSecret);
      showToast({ type: 'success', message: 'Admin removed successfully' });
      await loadAdmins();
    } catch (error) {
      showToast({ type: 'error', message: getSafeErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      { key: 'id', title: 'User ID', render: (row: AdminAccount) => row.id },
      { key: 'platformId', title: 'Platform ID', render: (row: AdminAccount) => row.platformId },
      { key: 'username', title: 'Username', render: (row: AdminAccount) => row.username || '-' },
      { key: 'role', title: 'Role', render: (row: AdminAccount) => row.role },
      { key: 'createdAt', title: 'Created', render: (row: AdminAccount) => formatDate(row.createdAt) },
      {
        key: 'action',
        title: 'Action',
        render: (row: AdminAccount) => (
          <Button
            type="button"
            variant="secondary"
            className="!px-3 !py-1 text-xs"
            disabled={!adminSecret.trim() || saving || row.role === 'SUPER_ADMIN'}
            onClick={() => {
              void removeAdmin(row.id);
            }}
          >
            Remove
          </Button>
        ),
      },
    ],
    [adminSecret, saving],
  );

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">Super Admin Control</h2>
      <p className="text-sm text-slate-300">Create, remove, and review admin accounts.</p>

      <form className="flex flex-wrap items-end gap-3" onSubmit={createAdmin}>
        <div className="w-full max-w-sm">
          <Input
            label="Target userId"
            placeholder="Enter existing user id"
            value={targetUserId}
            onChange={(event) => setTargetUserId(event.target.value)}
          />
        </div>

        <Button type="submit" disabled={!adminSecret.trim() || saving}>
          {saving ? 'Saving...' : 'Create Admin'}
        </Button>

        <Button type="button" variant="outline" disabled={!adminSecret.trim() || loading} onClick={() => void loadAdmins()}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </form>

      <DataTable
        rows={admins}
        loading={loading}
        pageSize={8}
        emptyText="No admins configured"
        columns={columns}
      />
    </div>
  );
}
