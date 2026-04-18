import { ProgressBar } from "@/components/ui/ProgressBar";
import Image from "next/image";

export default function BonusProgress() {
  return (
    <div className="bg-[#101B2A] rounded-2xl p-4 flex items-center gap-4">
      <div className="flex-1">
        <div className="font-bold font-Rubik  text-white leading-tight text-[18px]">CRACK THE VAULT</div>
        <div className="text-gray-400 text-[14px] mb-2">Progress updates are shown in your live game session</div>
        <ProgressBar value={0} />
        <div className="text-[#B6F1E1] text-xs mt-2">Play to unlock campaign rewards</div>
      </div>
      <Image src="/images/vault.png" alt="Vault" width={90} height={90} />
    </div>
  );
}
