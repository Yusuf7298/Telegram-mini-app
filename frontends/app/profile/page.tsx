"use client";
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useRouter } from "next/navigation";
import Image from 'next/image';
import { Copy, Settings, ArrowLeft, Bell } from 'lucide-react';

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

export default function ProfilePage() {
   const router = useRouter();
  function handleClick() {
    router.back();
  }

  return (
    <div className="min-h-screen bg-gradient-to-bl from-[#0D2D2D] via-[#050B0D] to-[#050A0D] pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-gray-800 mb-2">
        <button onClick={handleClick} className="w-10 h-10 flex items-center justify-center rounded-full cursor-pointer bg-transparent border border-white/10 shadow text-white">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="text-white font-bold text-[16px]">Profile</div>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white">
          <Settings className="h-7 w-7 text-current m-2" />
        </button>
      </div>
      {/* Profile Card */}
      <div className="px-4">
        <Card className="bg-[#0F172A80] flex flex-col items-center py-6 mb-4">
          <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-[#1DE1B6] mb-2">
            <Image src="/images/users.png" alt="avatar" width={80} height={80} />
          </div>
          <div className="text-center">
            <div className="font-bold text-[14px] font-Rubik uppercase">SESKO</div>
            <div className="text-[#A1AFC3] text-[12px] font-Poppins">#OW415</div>
          </div>
          <div className="flex w-full mt-4 gap-2">
            <div className="flex-1 bg-[#232B3C] rounded-lg p-2 text-center">
              <div className="text-[#FFFFFF/80] text-[14px] font-Poppins">Friends</div>
              <div className="font-bold text-[16px] font-Rubik">₦1000</div>
            </div>
            <div className="flex-1 bg-[#232B3C] rounded-lg p-2 text-center">
              <div className="text-[#FFFFFF/80] text-[14px] font-Poppins">Total Earning</div>
              <div className="font-bold text-[16px] font-Rubik">₦1000</div>
            </div>
            <div className="flex-1 bg-[#232B3C] rounded-lg p-2 text-center">
              <div className="text-[#FFFFFF/80] text-[14px] font-Poppins">Balance</div>
              <div className="font-bold text-[16px] font-Rubik">₦1000</div>
            </div>
          </div>
        </Card>

        {/* Referral Code */}
        <Card className="bg-[#0F172A80] mb-4">
          <div className="font-extrabold text-white text-[16px] font-Rubik uppercase">Refer a Friend & Earn ₦5,000</div>
          <div className="text-[#A1AFC3] text-[14px] font-Poppins mb-1">Referral Code</div>
          <div className="flex items-center gap-2">
            <Input value="YOURCODE1234" readOnly className="bg-[#232B3C] border-none font-Poppins text-[14px] text-white/70" />
            <button className="p-2 rounded-lg 
            bg-linear-gradient(180deg, rgba(3, 221, 141, 0.3) 0%, rgba(2, 119, 76, 0.12) 100%)/10 border border-[#1DE1B6]">
              <Copy className="w-5 h-5 text-[#1DE1B6]" />
            </button>
          </div>
        </Card>

        {/* Earnings & Claim */}
        <div className="flex gap-2 mb-4">
          <Card className="flex-1 bg-[#0F172A80] flex flex-col gap-2">
            <div className="text-[#FFFFFF]/70 text-[12px] font-Poppins">Total Referral</div>
            <div className="font-medium text-[12px] text-[#FFFFFF]/70 font-Rubik">02</div>
            <div className="text-[#FFFFFF]/70 text-[12px] font-Poppins">Total Earning</div>
            <div className="font-bold text-[16px] font-Rubik ">₦1000</div>
          </Card>
          <Card className="flex-1 bg-[#0F172A80] flex flex-col gap-2 justify-between">
            <div>
              <div className="text-[#FFFFFF]/70 text-[12px] font-Poppins">Claimable Earning</div>
              <div className="font-bold text-[16px] font-Rubik">₦1000</div>
            </div>
            <Button className="mt-2 w-full bg-white/10 border border-white/20 px-4 py-2 rounded-lg text-[12px] font-medium text-white outline-none">Claim Now</Button>
          </Card>
        </div>

        {/* Notifications */}
        <div className="mt-6 mb-2 flex items-center gap-2">
          <Bell className="text-[#03DD8D] w-5 h-5" />
          <span className="font-bold text-white text-[20px] font-Rubik uppercase">NOTIFICATIONS</span>
        </div>
        <Card className="bg-[#0F172A80] mb-4 p-0 overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-[#A1AFC3] text-[12px] font-Rubik">
                <th className="py-2 px-4">Date</th>
                <th className="py-2 px-4">Message</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n, i) => (
                <tr key={i} className="border-t border-white/10 ">
                  <td className="py-2 px-4 whitespace-nowrap text-[12px] font-Poppins">{n.date}</td>
                  <td className="py-2 px-4 text-[12px] font-Poppins">{n.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Referrals */}
        <div className="mb-2 flex items-center gap-2">
          <span className="font-bold text-white text-[20px] font-Rubik">REFERRALS</span>
        </div>
        <Card className="bg-[#0F172A80] mb-4 p-0 overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-[#A1AFC3] text-[12px] font-Rubik">
                <th className="py-2 px-4">Username</th>
                <th className="py-2 px-4">Joined</th>
                <th className="py-2 px-4">Status</th>
                <th className="py-2 px-4">Earning</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r, i) => (
                <tr key={i} className="border-t border-white/10">
                  <td className="py-2 px-4 whitespace-nowrap text-[12px] font-Poppins">{r.username}</td>
                  <td className="py-2 px-4 whitespace-nowrap text-[12px] font-Poppins ">{r.joined}</td>
                  <td className={`py-2 px-4 whitespace-nowrap font-bold ${r.status === 'Active' ? 'text-[#1DE1B6]' : 'text-[#FFC700]'}`}>{r.status}</td>
                  <td className="py-2 px-4 whitespace-nowrap text-[12px] font-Poppins">{r.earning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
