'use server';

import { createClient } from '@/lib/supabase/server';
import {
  buildDiscordBotMessagePayload,
  buildDiscordWebhookPayload,
  buildEventDetailUrl,
  normalizeSiteUrl,
} from '@/lib/discord/share-message';
import { revalidatePath } from 'next/cache';

type ActionResult = {
  error?: string;
  redirectTo?: string;
};

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

  for (let week = 0; ; week++) {
    if (!until && week >= 3) break;

    // start + week*7 는 해당 주의 가장 이른 기준일 — 이미 until 초과 시 중단
    const weekBase = new Date(start);
    weekBase.setDate(start.getDate() + week * 7);
    if (until && weekBase > until) break;

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

function getProfileDefaults(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
  const metadata = user.user_metadata ?? {};
  const nickname =
    typeof metadata.full_name === 'string' && metadata.full_name.trim()
      ? metadata.full_name
      : typeof metadata.name === 'string' && metadata.name.trim()
        ? metadata.name
        : user.email?.split('@')[0] ?? null;

  return {
    id: user.id,
    nickname,
    avatar_url: typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null,
  };
}

async function ensureProfile(supabase: Awaited<ReturnType<typeof createClient>>, user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
  const { error } = await supabase
    .from('profiles')
    .upsert(getProfileDefaults(user), { onConflict: 'id', ignoreDuplicates: true });

  if (error) throw new Error(`프로필 생성에 실패했습니다: ${error.message}`);
}

function isMissingProfileForeignKeyError(error: { code?: string; message?: string; details?: string | null }) {
  return (
    error.code === '23503' &&
    (error.message?.includes('events_created_by_fkey') ||
      error.details?.includes('events_created_by_fkey') ||
      error.message?.includes('violates foreign key constraint'))
  );
}

type EventInsertRow = {
  title: string;
  description: string | null;
  raid_name: string | null;
  scheduled_at: string | null;
  created_by: string;
  is_recurring: boolean;
  recurrence_rule: string | null;
};

async function insertEventRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: EventInsertRow[]
) {
  if (rows.length === 1) {
    const { data, error } = await supabase
      .from('events')
      .insert(rows[0])
      .select('id, scheduled_at')
      .single();

    return { data: data ? [data] : null, error };
  }

  return supabase
    .from('events')
    .insert(rows)
    .select('id, scheduled_at');
}

