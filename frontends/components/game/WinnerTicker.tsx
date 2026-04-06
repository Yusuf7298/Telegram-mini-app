import Image from "next/image";
interface Winner {
  username: string;
  amount: string;
  avatar: string;
}

const winners: Winner[] = [
  { username: "AB", amount: "₦1,000", avatar: "/avatars/ab.png" },
  { username: "DE", amount: "₦10,000", avatar: "/avatars/de.png" },
  { username: "AB", amount: "₦1,000", avatar: "/avatars/ab2.png" },
  { username: "DE", amount: "₦1,000", avatar: "/avatars/de2.png" },
];

export default function WinnerTicker() {
  return (
    <div className="flex justify-center gap-2 mt-2">
      {winners.map((winner, idx) => (
        <div key={idx} className="flex flex-col items-center">
          <Image
            src={winner.avatar}
            alt={winner.username}
            className="w-14 h-14 rounded-full object-cover border-2 border-[#222] mb-1"
            style={{ background: '#222' }}
            width={56}
            height={56}
          />
          <div className="text-white text-xs font-medium text-center whitespace-nowrap">
            {winner.username} <span className="font-normal">won {winner.amount}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
