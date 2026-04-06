import Image from 'next/image';

export function ReferralCard() {
  return (
    <div
      className="w-full bg-[#101B2A] rounded-2xl px-8 py-6 flex items-center justify-between"
    >
      <div className="flex flex-col flex-1 min-w-0">
        <div className="font-extrabold text-white text-[20px] leading-tight mb-2 tracking-tight">EARN N500</div>
        <div className="text-white text-[14px] font-normal leading-snug">
          Invite your friends to play & we’ll give you N500 for each player
        </div>
      </div>
      <div className="flex-shrink-0 ml-8">
        <Image src="/images/invite.png" alt="Invite" width={100} height={90}  />
      </div>
    </div>
  );
}
