export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllCharactersForCompare } from '@/lib/queries';
import { CharacterRankingSort } from '@/components/character-ranking-sort';
import { CharacterRankingTable } from '@/components/character-ranking-table';
import {
  CHARACTER_RANKING_SORT_OPTIONS,
  normalizeCharacterRankingSortKey,
  type CharacterRankingSortKey,
  type CharacterWithProfile,
} from '@/lib/characters';

interface RankingPageProps {
  searchParams?: Promise<{ sort?: string | string[] }>;
}

function getSortDescription(sortBy: CharacterRankingSortKey) {
  return CHARACTER_RANKING_SORT_OPTIONS.find((option) => option.key === sortBy)?.description ?? '로펙 환산점수 기준';
}

export default async function RankingPage({ searchParams }: RankingPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const params = searchParams ? await searchParams : undefined;
  const sortBy = normalizeCharacterRankingSortKey(params?.sort);
  const allChars = await getAllCharactersForCompare(sortBy);

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-bold">스펙 랭킹</h1>
          <p className="text-sm text-muted-foreground mt-1">
            그룹 전체 캐릭터를 {getSortDescription(sortBy)}으로 정렬합니다.
          </p>
        </div>
        <CharacterRankingSort currentSort={sortBy} />
      </div>
      <CharacterRankingTable
        characters={allChars as CharacterWithProfile[]}
        currentUserId={user.id}
        sortBy={sortBy}
      />
    </div>
  );
}
