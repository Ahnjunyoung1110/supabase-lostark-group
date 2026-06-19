export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { verifyDiscordSignature } from '@/lib/discord/verify-signature';
import { normalizeSiteUrl } from '@/lib/discord/share-message';

const VALID_STATUSES = new Set(['attending', 'declined', 'undecided']);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_LABELS: Record<string, string> = {
  attending: '참석',
  declined: '불참',
  undecided: '미정',
};

function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error('Supabase 서비스 롤 환경변수가 설정되지 않았습니다.');
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function ephemeralResponse(content: string) {
  return NextResponse.json({ type: 4, data: { content, flags: 64 } });
}

interface DiscordInteraction {
  type: number;
  data?: {
    custom_id?: string;
    component_type?: number;
  };
  member?: { user?: { id?: string } };
  user?: { id?: string };
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');

  if (!signature || !timestamp) {
    return new NextResponse('Missing signature headers', { status: 401 });
  }

  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    return new NextResponse('Discord public key not configured', { status: 500 });
  }

  // 서명 검증 전 raw body 읽기 — request.json() 사용 금지
  const body = await request.text();

  const isValid = await verifyDiscordSignature(publicKey, signature, timestamp, body);
  if (!isValid) {
    return new NextResponse('Invalid request signature', { status: 401 });
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(body) as DiscordInteraction;
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  // PING (Discord Developer Portal 검증용)
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // MESSAGE_COMPONENT (버튼 클릭)
  if (interaction.type === 3) {
    const customId = interaction.data?.custom_id ?? '';
    const parts = customId.split(':');

    if (parts.length !== 3 || parts[0] !== 'event_response') {
      return ephemeralResponse('알 수 없는 버튼입니다.');
    }

    const [, eventId, status] = parts;

    if (!UUID_REGEX.test(eventId)) {
      return ephemeralResponse('잘못된 약속 ID입니다.');
    }

    if (!VALID_STATUSES.has(status)) {
      return ephemeralResponse('잘못된 응답 상태입니다.');
    }

    const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;
    if (!discordUserId) {
      return ephemeralResponse('Discord 사용자 정보를 확인할 수 없습니다.');
    }

    let supabase: ReturnType<typeof createServiceRoleClient>;
    try {
      supabase = createServiceRoleClient();
    } catch {
      return ephemeralResponse('서버 설정 오류가 발생했습니다. 관리자에게 문의해 주세요.');
    }

    // discord_user_id로 profiles 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('discord_user_id', discordUserId)
      .single();

    if (!profile) {
      const siteUrl =
        normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL) ?? '';
      const loginUrl = siteUrl ? `${siteUrl}/auth/login` : '';
      return ephemeralResponse(
        `앱에서 Discord 로그인 후 이용 가능합니다.${loginUrl ? `\n${loginUrl}` : ''}`,
      );
    }

    // event 존재 여부 확인
    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .single();

    if (!event) {
      return ephemeralResponse('약속을 찾을 수 없습니다.');
    }

    const { error: upsertError } = await supabase
      .from('event_responses')
      .upsert(
        { event_id: eventId, user_id: profile.id, status },
        { onConflict: 'event_id,user_id' },
      );

    if (upsertError) {
      return ephemeralResponse(`오류가 발생했습니다: ${upsertError.message}`);
    }

    const siteUrl =
      normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL) ?? '';
    const eventUrl = siteUrl ? `${siteUrl}/events/${eventId}` : '';
    const label = STATUS_LABELS[status] ?? status;

    return ephemeralResponse(
      `${label}으로 저장했습니다.${eventUrl ? `\n약속 상세 보기: ${eventUrl}` : ''}`,
    );
  }

  // 미지원 타입은 무시
  return NextResponse.json({ type: 1 });
}
