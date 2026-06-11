import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Repeat2, Swords } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { aggregateResponseCounts } from '@/lib/queries';
import type { EventWithCounts } from '@/lib/queries';

interface EventCardProps {
  event: EventWithCounts;
}

export function EventCard({ event }: EventCardProps) {
  const counts = aggregateResponseCounts(event.event_responses ?? []);
  const total = counts.attending + counts.declined + counts.undecided;

  return (
    <Link href={`/events/${event.id}`} className="block h-full hover:no-underline">
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full min-h-32">
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <CardTitle className="text-base leading-snug break-words">{event.title}</CardTitle>
            <div className="flex items-center gap-1 flex-wrap sm:justify-end">
              {event.raid_name && (
                <Badge variant="outline" className="flex items-center gap-1 shrink-0 text-xs">
                  <Swords className="w-3 h-3" />
                  {event.raid_name}
                </Badge>
              )}
              {event.is_recurring && (
                <Badge variant="secondary" className="flex items-center gap-1 shrink-0 text-xs">
                  <Repeat2 className="w-3 h-3" />
                  반복
                </Badge>
              )}
            </div>
          </div>
          <CardDescription className="flex items-center gap-1 text-xs leading-relaxed">
            <CalendarDays className="w-3 h-3" />
            {formatDateTime(event.scheduled_at)}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {event.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {event.description}
            </p>
          )}
          {/* 응답 현황 요약 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">응답 {total}명</span>
            {counts.attending > 0 && (
              <Badge variant="default" className="text-xs px-2 py-0">
                참석 {counts.attending}
              </Badge>
            )}
            {counts.declined > 0 && (
              <Badge variant="destructive" className="text-xs px-2 py-0">
                불참 {counts.declined}
              </Badge>
            )}
            {counts.undecided > 0 && (
              <Badge variant="secondary" className="text-xs px-2 py-0">
                미정 {counts.undecided}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
