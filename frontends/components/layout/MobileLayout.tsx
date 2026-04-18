import React from 'react';
import BottomNavigation from '@/components/layout/BottomNavigation';
import NotificationCenter from '@/components/notification/NotificationCenter';

interface MobileLayoutProps {
  children: React.ReactNode;
}

export default function MobileLayout({ children }: MobileLayoutProps) {
  return (
    <div className="flex justify-center bg-black min-h-screen overflow-x-hidden">
      <div className="w-full max-w-[393px] h-[1243px] bg-[#07101C] flex flex-col relative">
        <div className="fixed right-4 top-4 z-50">
          <NotificationCenter />
        </div>
        <div className="flex-1 overflow-y-auto pb-[90px]">
          {children}
        </div>
        <div className="absolute bottom-0 left-0 right-0 w-full max-w-[393px] mx-auto">
          <BottomNavigation />
        </div>
      </div>
    </div>
  );
}
