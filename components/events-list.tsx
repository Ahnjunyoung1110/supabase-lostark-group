'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EventCard } from '@/components/event-card';
import { EventsBulkDeleteBar } from '@/components/events-bulk-delete-bar';
import { Plus, CalendarDays } from 'lucide-react';
import type { EventWithCounts } from '@/lib/queries';

interface EventsListProps {
  upcoming: EventWithCounts[];
  past: EventWithCounts[];
  currentUserId: string | null;
}

function SelectableEventCard({
  event,
  isOrganizer,
  isSelected,
  onToggle,
}: {
  event: EventWithCounts;
  isOrganizer: boolean;
  isSelected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="relative h-full">
      {isOrganizer && (
        // 체크박스 컨테이너: Link 버블링 방지, 44px 터치 영역
        <label
          className="absolute left-2 top-2 z-10 flex h-11 w-11 cursor-pointer items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggle(event.id);
            }}
            className="h-4 w-4 rounded border-primary accent-primary"
            aria-label={`${event.title} 선택`}
          />
        </label>
      )}
      <EventCard event={event} hasCheckbox={isOrganizer} isSelected={isSelected} />
    </div>
  );
}

export function EventsList({ upcoming, past, currentUserId }: EventsListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isOrganizer = (event: EventWithCounts) =>
    !!currentUserId && event.created_by === currentUserId;

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

      {/* 일괄 삭제 액션 바 */}
      <EventsBulkDeleteBar
        selectedIds={Array.from(selectedIds)}
        onClear={clearSelection}
      />

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
              <SelectableEventCard
                key={event.id}
                event={event}
                isOrganizer={isOrganizer(event)}
                isSelected={selectedIds.has(event.id)}
                onToggle={toggleSelect}
              />
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
              <SelectableEventCard
                key={event.id}
                event={event}
                isOrganizer={isOrganizer(event)}
                isSelected={selectedIds.has(event.id)}
                onToggle={toggleSelect}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
