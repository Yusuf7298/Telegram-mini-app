import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getGameConfig } from '@/lib/gameConfigApi';

export function ReferralCard() {
  const [rewardAmount, setRewardAmount] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadRewardAmount = async () => {
      try {
        const response = await getGameConfig();
        const config = response.data.data;
        if (active) {
          setRewardAmount(String(config.referralRewardAmount));
        }
      } catch {
        if (active) {
          setRewardAmount(null);
        }
      }
    };

    void loadRewardAmount();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className="w-full bg-[#101B2A] rounded-2xl px-8 py-6 flex items-center justify-between"
    >
      <div className="flex flex-col flex-1 min-w-0">
        <div className="font-extrabold text-white text-[20px] leading-tight mb-2 tracking-tight">
          Earn {rewardAmount ? `₦${rewardAmount}` : 'referral rewards'} per activation
        </div>
        <div className="text-white text-[14px] font-normal leading-snug">
          Invite your friends to play and unlock rewards from live campaign settings.
        </div>
      </div>
      <div className="flex-shrink-0 ml-8">
        <Image src="/images/invite.png" alt="Invite" width={100} height={90}  />
      </div>
    </div>
  );
}
