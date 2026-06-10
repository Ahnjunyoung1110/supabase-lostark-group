'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// ——————————————————————————————
// 반복 약속 생성 유틸리티
// ——————————————————————————————
const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

function buildRecurrenceRule(weekdays: number[], untilRaw: string | null): string {
  const byDay = weekdays.map((day) => WEEKDAY_CODES[day]).join(',');
  const parts = ['FREQ=WEEKLY', `BYDAY=${byDay}`];
  if (untilRaw) {
    const until = new Date(`${untilRaw}T23:59:59`).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    parts.push(`UNTIL=${until}`);
  } else {
    parts.push('COUNT=3');
  }
  return parts.join(';');
}

function buildRecurringOccurrences(
  scheduledAtRaw: string,
  weekdays: number[],
  untilRaw: string | null
): string[] {
  const start = new Date(scheduledAtRaw);
  const until = untilRaw ? new Date(`${untilRaw}T23:59:59`) : null;
  const occurrences: string[] = [];

  for (let week = 0; week < 3; week++) {
    for (const weekday of weekdays) {
      const occurrence = new Date(start);
      const daysUntilWeekday = (weekday - start.getDay() + 7) % 7;
      occurrence.setDate(start.getDate() + daysUntilWeekday + week * 7);

      if (occurrence < start) continue;
      if (until && occurrence > until) continue;

      occurrences.push(occurrence.toISOString());
    }
  }

  return Array.from(new Set(occurrences)).sort();
}

// ——————————————————————————————
// 약속 생성
// ——————————————————————————————
export async function createEvent(formData: FormData): Promise<void> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect('/auth/login');

  const title = formData.get('title') as string;
  const description = (formData.get('description') as string) || null;
  const raidName = (formData.get('raid_name') as string) || null;
  const scheduledAtRaw = formData.get('scheduled_at') as string;
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw).toISOString() : null;
  const isRecurring = formData.get('is_recurring') === 'on';
  const selectedWeekdays = formData
    .getAll('recurrence_weekdays')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  const recurrenceUntilRaw = (formData.get('recurrence_until') as string) || null;

  if (!title?.trim()) {
    throw new Error('제목은 필수입니다.');
  }

  if (isRecurring && !scheduledAtRaw) {
    throw new Error('반복 약속은 기준 일시가 필요합니다.');
  }

  const recurringWeekdays = selectedWeekdays.length > 0 && scheduledAtRaw
    ? selectedWeekdays
    : scheduledAtRaw
      ? [new Date(scheduledAtRaw).getDay()]
      : [];
  const recurrenceRule = isRecurring ? buildRecurrenceRule(recurringWeekdays, recurrenceUntilRaw) : null;
  const scheduledTimes = isRecurring && scheduledAtRaw
    ? buildRecurringOccurrences(scheduledAtRaw, recurringWeekdays, recurrenceUntilRaw)
    : [scheduledAt];

  if (scheduledTimes.length === 0) {
    throw new Error('생성할 반복 약속 일정이 없습니다. 종료일을 확인해 주세요.');
  }

  const rows = scheduledTimes.map((time) => ({
    title: title.trim(),
    description,
    raid_name: raidName,
    scheduled_at: time,
    created_by: user.id,
    is_recurring: isRecurring,
    recurrence_rule: recurrenceRule,
  }));

  const { data, error } = await supabase
    .from('events')
    .insert(rows)
    .select('id')
    .order('scheduled_at', { ascending: true })
    .limit(1);

  if (error) throw new Error(error.message);
  if (!data?.[0]?.id) throw new Error('생성된 약속 ID를 확인할 수 없습니다.');

  revalidatePath('/events');
  redirect(`/events/${data[0].id}`);
}

// ——————————————————————————————
// 참석 응답 upsert
// ——————————————————————————————
export async function upsertResponse(
  eventId: string,
  status: 'attending' | 'declined' | 'undecided'
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: '로그인이 필요합니다.' };

  const { error } = await supabase
    .from('event_responses')
    .upsert(
      { event_id: eventId, user_id: user.id, status },
      { onConflict: 'event_id,user_id' }
    );

  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}`);
  return {};
}

// ——————————————————————————————
// 약속 수정
// ——————————————————————————————
export async function updateEvent(
  eventId: string,
  formData: FormData
): Promise<void> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect('/auth/login');

  const title = formData.get('title') as string;
  const description = (formData.get('description') as string) || null;
  const raidName = (formData.get('raid_name') as string) || null;
  const scheduledAtRaw = formData.get('scheduled_at') as string;
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw).toISOString() : null;

  if (!title?.trim()) {
    throw new Error('제목은 필수입니다.');
  }

  const { error } = await supabase
    .from('events')
    .update({
      title: title.trim(),
      description,
      raid_name: raidName,
      scheduled_at: scheduledAt,
    })
    .eq('id', eventId);
  // RLS가 주최자만 update 허용

  if (error) throw new Error(error.message);

  revalidatePath(`/events/${eventId}`);
  revalidatePath('/events');
  redirect(`/events/${eventId}`);
}

// ——————————————————————————————
// 약속 삭제
// ——————————————————————————————
export async function deleteEvent(eventId: string): Promise<void> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect('/auth/login');

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);
  // RLS가 주최자만 delete 허용

  if (error) throw new Error(error.message);

  revalidatePath('/events');
  redirect('/events');
}

// ——————————————————————————————
// 시간 변경 제안 생성
// ——————————————————————————————
export async function createTimeProposal(
  eventId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: '로그인이 필요합니다.' };

  const proposedAtRaw = formData.get('proposed_at') as string;
  const proposedAt = proposedAtRaw ? new Date(proposedAtRaw).toISOString() : null;
  const message = ((formData.get('message') as string) || '').trim() || null;

  if (!proposedAt) {
    return { error: '새 일시를 입력해 주세요.' };
  }

  const { error } = await supabase
    .from('time_proposals')
    .insert({
      event_id: eventId,
      proposed_by: user.id,
      proposed_at: proposedAt,
      message,
    });

  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}`);
  return {};
}

// ——————————————————————————————
// 시간 변경 제안 확정/거절
// ——————————————————————————————
export async function applyTimeProposal(
  eventId: string,
  proposalId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: '로그인이 필요합니다.' };

  const { error } = await supabase.rpc('apply_time_proposal', {
    proposal_id: proposalId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}`);
  revalidatePath('/events');
  return {};
}

export async function rejectTimeProposal(
  eventId: string,
  proposalId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: '로그인이 필요합니다.' };

  const { error } = await supabase
    .from('time_proposals')
    .update({ status: 'rejected' })
    .eq('id', proposalId)
    .eq('status', 'pending');
  // RLS가 해당 약속 주최자만 update 허용

  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}`);
  return {};
}
