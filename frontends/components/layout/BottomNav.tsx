"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Gift, Wallet, Trophy, User } from 'lucide-react';

const navItems = [
  { href: '/play', label: 'Play', icon: Gift },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/rewards', label: 'Rewards', icon: Trophy },
  { href: '/account', label: 'Account', icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#101B2A] border-t border-[#232B3C] flex justify-between px-2 py-1 h-16 md:hidden">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center flex-1 py-1 text-xs font-medium transition-colors ${active ? 'text-[#1DE1B6]' : 'text-gray-400'}`}
          >
            <Icon className="w-6 h-6 mb-0.5" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
