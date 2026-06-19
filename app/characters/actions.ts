'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

type ActionResult = { error?: string; id?: string };

/**
 * 캐릭터 등록 + 즉시 스펙 fetch
 */
export async function addCharacter(
  characterName: string,
  serverName?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다.' };

  const trimmedName = characterName.trim();
  if (!trimmedName) return { error: '캐릭터명을 입력해주세요.' };

  const { data: inserted, error: insertErr } = await supabase
    .from('characters')
    .insert({
      user_id: user.id,
      character_name: trimmedName,
      server_name: serverName?.trim() || null,
    })
    .select('id')
    .single();

  if (insertErr) {
    if (insertErr.message.includes('최대 3개')) {
      return { error: '캐릭터는 최대 3개까지 등록할 수 있습니다.' };
    }
    if (insertErr.code === '23505') {
      return { error: '이미 등록된 캐릭터입니다.' };
    }
    return { error: insertErr.message };
  }

  // 즉시 스펙 fetch
  await refreshCharacter(inserted.id);

  revalidatePath('/characters');
  return { id: inserted.id };
}

/**
 * 단일 캐릭터 스펙 수동 새로고침
 */
export async function refreshCharacter(characterId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다.' };

  // 소유권 확인
  const { data: char, error: fetchErr } = await supabase
    .from('characters')
    .select('id, user_id')
    .eq('id', characterId)
    .single();

  if (fetchErr || !char) return { error: '캐릭터를 찾을 수 없습니다.' };
  if (char.user_id !== user.id) return { error: '권한이 없습니다.' };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(`${supabaseUrl}/functions/v1/update-character-specs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ ids: [characterId] }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { error: `스펙 업데이트 실패: ${text || res.status}` };
  }

  revalidatePath('/characters');
  return {};
}

/**
 * 내 캐릭터 삭제
 */
export async function removeCharacter(characterId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다.' };

  const { error } = await supabase
    .from('characters')
    .delete()
    .eq('id', characterId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/characters');
  return {};
}
