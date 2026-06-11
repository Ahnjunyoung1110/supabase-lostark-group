import { type Roster } from '@/lib/queries';
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';

interface RosterListProps {
  roster: Roster;
  counts: { attending: number; declined: number; undecided: number };
}

function MemberList({
  members,
}: {
  members: Array<{ userId: string; nickname: string; avatarUrl: string | null }>;
}) {
  if (members.length === 0) {
    return <p className="text-xs text-muted-foreground">없음</p>;
  }

  return (
    <ul className="space-y-1">
      {members.map((member) => (
        <li key={member.userId} className="flex items-center gap-2 text-sm">
          {member.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.avatarUrl}
              alt={member.nickname}
              className="h-5 w-5 rounded-full object-cover"
            />
          )}
          <span className="break-words">{member.nickname}</span>
        </li>
      ))}
    </ul>
  );
}

export function RosterList({ roster, counts }: RosterListProps) {
  const total = counts.attending + counts.declined + counts.undecided;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center text-xs sm:hidden">
        <div>
          <p className="font-semibold text-green-600 dark:text-green-400">{counts.attending}</p>
          <p className="text-muted-foreground">참석</p>
        </div>
        <div>
          <p className="font-semibold text-red-600 dark:text-red-400">{counts.declined}</p>
          <p className="text-muted-foreground">불참</p>
        </div>
        <div>
          <p className="font-semibold text-muted-foreground">{counts.undecided}</p>
          <p className="text-muted-foreground">미정</p>
        </div>
        <p className="col-span-3 text-muted-foreground">총 {total}명 응답</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            참석 <span className="font-normal text-muted-foreground">({counts.attending}명)</span>
          </h3>
          <MemberList members={roster.attending} />
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            불참 <span className="font-normal text-muted-foreground">({counts.declined}명)</span>
          </h3>
          <MemberList members={roster.declined} />
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <HelpCircle className="h-4 w-4" />
            미정 <span className="font-normal">({counts.undecided}명)</span>
          </h3>
          <MemberList members={roster.undecided} />
        </div>
      </div>
    </div>
  );
}
