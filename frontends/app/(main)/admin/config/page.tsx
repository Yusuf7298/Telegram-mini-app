"use client";

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useAdminContext } from '@/components/admin/AdminContext';
import { useToast } from '@/components/ui/ToastProvider';
import { updateSystemConfig } from '@/lib/adminApi';

export default function AdminConfigPage() {
  const { adminSecret } = useAdminContext();
  const { showToast } = useToast();
  const [jsonConfig, setJsonConfig] = useState('{\n  "maintenanceMode": false\n}');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoading(true);
    try {
      const parsed = JSON.parse(jsonConfig) as Record<string, unknown>;
      await updateSystemConfig(parsed, adminSecret);
      showToast({ type: 'success', message: 'System config updated successfully' });
    } catch (error) {
      if (error instanceof SyntaxError) {
        showToast({ type: 'error', message: 'Invalid JSON config payload' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold">System Config Update</h2>
      <p className="text-sm text-slate-300">Submit JSON config payload to backend config endpoint.</p>

      <textarea
        className="min-h-[260px] w-full rounded-xl border border-white/10 bg-[#0b1526] p-3 font-mono text-sm text-white outline-none focus:border-emerald-400"
        value={jsonConfig}
        onChange={(event) => setJsonConfig(event.target.value)}
        spellCheck={false}
      />

      <Button type="submit" disabled={loading || !adminSecret.trim()}>
        {loading ? 'Saving...' : 'Update Config'}
      </Button>
    </form>
  );
}
