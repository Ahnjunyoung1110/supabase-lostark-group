export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyCharacters, getAllCharactersForCompare } from '@/lib/queries';
import { CharacterSection } from '@/components/character-section';
import { CharacterCompareTable } from '@/components/character-compare-table';
import type { CharacterRow, CharacterWithProfile } from '@/lib/characters';

export default async function CharactersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const [myChars, allChars] = await Promise.all([
    getMyCharacters(user.id),
    getAllCharactersForCompare(),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="mb-5">
          <h1 className="text-xl font-bold">내 캐릭터</h1>
          <p className="text-sm text-muted-foreground mt-1">
            최대 3개까지 등록할 수 있습니다. 등록 시 로펙에서 스펙을 자동으로 가져옵니다.
          </p>
        </div>
        <CharacterSection characters={myChars as CharacterRow[]} />
      </section>

      <section>
        <div className="mb-5">
          <h2 className="text-xl font-bold">그룹 비교</h2>
          <p className="text-sm text-muted-foreground mt-1">
            그룹 전체 캐릭터를 환산점수 순으로 비교합니다.
          </p>
        </div>
        <CharacterCompareTable characters={allChars as CharacterWithProfile[]} />
      </section>
    </div>
  );
}
