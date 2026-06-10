/**
 * Supabase 쿼리 헬퍼 및 데이터 집계 유틸리티
 */
import { createClient } from '@/lib/supabase/server';
import { isUpcoming } from '@/lib/format';

// ——————————————————————————————
// 타입 정의
// ——————————————————————————————

export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  raid_name: string | null;
  scheduled_at: string | null;
  created_by: string;
  is_recurring: boolean;
  recurrence_rule: string | null;
  status: 'scheduled' | 'cancelled' | 'done';
  created_at: string;
  updated_at: string;
};

export type EventWithCounts = EventRow & {
  event_responses: { status: string }[];
};

export type ResponseWithProfile = {
  id: string;
  status: 'attending' | 'declined' | 'undecided';
  user_id: string;
  updated_at: string;
  profiles: {
    nickname: string | null;
    avatar_url: string | null;
  } | null;
};

export type TimeProposalWithProfile = {
  id: string;
  event_id: string;
  proposed_by: string;
  proposed_at: string;
  message: string | null;
  status: 'pending' | 'applied' | 'rejected';
  created_at: string;
  profiles: {
    nickname: string | null;
    avatar_url: string | null;
  } | null;
};

export type EventDetail = EventRow & {
  profiles: { nickname: string | null; avatar_url: string | null } | null;
  event_responses: ResponseWithProfile[];
  time_proposals: TimeProposalWithProfile[];
};

export type ResponseCounts = {
  attending: number;
  declined: number;
  undecided: number;
};

export type Roster = {
  attending: { userId: string; nickname: string; avatarUrl: string | null }[];
  declined:  { userId: string; nickname: string; avatarUrl: string | null }[];
  undecided: { userId: string; nickname: string; avatarUrl: string | null }[];
};

// ——————————————————————————————
// 쿼리 함수
// ——————————————————————————————

/**
 * 모든 이벤트 조회 (응답 상태 카운트용 임베드 포함)
 * scheduled_at 오름차순 정렬
 */
export async function getEvents(): Promise<EventWithCounts[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .select('*, event_responses ( status )')
    .order('scheduled_at', { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as EventWithCounts[];
}

/**
 * 이벤트 목록을 다가오는/지난 약속으로 분리
 */
export function splitEvents(events: EventWithCounts[]) {
  const upcoming: EventWithCounts[] = [];
  const past: EventWithCounts[] = [];
  for (const e of events) {
    if (isUpcoming(e.scheduled_at)) {
      upcoming.push(e);
    } else {
      past.push(e);
    }
  }
  // 다가오는 약속: 가까운 순, 지난 약속: 최근 순(내림차순)
  past.sort((a, b) => {
    if (!a.scheduled_at) return 1;
    if (!b.scheduled_at) return -1;
    return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
  });
  return { upcoming, past };
}

/**
 * 이벤트 상세 조회 (주최자 프로필 + 응답+멤버 프로필 포함)
 */
export async function getEventWithResponses(id: string): Promise<EventDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      profiles ( nickname, avatar_url ),
      event_responses (
        id,
        status,
        user_id,
        updated_at,
        profiles ( nickname, avatar_url )
      ),
      time_proposals (
        id,
        event_id,
        proposed_by,
        proposed_at,
        message,
        status,
        created_at,
        profiles ( nickname, avatar_url )
      )
    `)
    .eq('id', id)
    .single();

  if (error) return null;
  return data as EventDetail;
}

// ——————————————————————————————
// 집계 순수 함수
// ——————————————————————————————

/**
 * 응답 배열에서 상태별 카운트 반환
 */
export function aggregateResponseCounts(
  responses: { status: string }[]
): ResponseCounts {
  return responses.reduce<ResponseCounts>(
    (acc, r) => {
      if (r.status === 'attending') acc.attending++;
      else if (r.status === 'declined') acc.declined++;
      else acc.undecided++;
      return acc;
    },
    { attending: 0, declined: 0, undecided: 0 }
  );
}

/**
 * 응답 배열을 상태별 멤버 명단으로 그룹핑
 */
export function buildRoster(responses: ResponseWithProfile[]): Roster {
  const roster: Roster = { attending: [], declined: [], undecided: [] };
  for (const r of responses) {
    const entry = {
      userId: r.user_id,
      nickname: r.profiles?.nickname ?? '(알 수 없음)',
      avatarUrl: r.profiles?.avatar_url ?? null,
    };
    if (r.status === 'attending') roster.attending.push(entry);
    else if (r.status === 'declined') roster.declined.push(entry);
    else roster.undecided.push(entry);
  }
  return roster;
}
