"use client";
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { ArrowLeft, Bell, Copy, Settings, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function AccountPage() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const referralCode = 'YOURCODE1234';

  const notifications = [
    { date: '08-10-26', message: 'Congratulations you won ₦1,000 by...' },
    { date: '08-10-26', message: 'You’ve earned ₦1,000 from referring...' },
    { date: '08-10-26', message: 'Congratulations you won ₦1,000 by...' },
    { date: '08-10-26', message: 'You’ve earned ₦1,000 from referring...' },
  ];

  const referrals = [
    { username: 'Aisha', joined: '08-10-26', status: 'Active', earning: '₦1,000' },
    { username: 'David', joined: '08-10-26', status: 'Active', earning: '₦1,000' },
    { username: 'Samuel', joined: '08-10-26', status: 'Active', earning: '₦1,000' },
    { username: 'David', joined: '08-10-26', status: 'Pending', earning: '₦1,000' },
    { username: 'David', joined: '08-10-26', status: 'Pending', earning: '₦1,000' },
  ];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const stats = [
    { label: 'Friends', value: '1000' },
    { label: 'Total Earning', value: '1000' },
    { label: 'Balance', value: '1000' },
  ];

  function handleClick() {
    router.back()
  }

  return (
    <div className="min-h-screen bg-gradient-to-bl from-[#2C5364] via-[#000000] to-[#020617] pb-24 text-white">
     <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-gray-800">
        <button onClick={handleClick} className="w-10 h-10 flex items-center justify-center rounded-full cursor-pointer bg-transparent border border-white/10 shadow text-white">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="text-white font-bold text-[16px]">Profile</div>
        <button 
        onClick={(e) => {router.push('/settings')}}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white">
          <Settings className="h-7 w-7 text-current m-2" />
        </button>
      </div>

      <div className="px-4">
        <div className="rounded-[24px] border border-white/10 bg-[#0d1526]/80 px-4 py-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="flex flex-col items-center text-center">
            <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-white/5 bg-[#1b263f]">
              <Image src={user?.avatar || "/images/users.png"} alt="Profile avatar" width={80} height={80} className="h-full w-full object-cover" />
            </div>
            <div className="mt-4 text-[14px] font-Rubik font-bold tracking-[-0.03em]">{user?.username || 'SESKO'}</div>
            <div className="mt-1 text-[12px] font-Poppins text-white/50">{user?.phone ? '#OW415' : '#OW415'}</div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {stats.map((item) => (
              <div key={item.label} className="rounded-2xl bg-[#19223a] px-2 py-4">
                <div className="text-[14px] font-Poppins text-white/80">{item.label}</div>
                <div className="mt-3 text-[16px] font-Rubik font-medium tracking-[-0.03em]">₦<span className='font-bold'>
                  {item.value}
                </span></div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-[#0d1526]/80 px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="text-[16px] font-bold tracking-[-0.03em] font-Rubik uppercase text-white">REFER A FRIEND & EARN ₦5,000</div>
          <div className="mt-4 text-[14px] font-Poppins text-white/70">Referral Code</div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 rounded-2xl border border-white/10 bg-[#19223a] px-4 py-4 text-[14px] font-Poppins text-white/55">
              {referralCode}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#18e0a8]/40 bg-[#18e0a8]/20 text-[#03DD8D] transition hover:bg-[#18e0a8]/30"
              aria-label="Copy referral code"
            >
              {copied ? <span className="text-[12px] font-bold">Done</span> : <Copy className="h-6 w-6" />}
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 rounded-[24px] border border-white/10 bg-[#0d1526]/80 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="rounded-2xl bg-[#19223a] px-4 py-4">
            <div className="text-[12px] font-Poppins text-white/70">Total Referral</div>
            <div className="mt-3 text-[12px] font-bold font-Rubik tracking-[-0.03em]">02</div>
            <div className="mt-4 text-[12px] font-Poppins text-white/55">Total Earning</div>
            <div className="mt-2 text-[16px] font-bold font-Rubik tracking-[-0.03em]">₦1000</div>
          </div>

          <div className="flex flex-col rounded-2xl bg-[#19223a] px-4 py-4">
            <div className="text-[12px] font-Poppins  text-white/55">Claimable Earning</div>
            <div className="mt-3 text-[16px] font-extrabold tracking-[-0.03em]">₦1000</div>
            <button
              type="button"
              className="mt-auto rounded-xl border border-white/15 bg-white/10 py-3 text-[12px] font-semibold font-Rubik text-white transition hover:bg-white/15"
            >
              Claim Now
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 px-1">
          <Bell className="h-7 w-7 text-[#18e0a8]" fill="currentColor" />
          <span className="text-[24px] font-extrabold font-Rubik tracking-[-0.03em]">NOTIFICATIONS</span>
        </div>

        <div className="mt-4 overflow-hidden rounded-[28px] border border-white/10 bg-[#111a30] px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
          <table className="w-full table-fixed border-separate border-spacing-y-4">
            <colgroup>
              <col className="w-[116px]" />
              <col />
            </colgroup>
            <thead>
              <tr className="text-left text-[16px] font-bold font-Rubik text-white/55">
                <th className="px-4">Date</th>
                <th className="px-4">Message</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((item, index) => (
                <tr key={`${item.date}-${index}`} className="rounded-2xl bg-[#1a2238] text-[16px] font-Poppins text-white/80">
                  <td className="whitespace-nowrap rounded-l-2xl px-4 py-4">{item.date}</td>
                  <td className="truncate rounded-r-2xl px-4 py-4">{item.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center gap-2 px-1">
          <UserPlus className="h-6 w-6 text-[#18e0a8]" />
          <span className="text-[20px] font-bold font-Rubik tracking-[-0.03em]">REFERRALS</span>
        </div>

        <div className="mt-4 overflow-hidden rounded-[28px] border border-white/10 bg-[#111a30] px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
          <table className="w-full table-fixed border-separate border-spacing-y-4">
            <colgroup>
              <col />
              <col className="w-[96px]" />
              <col className="w-[72px]" />
              <col className="w-[88px]" />
            </colgroup>
            <thead>
              <tr className="text-left text-[16px] font-bold font-Rubik text-white/55">
                <th className="px-4">Username</th>
                <th className="px-4">Joined</th>
                <th className="px-4">Status</th>
                <th className="px-4">Earning</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((item, index) => (
                <tr
                  key={`${item.username}-${index}`}
                  className={`text-[16px] font-Poppins text-white/80 ${index % 2 === 0 ? 'bg-[#1a2238]' : 'bg-transparent'}`}
                >
                  <td className="truncate rounded-l-2xl px-4 py-4">{item.username}</td>
                  <td className="whitespace-nowrap px-4 py-4">{item.joined}</td>
                  <td className={`px-4 py-4 ${item.status === 'Active' ? 'text-[#18e0a8]' : 'text-[#f5b000]'}`}>{item.status}</td>
                  <td className="whitespace-nowrap rounded-r-2xl px-4 py-4">{item.earning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
