"use client";
import { useState } from "react";

const referralCode = "ABCD1234";
const stats = {
  totalReferrals: 8,
  totalEarnings: 4000,
};
const referrals = [
  { name: "Jane", date: "2026-03-30", status: "Joined", reward: 500 },
  { name: "Sam", date: "2026-03-29", status: "Pending", reward: 0 },
  { name: "Alex", date: "2026-03-28", status: "Joined", reward: 500 },
  { name: "Mary", date: "2026-03-27", status: "Joined", reward: 500 },
  { name: "John", date: "2026-03-26", status: "Pending", reward: 0 },
];

import MobileAppLayout from '@/components/layout/MobileLayout';

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <MobileAppLayout>
      <div className="px-4 flex flex-col items-center">
        {/* Referral Code Card */}
        <div className="w-full max-w-sm bg-[#101B2A] rounded-2xl shadow-lg p-6 flex flex-col items-center mt-8 mb-4">
        <div className="text-white font-bold text-lg mb-2">Your Referral Code</div>
        <div className="flex items-center gap-2 mb-4">
          <span className="bg-[#232B3C] text-blue-400 font-mono px-4 py-2 rounded-lg text-lg tracking-widest">{referralCode}</span>
          <button
            className="bg-blue-600 text-white rounded-lg px-3 py-2 font-semibold hover:bg-blue-700 transition text-sm"
            onClick={handleShare}
          >
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
        <div className="flex w-full justify-between mt-2">
          <div className="flex flex-col items-center flex-1">
            <div className="text-gray-400 text-xs">Total Referrals</div>
            <div className="text-white font-bold text-lg">{stats.totalReferrals}</div>
          </div>
          <div className="flex flex-col items-center flex-1">
            <div className="text-gray-400 text-xs">Total Earnings</div>
            <div className="text-green-400 font-bold text-lg">₦{stats.totalEarnings}</div>
          </div>
        </div>
      </div>

      {/* Referral List */}
      <div className="w-full max-w-sm bg-[#101B2A] rounded-2xl shadow-lg p-4 flex flex-col items-center mb-4">
        <div className="text-white font-bold text-lg mb-2">Referrals</div>
        <div className="w-full">
          <div className="flex font-bold text-gray-300 border-b border-[#232B3C] pb-2 mb-2 text-xs">
            <div className="flex-1">Name</div>
            <div className="w-20">Date</div>
            <div className="w-16">Status</div>
            <div className="w-16 text-right">Reward</div>
          </div>
          {referrals.map((r, i) => (
            <div key={i} className="flex items-center py-2 px-2 mb-2 rounded-lg bg-[#19233A] text-white">
              <div className="flex-1">{r.name}</div>
              <div className="w-20 text-xs">{r.date}</div>
              <div className={`w-16 text-xs font-semibold ${r.status === 'Joined' ? 'text-green-400' : 'text-yellow-400'}`}>{r.status}</div>
              <div className="w-16 text-right text-green-400 font-bold">{r.reward > 0 ? `₦${r.reward}` : '-'}</div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </MobileAppLayout>
  );
}
