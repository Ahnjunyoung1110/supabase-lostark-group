export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EventCard } from '@/components/event-card';
import { getEvents, splitEvents } from '@/lib/queries';
import { Plus, CalendarDays } from 'lucide-react';

export default async function EventsPage() {
  const events = await getEvents();
  const { upcoming, past } = splitEvents(events);

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">약속 목록</h1>
          <p className="text-muted-foreground text-sm mt-1">
            레이드 약속을 만들고 멤버들의 참석 여부를 확인하세요.
          </p>
        </div>
        <Button asChild className="min-h-11 w-full sm:w-auto">
          <Link href="/events/new" className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            약속 만들기
          </Link>
        </Button>
      </div>

      {/* 다가오는 약속 */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          다가오는 약속
          <span className="text-sm font-normal text-muted-foreground">
            ({upcoming.length}건)
          </span>
        </h2>
        {upcoming.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <p>다가오는 약속이 없습니다.</p>
            <Button asChild variant="link" className="mt-2">
              <Link href="/events/new">첫 번째 약속 만들기 →</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {/* 지난 약속 */}
      {past.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
            지난 약속
            <span className="text-sm font-normal ml-2">({past.length}건)</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 opacity-70 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {past.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
