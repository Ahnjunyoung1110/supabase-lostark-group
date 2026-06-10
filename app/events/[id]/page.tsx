export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getEventWithResponses, aggregateResponseCounts, buildRoster } from '@/lib/queries';
import { formatDateTime, formatRelative } from '@/lib/format';
import { EventStatusBadge } from '@/components/status-badge';
import { ResponseButtons } from '@/components/response-buttons';
import { RosterList } from '@/components/roster-list';
import { DeleteEventButton } from '@/components/delete-event-button';
import { TimeProposalSection } from '@/components/time-proposal-section';
import { EventRealtimeRefresh } from '@/components/event-realtime-refresh';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Repeat2, Swords, User, ArrowLeft, Pencil } from 'lucide-react';

interface EventDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const event = await getEventWithResponses(id);
  if (!event) notFound();

  const counts = aggregateResponseCounts(event.event_responses ?? []);
  const roster = buildRoster(event.event_responses ?? []);
  const isOrganizer = user?.sub === event.created_by;

  // 현재 사용자의 응답 상태
  const myResponse = event.event_responses?.find((r) => r.user_id === user?.sub);
  const myStatus = myResponse?.status ?? null;

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <EventRealtimeRefresh eventId={event.id} />
      {/* 뒤로 */}
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/events" className="flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          목록으로
        </Link>
      </Button>

      {/* 약속 정보 */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{event.title}</h1>
              <EventStatusBadge status={event.status} />
              {event.raid_name && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Swords className="w-3 h-3" />
                  {event.raid_name}
                </Badge>
              )}
              {event.is_recurring && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Repeat2 className="w-3 h-3" />
                  반복
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <CalendarDays className="w-4 h-4" />
              {formatDateTime(event.scheduled_at)}
            </p>
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <User className="w-3 h-3" />
              주최자: {event.profiles?.nickname ?? '(알 수 없음)'}
              <span className="ml-2 text-xs">
                {formatRelative(event.created_at)} 생성
              </span>
            </p>
          </div>

          {/* 주최자 전용: 수정/삭제 */}
          {isOrganizer && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button asChild variant="outline" size="sm">
                <Link href={`/events/${event.id}/edit`} className="flex items-center gap-1.5">
                  <Pencil className="w-4 h-4" />
                  수정
                </Link>
              </Button>
              <DeleteEventButton eventId={event.id} />
            </div>
          )}
        </div>

        {event.description && (
          <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3 whitespace-pre-wrap">
            {event.description}
          </p>
        )}
      </div>

      {/* 내 응답 */}
      {user && (
        <div className="rounded-lg border p-4 bg-muted/30">
          <ResponseButtons
            eventId={event.id}
            currentStatus={myStatus as 'attending' | 'declined' | 'undecided' | null}
          />
        </div>
      )}

      {/* 집계 + 명단 */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          참석 현황
          <span className="text-sm font-normal text-muted-foreground ml-2">
            총 {(event.event_responses?.length ?? 0)}명 응답
          </span>
        </h2>
        <RosterList roster={roster} counts={counts} />
      </div>

      {/* 시간 변경 제안 */}
      {user && (
        <TimeProposalSection
          eventId={event.id}
          proposals={event.time_proposals ?? []}
          isOrganizer={isOrganizer}
        />
      )}
    </div>
  );
}
