"use client";

import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/admin/DataTable';
import { Button } from '@/components/ui/Button';
import { useAdminContext } from '@/components/admin/AdminContext';
import { FraudEvent, getFraudEvents } from '@/lib/adminApi';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export default function AdminTransactionsPage() {
  const { adminSecret } = useAdminContext();
  const [rows, setRows] = useState<FraudEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const paginated = useMemo(() => rows, [rows]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getFraudEvents(adminSecret);
      setRows(data);
    } catch (error) {
      void error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminSecret.trim()) return;
    void load();
  }, [adminSecret]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Transaction Logs</h2>
        <Button onClick={() => void load()} disabled={loading || !adminSecret.trim()}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <DataTable
        rows={paginated}
        loading={loading}
        pageSize={10}
        emptyText="No transaction logs found"
        columns={[
          { key: 'id', title: 'ID', render: (row) => row.id },
          { key: 'user', title: 'User', render: (row) => row.user?.username || row.userId || '-' },
          { key: 'action', title: 'Action', render: (row) => row.action },
          {
            key: 'details',
            title: 'Details',
            render: (row) => {
              if (!row.details) return '-';
              return (
                <span className="line-clamp-2 max-w-[280px] text-xs text-slate-300">
                  {JSON.stringify(row.details)}
                </span>
              );
            },
          },
          { key: 'time', title: 'Flagged At', render: (row) => formatDate(row.flaggedAt) },
        ]}
      />
    </div>
  );
}
