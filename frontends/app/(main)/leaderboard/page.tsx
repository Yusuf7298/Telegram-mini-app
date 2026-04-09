"use client";

const leaderboard = [
  { rank: 1, username: "Jane", score: 12000, reward: 10000 },
  { rank: 2, username: "Sam", score: 9000, reward: 5000 },
  { rank: 3, username: "Alex", score: 7000, reward: 2000 },
  { rank: 4, username: "Mary", score: 5000, reward: 1000 },
  { rank: 5, username: "John", score: 3000, reward: 500 },
];

const rankStyles = [
  "bg-gradient-to-r from-yellow-400 to-yellow-200 text-yellow-900",
  "bg-gradient-to-r from-gray-400 to-gray-200 text-gray-900",
  "bg-gradient-to-r from-orange-400 to-orange-200 text-orange-900",
];

export default function LeaderboardPage() {
  return (
    <div className="px-4 flex flex-col items-center">
      <div className="w-full max-w-sm bg-[#101B2A] rounded-2xl shadow-lg p-6 flex flex-col items-center mt-8 mb-4">
        <h1 className="text-2xl font-bold text-white mb-4">Leaderboard</h1>
        <div className="w-full">
          <div className="flex font-bold text-gray-300 border-b border-[#232B3C] pb-2 mb-2">
            <div className="w-10">Rank</div>
            <div className="flex-1">Username</div>
            <div className="w-16 text-right">Score</div>
            <div className="w-16 text-right">Reward</div>
          </div>
          {leaderboard.map((player, i) => (
            <div
              key={player.rank}
              className={`flex items-center py-2 px-2 mb-2 rounded-lg ${i < 3 ? rankStyles[i] : "bg-[#19233A] text-white"}`}
            >
              <div className="w-10 font-bold">{player.rank}</div>
              <div className="flex-1 font-semibold">{player.username}</div>
              <div className="w-16 text-right">{player.score}</div>
              <div className="w-16 text-right text-green-400 font-bold">₦{player.reward}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
