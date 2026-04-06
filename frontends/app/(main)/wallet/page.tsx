"use client";
import { WalletCard } from '@/components/wallet/WalletCard';
import { useState } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { ArrowLeftRight } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
const transactions = [
  { date: '08-10-26', via: 'Bank Transfer', amount: 1000, status: 'Complete' },
  { date: '08-10-26', via: 'Bank Transfer', amount: 1000, status: 'Complete' },
  { date: '08-10-26', via: 'Bank Transfer', amount: 1000, status: 'Complete' },
  { date: '08-10-26', via: 'Bank Transfer', amount: 1000, status: 'Complete' },
  { date: '08-10-26', via: 'Bank Transfer', amount: 1000, status: 'Complete' },
  { date: '08-10-26', via: 'Bank Transfer', amount: 1000, status: 'Complete' },
];

export default function WalletPage() {
  const [cash] = useState(1000);
  const [airtime] = useState(1000);
  const [bonus] = useState(1000);
  const router = useRouter();
  
  function handleClick() {
    // Handle back navigation
    router.back();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#000C1D] via-[#081625] to-[#010A1D] pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-gray-800">
        <button onClick={handleClick} className="w-10 h-10 flex items-center justify-center rounded-full cursor-pointer bg-transparent border border-white/10 shadow text-white">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="text-white font-bold text-[16px]">Wallet</div>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white">
          <BellIcon className="h-7 w-7 text-current m-2" />
        </button>
      </div>

      {/* Balance Section */}
      <div className="mx-4 mt-2 mb-4 p-4 rounded-2xl bg-[#16263a] border border-white/10">
        <div className="font-extrabold text-white text-[16px] mb-4 font-Rubik">BALANCE</div>
        <div className="flex gap-3 flex-row">
          <div className="flex-1 min-w-[0] flex flex-col items-center bg-[#1a2533] rounded-xl p-2 border border-white/10 max-w-[140px]">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block w-4 h-4 bg-white/10 rounded-full flex items-center justify-center">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="2" fill="#fff"/></svg>
              </span>
              <span className="text-white font-semibold text-[14px]">Cash</span>
            </div>
            <div className="text-white font-bold text-lg">₦{cash}</div>
          </div>
          <div className="flex-1 min-w-[0] flex flex-col items-center bg-[#1a2533] rounded-xl p-2 border border-white/10 max-w-[140px]">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block w-4 h-4 bg-white/10 rounded-full flex items-center justify-center">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><rect x="5" y="7" width="14" height="10" rx="2" fill="#fff"/></svg>
              </span>
              <span className="text-white font-semibold text-[14px]">Airtime</span>
            </div>
            <div className="text-white font-bold text-lg">₦{airtime}</div>
          </div>
          <div className="flex-1 min-w-[0] flex flex-col items-center bg-[#1a2533] rounded-xl p-2 border border-white/10 max-w-[140px]">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block w-4 h-4 bg-white/10 rounded-full flex items-center justify-center">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" fill="#fff"/></svg>
              </span>
              <span className="text-white font-semibold text-[14px]">Bonus</span>
            </div>
            <div className="text-white font-bold text-lg">₦{bonus}</div>
          </div>
        </div>
      </div>

      {/* Deposit & Withdrawal Buttons */}
      <div className="mx-4 flex flex-col gap-3 mb-4">
        <button className="w-full py-3 rounded-lg bg-[#00FFB2] cursor-pointer text-[#000000] font-bold text-[12px] shadow hover:bg-[#00e6a0] ">DEPOSIT</button>
        <button className="w-full py-3 rounded-lg bg-[#222B36] cursor-pointer text-white font-bold text-[12px] border border-white/10 hover:bg-[#2a3540]">WITHDRAWAL</button>
      </div>

      {/* Recent Transactions */}
      <div className="mx-4 mt-4">
        <div className="flex items-center gap-2 mb-1">
          <ArrowLeftRight className="h-5 w-5 text-[#00FFB2] -ml-2" strokeWidth={3} />
          <span className="uppercase font-extrabold text-white text-[20px] tracking-tight leading-none">Recent Transaction</span>
        </div>
        <div className="text-white/60 text-[12px] mb-2">Exclusive Reward for the Weekly Leaderboard Winner</div>
        <div className="rounded-2xl bg-[#16263a] border border-white/10 overflow-x-auto">
          <table className="min-w-full text-white/80 text-base">
            <thead className="mb-2 mt-2">
              <tr className="bg-[#101B2A]">
                <th className="py-3 px-4 font-medium text-left text-[12px]">Date</th>
                <th className="py-3 px-4 font-medium text-left text-[12px]">Via</th>
                <th className="py-3 px-4 font-medium text-left text-[12px]">Amount</th>
                <th className="py-3 px-4 font-medium text-left text-[12px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, idx) => (
                <tr key={idx} className="border-b border-white/5 last:border-b-0">
                  <td className="py-3 px-4 text-[12px] font-Poppins">{tx.date}</td>
                  <td className="py-3 px-4 text-[12px] font-Poppins">{tx.via}</td>
                  <td className="py-3 px-4 text-[12px] font-Poppins">₦{tx.amount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-[12px] font-Poppins">{tx.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
