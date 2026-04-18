import Image from "next/image";
import NotificationCenter from "@/components/notification/NotificationCenter";

interface HeaderProps {
  user?: { username?: string | null; profilePhotoUrl?: string | null };
  title?: string;
}

export default function Header({ user, title }: HeaderProps) {
  const avatar = user?.profilePhotoUrl || "/logo.png";
  return (
    <div className="mb-4 mt-4 flex items-center justify-between gap-3 border-b border-[#232B3C] px-4 py-4">
      <div className="mr-auto flex items-center gap-3 text-left">
        <Image src={avatar} alt="Avatar" width={40} height={40} className="rounded-full border-2 border-green-400" />
      </div>
      <div className="flex items-center gap-3">
        <p className="text-[16px] font-bold text-white">{title}</p>
        <NotificationCenter />
      </div>
    </div>
  );
}
