"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAdminContext } from '@/components/admin/AdminContext';
import { useToast } from '@/components/ui/ToastProvider';
import { getGameRewardsConfig, getSafeErrorMessage, updateGameRewardsConfig } from '@/lib/adminApi';

const emptyConfig = {
  referralRewardAmount: '',
  freeBoxRewardAmount: '',
  minBoxReward: '',
  maxBoxReward: '',
  waitlistBonus: '',
};

export default function AdminConfigPage() {
  const { adminSecret } = useAdminContext();
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyConfig);
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!adminSecret.trim()) {
      return;
    }

    const loadConfig = async () => {
      setLoadingConfig(true);
      try {
        const config = await getGameRewardsConfig(adminSecret);
        setForm({
          referralRewardAmount: String(config.referralRewardAmount ?? ''),
          freeBoxRewardAmount: String(config.freeBoxRewardAmount ?? ''),
          minBoxReward: String(config.minBoxReward ?? ''),
          maxBoxReward: String(config.maxBoxReward ?? ''),
          waitlistBonus: String(config.waitlistBonus ?? ''),
        });
      } catch (error) {
        showToast({ type: 'error', message: getSafeErrorMessage(error) });
      } finally {
        setLoadingConfig(false);
      }
    };

    void loadConfig();
  }, [adminSecret, showToast]);

  const updateField = (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const parseNumber = (value: string) => {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const referralRewardAmount = parseNumber(form.referralRewardAmount);
    const freeBoxRewardAmount = parseNumber(form.freeBoxRewardAmount);
    const minBoxReward = parseNumber(form.minBoxReward);
    const maxBoxReward = parseNumber(form.maxBoxReward);
    const waitlistBonus = parseNumber(form.waitlistBonus);

    if (referralRewardAmount === null || referralRewardAmount <= 0) {
      showToast({ type: 'error', message: 'Referral reward amount must be greater than 0' });
      return;
    }

    if (freeBoxRewardAmount === null || freeBoxRewardAmount < 0) {
      showToast({ type: 'error', message: 'Free box reward amount must be a non-negative number' });
      return;
    }

    if (minBoxReward === null || !Number.isInteger(minBoxReward) || minBoxReward < 0) {
      showToast({ type: 'error', message: 'Min box reward must be a non-negative integer' });
      return;
    }

    if (maxBoxReward === null || !Number.isInteger(maxBoxReward) || maxBoxReward < 0) {
      showToast({ type: 'error', message: 'Max box reward must be a non-negative integer' });
      return;
    }

    if (!(minBoxReward < maxBoxReward)) {
      showToast({ type: 'error', message: 'Min box reward must be less than max box reward' });
      return;
    }

    if (waitlistBonus === null || !Number.isInteger(waitlistBonus) || waitlistBonus < 0) {
      showToast({ type: 'error', message: 'Waitlist bonus must be a non-negative integer' });
      return;
    }

    setSaving(true);
    try {
      const config = await updateGameRewardsConfig(
        {
          referralRewardAmount,
          freeBoxRewardAmount,
          minBoxReward,
          maxBoxReward,
          waitlistBonus,
        },
        adminSecret,
      );

      setForm({
        referralRewardAmount: String(config.referralRewardAmount ?? ''),
        freeBoxRewardAmount: String(config.freeBoxRewardAmount ?? ''),
        minBoxReward: String(config.minBoxReward ?? ''),
        maxBoxReward: String(config.maxBoxReward ?? ''),
        waitlistBonus: String(config.waitlistBonus ?? ''),
      });

      showToast({ type: 'success', message: 'Reward configuration updated successfully' });
    } catch (error) {
      showToast({ type: 'error', message: getSafeErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0f1729] to-[#111b31] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        <div className="max-w-3xl space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Economy Control</p>
          <h2 className="text-2xl font-semibold text-white">Reward Configuration</h2>
          <p className="text-sm text-slate-300">
            Update the live game economy without redeploying. Changes apply immediately after save and are validated on the backend.
          </p>
        </div>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Referral Reward Amount"
            type="number"
            step="0.01"
            min="0"
            value={form.referralRewardAmount}
            onChange={updateField('referralRewardAmount')}
            disabled={loadingConfig}
          />
          <Input
            label="Free Box Reward Amount"
            type="number"
            step="0.01"
            min="0"
            value={form.freeBoxRewardAmount}
            onChange={updateField('freeBoxRewardAmount')}
            disabled={loadingConfig}
          />
          <Input
            label="Min Box Reward"
            type="number"
            step="1"
            min="0"
            value={form.minBoxReward}
            onChange={updateField('minBoxReward')}
            disabled={loadingConfig}
          />
          <Input
            label="Max Box Reward"
            type="number"
            step="1"
            min="0"
            value={form.maxBoxReward}
            onChange={updateField('maxBoxReward')}
            disabled={loadingConfig}
          />
          <Input
            label="Waitlist Bonus"
            type="number"
            step="1"
            min="0"
            value={form.waitlistBonus}
            onChange={updateField('waitlistBonus')}
            disabled={loadingConfig}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving || loadingConfig || !adminSecret.trim()}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
          {loadingConfig ? <p className="text-sm text-slate-400">Loading current config...</p> : null}
          {!adminSecret.trim() ? <p className="text-sm text-amber-300">Enter the admin secret to load and save config.</p> : null}
        </div>
      </form>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        <p className="font-medium text-white">Validation rules</p>
        <p className="mt-2">Referral reward must be greater than zero, min box reward must stay below max box reward, and waitlist bonus cannot be negative.</p>
      </div>
    </div>
  );
}
