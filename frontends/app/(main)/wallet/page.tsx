"use client";
import { useEffect, useMemo } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { ArrowLeftRight } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/ToastProvider';
import { WALLET_REFRESH_EVENT, useWalletStore } from '@/store/walletStore';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

export default function WalletPage() {
  const cash = useWalletStore((state) => state.cashBalance);
  const airtime = useWalletStore((state) => state.airtimeBalance);
  const bonus = useWalletStore((state) => state.bonusBalance);
  const transactions = useWalletStore((state) => state.transactions);
  const loading = useWalletStore((state) => state.loading);
  const error = useWalletStore((state) => state.error);
  const fetchWallet = useWalletStore((state) => state.fetchWallet);
  const { showToast } = useToast();
  const router = useRouter();

  const tableRows = useMemo(
    () =>
      transactions.map((tx) => (
        <tr key={tx.id} className="border-b border-white/5 last:border-b-0">
          <td className="px-4 py-3 text-sm font-Poppins">{formatDate(tx.createdAt)}</td>
          <td className="px-4 py-3 text-sm font-Poppins">{tx.type}</td>
          <td className="px-4 py-3 text-sm font-Poppins">₦{tx.amount.toLocaleString()}</td>
          <td className="px-4 py-3 text-sm font-Poppins">Complete</td>
        </tr>
      )),
    [transactions]
  );

  const mobileRows = useMemo(
    () =>
      transactions.map((tx) => (
        <div key={tx.id} className="rounded-lg bg-[#101B2A] px-3 py-3 text-sm text-white/85">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{tx.type}</span>
            <span className="font-semibold text-emerald-300">₦{tx.amount.toLocaleString()}</span>
          </div>
          <div className="mt-1 text-xs text-white/60">{formatDate(tx.createdAt)}</div>
          <div className="mt-1 text-xs text-white/70">Status: Complete</div>
        </div>
      )),
    [transactions]
  );

  useEffect(() => {
    if (!error) return;
    showToast({ type: 'error', message: error });
  }, [error, showToast]);

  useEffect(() => {
    void fetchWallet();

    const onRefresh = () => {
      void fetchWallet();
    };

    window.addEventListener(WALLET_REFRESH_EVENT, onRefresh);
    window.addEventListener('focus', onRefresh);

    return () => {
      window.removeEventListener(WALLET_REFRESH_EVENT, onRefresh);
      window.removeEventListener('focus', onRefresh);
    };
  }, [fetchWallet]);
  
  function handleClick() {
    // Handle back navigation
    router.back();
  }

  function handleDeposite() {
    // Handle deposit action
    router.push('/deposit');
  }

  function handleWithdrawal() {
    // Handle withdrawal action
    router.push('/withdraw');
  }

  return (
    <div className="min-h-telegram-screen safe-screen-padding overflow-x-hidden bg-gradient-to-bl from-[#2C5364] via-[#000000] to-[#020617] pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-gray-800">
        <button onClick={handleClick} aria-label="Go back" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-transparent text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="text-base font-bold text-white">Wallet</div>
        <button aria-label="Notifications" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
          <BellIcon className="h-7 w-7 text-current m-2" />
        </button>
      </div>

      {/* Balance Section */}
      <div className="mx-4 mt-2 mb-4 p-4 rounded-2xl bg-[#16263a] border border-white/10">
        <div className="font-extrabold text-white text-[16px] mb-4 font-Rubik">BALANCE</div>
        {loading && (
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex min-w-0 flex-col items-center rounded-xl border border-white/10 bg-[#1a2533] p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block w-4 h-4 bg-white/10 rounded-full flex items-center justify-center">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="2" fill="#fff"/></svg>
              </span>
              <span className="text-sm font-semibold text-white">Cash</span>
            </div>
            <div className="text-base font-bold text-white sm:text-lg">₦{cash}</div>
          </div>
          <div className="flex min-w-0 flex-col items-center rounded-xl border border-white/10 bg-[#1a2533] p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block w-4 h-4 bg-white/10 rounded-full flex items-center justify-center">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><rect x="5" y="7" width="14" height="10" rx="2" fill="#fff"/></svg>
              </span>
              <span className="text-sm font-semibold text-white">Airtime</span>
            </div>
            <div className="text-base font-bold text-white sm:text-lg">₦{airtime}</div>
          </div>
          <div className="flex min-w-0 flex-col items-center rounded-xl border border-white/10 bg-[#1a2533] p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block w-4 h-4 bg-white/10 rounded-full flex items-center justify-center">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" fill="#fff"/></svg>
              </span>
              <span className="text-sm font-semibold text-white">Bonus</span>
            </div>
            <div className="text-base font-bold text-white sm:text-lg">₦{bonus}</div>
          </div>
        </div>
      </div>

      {/* Deposit & Withdrawal Buttons */}
      <div className="mx-4 flex flex-col gap-3 mb-4">
        <button onClick={handleDeposite} disabled={loading} className="min-h-[44px] w-full rounded-lg bg-[#00FFB2] px-4 py-3 text-sm font-bold text-[#000000] shadow transition hover:bg-[#00e6a0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFB2]/60 disabled:cursor-not-allowed disabled:opacity-60">DEPOSIT</button>
        <button onClick={handleWithdrawal} disabled={loading} className="min-h-[44px] w-full rounded-lg border border-white/10 bg-[#222B36] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#2a3540] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60">WITHDRAWAL</button>
      </div>

      {/* Recent Transactions */}
      <div className="mx-4 mt-4">
        <div className="flex items-center gap-2 mb-1">
          <ArrowLeftRight className="h-5 w-5 text-[#00FFB2] -ml-2" strokeWidth={3} />
          <span className="leading-none text-lg font-extrabold uppercase tracking-tight text-white sm:text-xl">Recent Transaction</span>
        </div>
        <div className="mb-2 text-sm text-white/60">Exclusive Reward for the Weekly Leaderboard Winner</div>
        <div className="rounded-2xl bg-[#16263a] border border-white/10">
          <table className="hidden w-full table-auto text-white/80 text-sm sm:table">
            <thead className="mb-2 mt-2">
              <tr className="bg-[#101B2A]">
                <th className="py-3 px-4 text-left text-sm font-medium">Date</th>
                <th className="py-3 px-4 text-left text-sm font-medium">Via</th>
                <th className="py-3 px-4 text-left text-sm font-medium">Amount</th>
                <th className="py-3 px-4 text-left text-sm font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`wallet_tx_skeleton_${idx}`} className="border-b border-white/5 last:border-b-0">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-sm text-white/60" colSpan={4}>
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                tableRows
              )}
            </tbody>
          </table>

          <div className="space-y-2 p-3 sm:hidden">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={`wallet_mobile_tx_skeleton_${idx}`} className="rounded-lg bg-[#101B2A] px-3 py-3 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))
            ) : transactions.length === 0 ? (
              <div className="rounded-lg bg-white/5 px-3 py-3 text-sm text-white/60">No transactions yet.</div>
            ) : (
              mobileRows
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
