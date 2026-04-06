interface LeaderboardItemProps {
  rank: number;
  username: string;
  friends: number;
  earnings: number;
}

export function LeaderboardItem({ rank, username, friends, earnings }: LeaderboardItemProps) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl shadow ${rank <= 3 ? 'bg-yellow-50' : 'bg-white'}`}>
      <div className={`font-bold text-lg w-8 text-center ${rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-gray-400' : rank === 3 ? 'text-orange-400' : 'text-gray-500'}`}>{rank}</div>
      <div className="flex-1">
        <div className="font-semibold">{username}</div>
        <div className="text-xs text-gray-400">Friends: {friends}</div>
      </div>
      <div className="font-bold text-blue-700">₦{earnings}</div>
    </div>
  );
}
