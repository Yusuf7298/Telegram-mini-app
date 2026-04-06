interface ReferralUser {
  username: string;
  date: string;
}

interface ReferralListProps {
  users: ReferralUser[];
}

export function ReferralList({ users }: ReferralListProps) {
  return (
    <div className="flex flex-col gap-2">
      {users.map((user, idx) => (
        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white shadow">
          <div className="font-semibold">{user.username}</div>
          <div className="text-xs text-gray-400">{user.date}</div>
        </div>
      ))}
    </div>
  );
}
