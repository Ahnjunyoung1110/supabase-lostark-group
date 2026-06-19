export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllCharactersForCompare } from '@/lib/queries';
import { CharacterRankingTable } from '@/components/character-ranking-table';
import type { CharacterWithProfile } from '@/lib/characters';

export default async function RankingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const allChars = await getAllCharactersForCompare();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">스펙 랭킹</h1>
        <p className="text-sm text-muted-foreground mt-1">
          그룹 전체 캐릭터를 환산점수 기준으로 정렬합니다.
        </p>
      </div>
      <CharacterRankingTable
        characters={allChars as CharacterWithProfile[]}
        currentUserId={user.id}
      />
    </div>
  );
}
