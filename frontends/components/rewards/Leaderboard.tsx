import { LeaderboardItem } from './LeaderboardItem';

interface Player {
  rank: number;
  username: string;
  friends: number;
  earnings: number;
}

interface LeaderboardProps {
  players: Player[];
}

export function Leaderboard({ players }: LeaderboardProps) {
  return (
    <div className="flex flex-col gap-2">
      {players.map(player => (
        <LeaderboardItem key={player.rank} {...player} />
      ))}
    </div>
  );
}
