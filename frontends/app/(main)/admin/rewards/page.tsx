"use client";

import dynamic from 'next/dynamic';
import { FormEvent, useMemo, useState } from 'react';
import { DataTable } from '@/components/admin/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAdminContext } from '@/components/admin/AdminContext';
import { useToast } from '@/components/ui/ToastProvider';
import {
  RewardItem,
  RewardPayload,
  createReward,
  deleteReward,
  getRewardsByBox,
  updateReward,
} from '@/lib/adminApi';

const ConfirmModal = dynamic(
  () => import('@/components/admin/ConfirmModal').then((mod) => mod.ConfirmModal)
);

const initialForm: RewardPayload = {
  boxId: '',
  reward: 0,
  weight: 1,
  category: '',
  label: '',
  isJackpot: false,
};

export default function AdminRewardsPage() {
  const { adminSecret } = useAdminContext();
  const { showToast } = useToast();
  const [boxId, setBoxId] = useState('');
  const [rows, setRows] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RewardItem | null>(null);
  const [form, setForm] = useState<RewardPayload>(initialForm);

  const loadRewards = async (id: string) => {
    setLoading(true);
    try {
      const data = await getRewardsByBox(id, adminSecret);
      setRows(data);
    } catch (error) {
      void error;
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!boxId.trim()) {
      showToast({ type: 'error', message: 'Box ID is required' });
      return;
    }

    await loadRewards(boxId.trim());
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...initialForm, boxId: boxId.trim() || '' });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload: RewardPayload = {
      ...form,
      boxId: form.boxId.trim() || boxId.trim(),
      reward: Number(form.reward),
      weight: Number(form.weight),
      maxWinners: form.maxWinners ? Number(form.maxWinners) : undefined,
      currentWinners: form.currentWinners ? Number(form.currentWinners) : undefined,
    };

    if (!payload.boxId) {
      showToast({ type: 'error', message: 'Box ID is required' });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateReward(editingId, payload, adminSecret);
        showToast({ type: 'success', message: 'Reward updated successfully' });
      } else {
        await createReward(payload, adminSecret);
        showToast({ type: 'success', message: 'Reward created successfully' });
      }

      setBoxId(payload.boxId);
      resetForm();
      await loadRewards(payload.boxId);
    } catch (error) {
      void error;
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: RewardItem) => {
    setEditingId(item.id);
    setForm({
      boxId: item.boxId,
      reward: Number(item.reward),
      weight: item.weight,
      category: item.category ?? '',
      label: item.label ?? '',
      isJackpot: item.isJackpot ?? false,
      maxWinners: item.maxWinners ?? undefined,
      currentWinners: item.currentWinners ?? undefined,
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    try {
      await deleteReward(deleteTarget.id, adminSecret);
      showToast({ type: 'success', message: 'Reward deleted successfully' });
      setDeleteTarget(null);
      await loadRewards(deleteTarget.boxId);
      if (editingId === deleteTarget.id) {
        resetForm();
      }
    } catch (error) {
      void error;
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      { key: 'id', title: 'ID', render: (row: RewardItem) => row.id },
      { key: 'reward', title: 'Reward', render: (row: RewardItem) => String(row.reward) },
      { key: 'weight', title: 'Weight', render: (row: RewardItem) => row.weight },
      { key: 'category', title: 'Category', render: (row: RewardItem) => row.category || '-' },
      { key: 'label', title: 'Label', render: (row: RewardItem) => row.label || '-' },
      {
        key: 'jackpot',
        title: 'Jackpot',
        render: (row: RewardItem) => (row.isJackpot ? 'Yes' : 'No'),
      },
      {
        key: 'actions',
        title: 'Actions',
        render: (row: RewardItem) => (
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="!px-3 !py-1 text-xs" onClick={() => startEdit(row)}>
              Edit
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="!px-3 !py-1 text-xs"
              onClick={() => setDeleteTarget(row)}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">Reward Management</h2>

      <form className="flex flex-wrap items-end gap-3" onSubmit={handleSearch}>
        <div className="w-full max-w-xs">
          <Input
            label="Box ID"
            placeholder="Enter box id"
            value={boxId}
            onChange={(event) => {
              const value = event.target.value;
              setBoxId(value);
              if (!editingId) {
                setForm((prev) => ({ ...prev, boxId: value }));
              }
            }}
          />
        </div>
        <Button type="submit" disabled={loading || !adminSecret.trim()}>
          {loading ? 'Loading...' : 'Load Rewards'}
        </Button>
      </form>

      <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
        <Input
          label="Reward Amount"
          type="number"
          value={form.reward}
          onChange={(event) => setForm((prev) => ({ ...prev, reward: Number(event.target.value) }))}
        />
        <Input
          label="Weight"
          type="number"
          value={form.weight}
          onChange={(event) => setForm((prev) => ({ ...prev, weight: Number(event.target.value) }))}
        />
        <Input
          label="Category"
          value={form.category ?? ''}
          onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
        />
        <Input
          label="Label"
          value={form.label ?? ''}
          onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
        />
        <div className="flex items-center gap-2 md:col-span-2">
          <input
            id="isJackpot"
            type="checkbox"
            checked={Boolean(form.isJackpot)}
            onChange={(event) => setForm((prev) => ({ ...prev, isJackpot: event.target.checked }))}
          />
          <label htmlFor="isJackpot" className="text-sm text-slate-200">
            Jackpot reward
          </label>
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-2">
          <Button type="submit" disabled={saving || !adminSecret.trim()}>
            {saving ? 'Saving...' : editingId ? 'Update Reward' : 'Create Reward'}
          </Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
              Cancel Edit
            </Button>
          ) : null}
        </div>
      </form>

      <DataTable
        rows={rows}
        loading={loading}
        pageSize={8}
        emptyText="No rewards for this box"
        columns={columns}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Reward"
        description={`Delete reward ${deleteTarget?.id ?? ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={saving}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
