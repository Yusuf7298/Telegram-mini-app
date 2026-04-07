"use client";
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Header } from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import { useAuthStore } from '@/store/authStore';

export default function AccountPage() {
  const { username, email, totalEarnings, balance, logout } = useAuthStore();
  return (
    <PageWrapper>
      <Header />
      <div className="mt-4 flex flex-col gap-6">
        <div className="bg-white rounded-xl p-5 shadow flex flex-col gap-2">
          <div className="font-bold text-lg">Account</div>
          <div className="flex flex-col gap-1">
            <div><span className="font-semibold">Username:</span> {username || 'User'}</div>
            <div><span className="font-semibold">Email:</span> {email || 'user@email.com'}</div>
            <div><span className="font-semibold">Total Earnings:</span> ₦{totalEarnings}</div>
            <div><span className="font-semibold">Balance:</span> ₦{balance}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow flex flex-col gap-3">
          <button className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">Change Password</button>
          <button className="w-full px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700" onClick={logout}>Logout</button>
        </div>
      </div>
      <BottomNav />
    </PageWrapper>
  );
}
