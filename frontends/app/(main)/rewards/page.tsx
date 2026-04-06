"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, BellIcon, Clock, Trophy, Award } from "lucide-react";

export default function RewardPage() {
  // Example state for progress bars
  const [boxesOpened] = useState(2);
  const totalBoxes = 5;
  const [offerBoxesOpened] = useState(1);
  const offerTotalBoxes = 10;
  const router = useRouter();

  function handleClick() {
    router.back();
  }

  return (
    <div className="min-h-screen bg-gradient-to-bl from-[#2C5364] via-[#000000] to-[#020617] pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-gray-800 mb-2">
        <button onClick={handleClick} className="w-10 h-10 flex items-center justify-center rounded-full cursor-pointer bg-transparent border border-white/10 shadow text-white">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="text-white font-bold text-[16px]">Reward</div>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white">
          <BellIcon className="h-7 w-7 text-current m-2" />
        </button>
      </div>

      {/* Bonus Card */}
      <div className="mx-4 mb-4 p-4 rounded-2xl bg-[#16263a] border border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24">
            <rect x="2" y="7" width="20" height="12" rx="3" fill="#00FFB2" />
            <rect x="7" y="3" width="10" height="5" rx="2" fill="#00FFB2" />
            <rect x="11" y="3" width="2" height="16" rx="1" fill="#fff" />
            <rect x="2" y="17" width="20" height="2" rx="1" fill="#00FFB2" />
          </svg>
          <span className="font-extrabold text-white text-[14px] uppercase font-Rubik tracking-tight">Claim your ₦1,000 bonus</span>
        </div>
        <div className="flex items-center gap-2 mb-2 mt-2">
          {Array.from({ length: totalBoxes }).map((_, idx) => (
            <div
              key={idx}
              className={`h-2 flex-1 rounded-full ${idx < boxesOpened ? 'bg-[#00FFB2]' : 'bg-[#193040]'}`}
            />
          ))}
        </div>
        <div className="flex justify-between text-white/60 text-[14px] font-Poppins font-medium mt-1">
          <span>Boxes Opened</span>
          <span>{boxesOpened}/{totalBoxes}</span>
        </div>
      </div>

      {/* Limited Time Offer */}
      <div className="mx-4 mb-4 p-4 rounded-2xl border border-white/10" style={{
        background: 'linear-gradient(243.36deg, #D24444 19.93%, #A43872 33.73%, #020617 53.01%, #020617 65.52%), linear-gradient(0deg, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4))'
      }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center gap-1 text-[14px] font-medium font-Poppins text-white/80 bg-black/30 rounded px-2 py-1">
            <Clock className="w-4 h-4 text-white" />
            Limited Time Offer
          </span>
        </div>
        <div className="flex items-center gap-2 font-extrabold text-white text-[14px] font-Rubik tracking-tight mb-2">
          <Trophy className="w-6 h-6" style={{ color: '#00FFB2' }} fill="#00FFB2" />
          Play 10, GeT ₦10,000 Free BOXES
        </div>
        {/* Segmented progress bar */}
        <div className="flex items-center gap-2 mb-2 mt-2">
          {Array.from({ length: offerTotalBoxes }).map((_, idx) => (
            <div
              key={idx}
              className={`h-3 flex-1 rounded-full ${idx < offerBoxesOpened ? 'bg-white' : 'bg-[#193040]'}`}
            />
          ))}
        </div>
        <div className="flex justify-between text-white/60 text-[14px] font-Poppins mt-1">
          <span>Boxes Opened</span>
          <span>{offerBoxesOpened}/{offerTotalBoxes}</span>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="mx-4 mt-6">
        <div className="flex items-center gap-2 mb-0">
          <Award className="w-7 h-7" style={{ color: '#00FFB2' }} />
          <span className="font-extrabold text-white text-[20px] uppercase tracking-tight font-Rubik">Leaderboard</span>
        </div>
        <div className="text-white text-[14px] font-Poppins font-regular mb-4">Earn Extra Rewards For Finishing In The Top 3</div>
        <div className="flex gap-4 mb-6 bg-[#101B2A] rounded-2xl p-4">
          {/* Top 3 Avatars with badges - Placeholders matching screenshot */}
          <div className="flex-1 flex flex-col items-center bg-gradient-to-br from-[#1a2a38] to-[#2a3a48] rounded-2xl p-3 border border-[#22d3aa] relative mt-3 shadow-lg">
            <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#222] flex items-center justify-center text-white font-medium font-Rubik text-[12px] border-2 border-[#22d3aa]">2</div>
            <div className="rounded-full mb-2 overflow-hidden w-14 h-14 border-2 border-[#22d3aa]">
              <Image src="/images/background.png" alt="2nd" width={56} height={56} className="object-cover w-full h-full" />
            </div>
            <div className="text-[#22d3aa] font-medium font-Rubik text-[14px]">#uenr</div>
            <div className="text-white text-[12px] font-bold font-Poppins">₦5,000</div>
          </div>
            <div className="flex-1 flex flex-col items-center rounded-2xl p-3 border-4 border-[#fff] relative mt-0 shadow-md" style={{
              background: 'linear-gradient(0deg, rgba(30, 41, 59, 0.5), rgba(30, 41, 59, 0.5)), linear-gradient(180deg, rgba(220, 71, 45, 0.5) 0%, rgba(220, 71, 45, 0) 100%)'
            }}>
            <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#F15F79] flex items-center justify-center text-white font-medium font-Rubik text-[12px] border-2 border-[#fff]">1</div>
            <div className="rounded-full mb-2 overflow-hidden w-14 h-14 border-2 border-[#fff]">
              <Image src="/images/coin.png" alt="1st" width={56} height={56} className="object-cover w-full h-full" />
            </div>
            <div className="text-[#fff] font-medium font-Rubik text-[14px]">#uenr</div>
            <div className="text-white text-[12px] font-bold font-Poppins">₦10,000</div>
          </div>
          <div className="flex-1 flex flex-col items-center rounded-2xl p-3 border border-[#FFD600] relative mt-3 shadow-md" style={{
            background: 'linear-gradient(0deg, rgba(30, 41, 59, 0.5), rgba(30, 41, 59, 0.5)), linear-gradient(180deg, rgba(232, 156, 40, 0.5) 0%, rgba(130, 87, 22, 0) 100%)'
          }}>
            <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#FFD600] flex items-center justify-center text-white font-medium font-Rubik text-[12px] border-2 border-[#fff]">3</div>
            <div className="rounded-full mb-2 overflow-hidden w-14 h-14 border-2 border-[#FFD600]">
              <Image src="/images/vault.png" alt="3rd" width={56} height={56} className="object-cover w-full h-full" />
            </div>
            <div className="text-[#B97B2B] font-medium font-Rubik text-[14px]">#uenr</div>
            <div className="text-white text-[12px] font-bold font-Poppins">₦1,000</div>
          </div>
        </div>
        <div className="flex gap-6 mb-6 bg-[#101B2A] rounded-2xl p-6 justify-center mt-4">
          {/* Leaderboard Table */}
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full text-white/80 text-base table-fixed">
              <colgroup>
                <col className="w-1/4" />
                <col className="w-1/4" />
                <col className="w-1/4" />
                <col className="w-1/4" />
              </colgroup>
              <thead>
                <tr className="bg-[#101B2A]">
                  <th className="py-3 px-4 font-regular font-Rubik text-[12px] text-left">Rank</th>
                  <th className="py-3 px-4 font-regular font-Rubik text-[12px] text-left">Username</th>
                  <th className="py-3 px-4 font-regular font-Rubik text-[12px] text-left">Friends</th>
                  <th className="py-3 px-4 font-regular font-Rubik text-[12px] text-left">Earning</th>
                </tr>
              </thead>
              <tbody>
                {/* Top 3 users as in the UI */}
                <tr className="bg-transparent">
                  <td className="py-3 px-4 font-Poppins text-[12px]">4</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">@ahef</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">20+</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">₦50,000</td>
                </tr>
                <tr className="bg-[#16263a]">
                  <td className="py-3 px-4 font-Poppins text-[12px]">5</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">@ahef</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">25</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">₦50,000</td>
                </tr>
                <tr className="bg-transparent">
                  <td className="py-3 px-4 font-Poppins text-[12px]">6</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">@ahef</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">50</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">₦50,000</td>
                </tr>
                <tr className="bg-[#16263a]">
                  <td className="py-3 px-4 font-Poppins text-[12px]">7</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">@ahef</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">4</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">₦50,000</td>
                </tr>
                <tr className="bg-transparent">
                  <td className="py-3 px-4 font-Poppins text-[12px]">8</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">@ahef</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">4</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">₦50,000</td>
                </tr>
                <tr className="bg-[#16263a]">
                  <td className="py-3 px-4 font-Poppins text-[12px]">9</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">@ahef</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">4</td>
                  <td className="py-3 px-4 font-Poppins text-[12px]">₦50,000</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
