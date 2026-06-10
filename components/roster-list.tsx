import { type Roster } from '@/lib/queries';
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';

interface RosterListProps {
  roster: Roster;
  counts: { attending: number; declined: number; undecided: number };
}

export function RosterList({ roster, counts }: RosterListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 참석 */}
      <div className="rounded-lg border p-4">
        <h3 className="flex items-center gap-2 font-semibold text-sm mb-3 text-green-600 dark:text-green-400">
          <CheckCircle className="w-4 h-4" />
          참석 <span className="text-muted-foreground font-normal">({counts.attending}명)</span>
        </h3>
        {roster.attending.length === 0 ? (
          <p className="text-xs text-muted-foreground">없음</p>
        ) : (
          <ul className="space-y-1">
            {roster.attending.map((m) => (
              <li key={m.userId} className="text-sm flex items-center gap-2">
                {m.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.avatarUrl}
                    alt={m.nickname}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                )}
                {m.nickname}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 불참 */}
      <div className="rounded-lg border p-4">
        <h3 className="flex items-center gap-2 font-semibold text-sm mb-3 text-red-600 dark:text-red-400">
          <XCircle className="w-4 h-4" />
          불참 <span className="text-muted-foreground font-normal">({counts.declined}명)</span>
        </h3>
        {roster.declined.length === 0 ? (
          <p className="text-xs text-muted-foreground">없음</p>
        ) : (
          <ul className="space-y-1">
            {roster.declined.map((m) => (
              <li key={m.userId} className="text-sm flex items-center gap-2">
                {m.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.avatarUrl}
                    alt={m.nickname}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                )}
                {m.nickname}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 미정 */}
      <div className="rounded-lg border p-4">
        <h3 className="flex items-center gap-2 font-semibold text-sm mb-3 text-muted-foreground">
          <HelpCircle className="w-4 h-4" />
          미정 <span className="font-normal">({counts.undecided}명)</span>
        </h3>
        {roster.undecided.length === 0 ? (
          <p className="text-xs text-muted-foreground">없음</p>
        ) : (
          <ul className="space-y-1">
            {roster.undecided.map((m) => (
              <li key={m.userId} className="text-sm flex items-center gap-2">
                {m.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.avatarUrl}
                    alt={m.nickname}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                )}
                {m.nickname}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
