import { formatDateTime } from '../format';
import { getDisplayName } from '../profile';

export type DiscordShareEvent = {
  id: string;
  title: string;
  description: string | null;
  raid_name: string | null;
  scheduled_at: string | null;
  profiles: { nickname: string | null } | { nickname: string | null }[] | null;
};

export type DiscordEmbedPayload = {
  content: string;
  embeds: Array<{
    title: string;
    description?: string;
    color: number;
    fields: Array<{ name: string; value: string; inline?: boolean }>;
    url: string;
  }>;
  allowed_mentions: { parse: string[] };
};

export function normalizeSiteUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, '');
}

export function buildEventDetailUrl(eventId: string, siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/events/${eventId}`;
}

function getOrganizerProfile(event: DiscordShareEvent): { nickname: string | null } | null {
  if (Array.isArray(event.profiles)) return event.profiles[0] ?? null;
  return event.profiles;
}

export function buildDiscordShareText(event: DiscordShareEvent, eventUrl: string): string {
  const lines = [
    '🗓️ 로스트아크 레이드 약속이 생성되었습니다!',
    '',
    `제목: ${event.title}`,
    event.raid_name ? `레이드: ${event.raid_name}` : null,
    `시간: ${formatDateTime(event.scheduled_at)}`,
    `주최자: ${getDisplayName(getOrganizerProfile(event))}`,
    event.description?.trim() ? '' : null,
    event.description?.trim() ? `메모: ${event.description.trim()}` : null,
    '',
    `참석 여부 응답하기: ${eventUrl}`,
  ];

  return lines.filter((line): line is string => line !== null).join('\n');
}

export function buildDiscordWebhookPayload(event: DiscordShareEvent, eventUrl: string): DiscordEmbedPayload {
  const fields = [
    event.raid_name ? { name: '레이드', value: event.raid_name, inline: true } : null,
    { name: '시간', value: formatDateTime(event.scheduled_at), inline: true },
    { name: '주최자', value: getDisplayName(getOrganizerProfile(event)), inline: true },
  ].filter((field): field is { name: string; value: string; inline: boolean } => field !== null);

  return {
    content: '🗓️ 로스트아크 레이드 약속이 생성되었습니다!',
    embeds: [
      {
        title: event.title,
        description: event.description?.trim() || undefined,
        color: 0x5865f2,
        fields,
        url: eventUrl,
      },
    ],
    allowed_mentions: { parse: [] },
  };
}
