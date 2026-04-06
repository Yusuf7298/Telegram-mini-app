import { UserCircle } from 'lucide-react';
import Image from 'next/image';

import { Bell } from 'lucide-react';

export function Header({ title = "Home" }: { title?: string }) {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-black w-full border-b border-white/20" style={{ minHeight: 72 }}>
      {/* Left: Circular Logo */}
      <div className="flex items-center">
        <div className="w-14 h-14 rounded-full bg-[#1DE1B6] flex items-center justify-center border-2 border-white">
          <span className="text-white font-bold text-lg">LOGO</span>
        </div>
      </div>
      {/* Center: Title */}
      <div className="flex-1 flex justify-center">
        <span className="text-white font-bold text-2xl">{title}</span>
      </div>
      {/* Right: Circular Notification Icon */}
      <div className="flex items-center">
        <button className="w-14 h-14 rounded-full bg-[#1DE1B6] flex items-center justify-center border-2 border-white">
          <Bell className="w-7 h-7 text-white" />
        </button>
      </div>
    </header>
  );
}
