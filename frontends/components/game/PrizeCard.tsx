import { Card } from '@/components/ui/Card';
import Image from 'next/image';

// Professional gradients for each prize type
const gradients = [
  'bg-gradient-to-br from-[#B97B2B] to-[#7C5520]', // gold
  'bg-gradient-to-br from-[#1CB5E0] to-[#000046]', // blue
  'bg-gradient-to-br from-[#F15F79] to-[#B24592]', // pink
  'bg-gradient-to-br from-[#FFD200] to-[#F7971E]', // yellow
];

interface PrizeCardProps {
  prize: string;
  image?: string;
  index?: number;
}

export function PrizeCard({ prize, image, index = 0 }: PrizeCardProps) {
  const imageSrc = image && !image.startsWith("/") ? `/${image}` : image;
  let boxSize = "w-[140px] h-[140px] min-w-[140px]";
  const gradient = prize.toLowerCase().includes('airtime')
    ? gradients[3]
    : gradients[index % gradients.length];

  return (
    <Card className={`relative flex flex-col items-center justify-center ${boxSize} p-4 ${gradient} rounded-2xl shadow-xl border border-white/10 transition-transform hover:scale-105`}>
      {/* Always show badge icon, color by prize */}
      <div className="absolute top-3 right-3 w-8 h-8 bg-white/30 rounded-lg flex items-center justify-center shadow">
        {prize.toLowerCase().includes('airtime') ? (
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect width="20" height="20" rx="4" fill="#fff"/><path d="M8 12h8v2H8v-2z" fill="#FFD200"/></svg>
        ) : index % gradients.length === 0 ? (
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect width="20" height="20" rx="4" fill="#fff"/><path d="M7 7h6v2H7V7zm0 4h6v2H7v-2zm0 4h6v2H7v-2z" fill="#B97B2B"/></svg>
        ) : index % gradients.length === 1 ? (
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect width="20" height="20" rx="4" fill="#fff"/><path d="M12 7v10m5-5H7" stroke="#1CB5E0" strokeWidth="2"/></svg>
        ) : (
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect width="20" height="20" rx="4" fill="#fff"/><circle cx="12" cy="12" r="5" fill="#F15F79"/></svg>
        )}
      </div>
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={prize}
          width={56}
          height={56}
          className="w-[56px] h-[56px] object-contain mb-4 drop-shadow-lg"
        />
      ) : (
        <div className="w-[56px] h-[56px] bg-yellow-100 rounded-full flex items-center justify-center mb-4 text-3xl">🎁</div>
      )}
      <div className="text-center text-base font-bold text-white mt-auto mb-2 drop-shadow-lg tracking-tight">
        {prize}
      </div>
    </Card>
  );
}