// ——————————————————————————————
// 약속 생성
// ——————————————————————————————
export async function createEvent(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { redirectTo: '/auth/login' };

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
    return { error: '제목은 필수입니다.' };
  }

  if (isRecurring && !scheduledAtRaw) {
    return { error: '반복 약속은 기준 일시가 필요합니다.' };
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
    return { error: '생성할 반복 약속 일정이 없습니다. 종료일을 확인해 주세요.' };
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

  const { data, error } = await insertEventRows(supabase, rows);

  if (error) {
    if (isMissingProfileForeignKeyError(error)) {
      try {
        await ensureProfile(supabase, user);
      } catch (profileError) {
        return {
          error: profileError instanceof Error ? profileError.message : '프로필 생성에 실패했습니다.',
        };
      }
      const retry = await insertEventRows(supabase, rows);
      if (retry.error) return { error: retry.error.message };
      if (!retry.data?.[0]?.id) return { error: '생성된 약속 ID를 확인할 수 없습니다.' };

      const firstEvent = [...retry.data].sort((a, b) => {
        if (!a.scheduled_at) return 1;
        if (!b.scheduled_at) return -1;
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      })[0];

      return { redirectTo: `/events/${firstEvent.id}?created=1` };
    }

    return { error: error.message };
  }
  if (!data?.[0]?.id) return { error: '생성된 약속 ID를 확인할 수 없습니다.' };

  const firstEvent = [...data].sort((a, b) => {
    if (!a.scheduled_at) return 1;
    if (!b.scheduled_at) return -1;
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
  })[0];

  return { redirectTo: `/events/${firstEvent.id}?created=1` };
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
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { redirectTo: '/auth/login' };

  const title = formData.get('title') as string;
  const description = (formData.get('description') as string) || null;
  const raidName = (formData.get('raid_name') as string) || null;
  const scheduledAtRaw = formData.get('scheduled_at') as string;
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw).toISOString() : null;

  if (!title?.trim()) {
    return { error: '제목은 필수입니다.' };
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

  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}`);
  revalidatePath('/events');
  return { redirectTo: `/events/${eventId}` };
}

// ——————————————————————————————
// 약속 삭제
// ——————————————————————————————
export async function deleteEvent(eventId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { redirectTo: '/auth/login' };

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);
  // RLS가 주최자만 delete 허용

  if (error) return { error: error.message };

  revalidatePath('/events');
  return { redirectTo: '/events' };
}

// ——————————————————————————————
// 약속 일괄 삭제
// ——————————————————————————————
export async function deleteEvents(
  eventIds: string[]
): Promise<{ error?: string; deletedCount?: number; skippedCount?: number }> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: '로그인이 필요합니다.' };

  if (!eventIds || eventIds.length === 0) return { error: '삭제할 약속을 선택해 주세요.' };

  const MAX_BULK = 50;
  if (eventIds.length > MAX_BULK) return { error: `한 번에 최대 ${MAX_BULK}개까지 삭제할 수 있습니다.` };

  // 현재 사용자가 주최자인 항목만 필터링
  const { data: ownEvents, error: selectError } = await supabase
    .from('events')
    .select('id')
    .in('id', eventIds)
    .eq('created_by', user.id);

  if (selectError) return { error: selectError.message };

  const ownIds = (ownEvents ?? []).map((e) => e.id);
  const skippedCount = eventIds.length - ownIds.length;

  if (ownIds.length === 0) {
    return { error: '선택한 약속 중 삭제 권한이 있는 항목이 없습니다.', deletedCount: 0, skippedCount };
  }

  const { error: deleteError } = await supabase
    .from('events')
    .delete()
    .in('id', ownIds)
    .eq('created_by', user.id);
  // RLS도 주최자만 delete 허용하므로 이중 방어

  if (deleteError) return { error: deleteError.message };

  revalidatePath('/events');
  return { deletedCount: ownIds.length, skippedCount };
}

// ——————————————————————————————
// Discord 채널 공유 (Bot API 우선, fallback: Webhook)
// ——————————————————————————————
export async function shareEventToDiscord(eventId: string): Promise<{ error?: string }> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const hasBot = !!(botToken && channelId);
  const hasWebhook = !!webhookUrl;

  if (!hasBot && !hasWebhook) {
    return {
      error: 'DISCORD_BOT_TOKEN+DISCORD_CHANNEL_ID 또는 DISCORD_WEBHOOK_URL을 설정해 주세요.',
    };
  }

  const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL);
  if (!siteUrl) return { error: 'NEXT_PUBLIC_SITE_URL 또는 VERCEL_URL이 설정되어 있지 않습니다.' };

  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: '로그인이 필요합니다.' };

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, title, description, raid_name, scheduled_at, created_by, profiles ( nickname )')
    .eq('id', eventId)
    .single();

  if (eventError || !event) return { error: '약속을 찾을 수 없습니다.' };
  if (event.created_by !== user.id) return { error: '주최자만 Discord 채널로 공유할 수 있습니다.' };

  const eventUrl = buildEventDetailUrl(event.id, siteUrl);

  if (hasBot) {
    const payload = buildDiscordBotMessagePayload(event, eventUrl);
    let response: Response;
    try {
      response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return { error: 'Discord Bot API 요청에 실패했습니다.' };
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { error: `Discord Bot 메시지 전송 실패 (${response.status})${body ? `: ${body}` : ''}` };
    }
    return {};
  }

  // Webhook fallback
  const payload = buildDiscordWebhookPayload(event, eventUrl);
  let response: Response;
  try {
    response = await fetch(webhookUrl!, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return { error: 'Discord webhook 요청에 실패했습니다.' };
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    return { error: `Discord webhook 전송 실패 (${response.status})${body ? `: ${body}` : ''}` };
  }
  return {};
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
