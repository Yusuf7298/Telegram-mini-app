"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Play, Wallet, Gift, User, Home } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home},
  { href: "/play", label: "Play", icon: Play },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/rewards", label: "Rewards", icon: Gift },
  { href: "/account", label: "Account", icon: User },
];

export default function BottomNavigation() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#101B2A] border-t border-[#232B3C] flex justify-between px-2 py-1 shadow-md md:hidden">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center flex-1 py-1 ${active ? 'text-blue-400 font-bold' : 'text-gray-400'}`}
          >
            <Icon className={`w-6 h-6 mb-0.5 ${active ? 'stroke-2' : 'stroke-1'}`} />
            <span className="text-xs">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
