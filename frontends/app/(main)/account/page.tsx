"use client";
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';

export default function AccountPage() {
  const { username, email, totalEarnings, balance, logout } = useAuthStore();
  return (
    <div className="min-h-screen bg-gradient-to-bl from-[#2C5364] via-[#000000] to-[#020617] pb-24">
      <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-gray-800 mb-2">
        <div className="text-white font-bold text-[16px]">Account</div>
      </div>

      <div className="px-4 flex flex-col gap-4">
        <div className="bg-[#16263a] rounded-2xl p-5 border border-white/10">
          <div className="text-white font-bold text-lg mb-3">Profile</div>
          <div className="flex flex-col gap-2 text-white/80 text-sm">
            <div><span className="font-semibold text-white">Username:</span> {username || 'User'}</div>
            <div><span className="font-semibold text-white">Email:</span> {email || 'user@email.com'}</div>
            <div><span className="font-semibold text-white">Total Earnings:</span> ₦{totalEarnings}</div>
            <div><span className="font-semibold text-white">Balance:</span> ₦{balance}</div>
          </div>
        </div>

        <div className="bg-[#16263a] rounded-2xl p-5 border border-white/10">
          <div className="text-white font-bold text-lg mb-3">Quick Links</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/play', label: 'Play' },
              { href: '/wallet', label: 'Wallet' },
              { href: '/rewards', label: 'Rewards' },
              { href: '/leaderboard', label: 'Leaderboard' },
              { href: '/referrals', label: 'Referrals' },
              { href: '/notifications', label: 'Notifications' },
              { href: '/settings', label: 'Settings' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-[#16263a] rounded-2xl p-5 border border-white/10 flex flex-col gap-3">
          <Link
            href="/settings"
            className="w-full px-4 py-3 rounded-lg bg-blue-600 text-white font-semibold text-center hover:bg-blue-700 transition"
          >
            Change Password
          </Link>
          <button className="w-full px-4 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition" onClick={logout}>Logout</button>
        </div>
      </div>
    </div>
  );
}
