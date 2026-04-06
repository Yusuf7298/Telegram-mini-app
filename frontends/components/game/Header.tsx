import Image from "next/image";
import { BellIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
  user?: { username: string; avatar: string };
}

export default function Header({ user, title }: HeaderProps) {
  const avatar = user?.avatar || "/logo.png";
  const username = user?.username || "User";
  return (
    <div className="flex justify-space-between gap-3 px-4 py-4 border-b border-[#232B3C] mb-4 mt-4  pl-4 pr-4">
      <div className="text-left mr-auto items-center gap-3">
        <Image src={avatar} alt="Avatar" width={40} height={40} className="rounded-full border-2 border-green-400" />
        {/* <p className="text-white font-bold text-xs mr-2">{username}</p> */}
      </div>
      <div className="flex flex-3 items-center gap-1">
        <p className="text-white font-bold text-[16px] mr-30 ml-20">{title}</p>
        <BellIcon className="h-7 w-7 text-current m-2 mr-0 direction-ltr" />
      </div>
    </div>
  );
}
