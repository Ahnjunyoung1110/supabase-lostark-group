export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCharacterById, getCharacterSnapshots } from '@/lib/queries';
import { SpecHistoryChart } from '@/components/spec-history-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

const TIER_CLASS: Record<string, string> = {
  esther:   'border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  legend:   'border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  diamond:  'border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  master:   'border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400',
  platinum: 'border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400',
  gold:     'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  silver:   'border-slate-400/40 bg-slate-400/10 text-slate-500 dark:text-slate-300',
  bronze:   'border-orange-800/40 bg-orange-800/10 text-orange-700 dark:text-orange-400',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CharacterDetailPage({ params }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { id } = await params;
  const [character, snapshots] = await Promise.all([
    getCharacterById(id),
    getCharacterSnapshots(id),
  ]);

  if (!character) notFound();

  const tierKey = character.tier?.toLowerCase() ?? '';
  const tierClass = TIER_CLASS[tierKey] ?? 'border-border bg-muted/40 text-muted-foreground';
  const isOwner = character.user_id === user.id;

  // 그래프 데이터 포인트 변환
  const levelPoints = snapshots
    .filter((s) => s.item_level != null)
    .map((s) => ({ t: s.fetched_at, value: s.item_level! }));

  const scorePoints = snapshots
    .filter((s) => s.spec_score != null)
    .map((s) => ({ t: s.fetched_at, value: s.spec_score! }));

  const ownerNickname = character.profiles?.nickname ?? '알 수 없음';

  return (
    <div className="flex flex-col gap-8">
      {/* 뒤로가기 */}
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/characters">
            <ArrowLeft className="w-4 h-4 mr-1" />
            캐릭터 목록
          </Link>
        </Button>
      </div>

      {/* 헤더 */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate">{character.character_name}</h1>
              {character.tier && (
                <Badge variant="outline" className={cn('text-xs shrink-0', tierClass)}>
                  {character.tier.charAt(0).toUpperCase() + character.tier.slice(1)}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {[character.class_name, character.server_name].filter(Boolean).join(' · ')}
              {!isOwner && ` · ${ownerNickname}`}
            </p>
          </div>

          {/* 현재 스펙 요약 */}
          <div className="flex gap-6 shrink-0">
            {character.item_level != null && (
              <div className="text-center">
                <p className="text-lg font-bold tabular-nums">
                  {character.item_level.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">아이템레벨</p>
              </div>
            )}
            {character.spec_score != null && (
              <div className="text-center">
                <p className="text-lg font-bold tabular-nums text-primary">
                  {character.spec_score.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">환산점수</p>
              </div>
            )}
          </div>
        </div>

        {/* 효율 지표 */}
        {(character.gem_efficiency_percent != null ||
          character.bracelet_efficiency_percent != null ||
          character.engraving_efficiency_percent != null ||
          character.main_node_efficiency_percent != null) && (
          <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '젬 효율', value: character.gem_efficiency_percent },
              { label: '팔찌 효율', value: character.bracelet_efficiency_percent },
              { label: '각인 효율', value: character.engraving_efficiency_percent },
              { label: '메인노드', value: character.main_node_efficiency_percent },
            ].map(({ label, value }) =>
              value != null ? (
                <div key={label} className="text-center">
                  <p className="text-sm font-semibold tabular-nums">
                    {value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}%
                  </p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>

      {/* 이력 그래프 */}
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">스펙 이력</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SpecHistoryChart
            title="아이템레벨 변화"
            points={levelPoints}
            unit="IL"
          />
          <SpecHistoryChart
            title="환산점수 변화"
            points={scorePoints}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          스펙 갱신 시 변화가 있을 때만 기록됩니다.
          {snapshots.length > 0 &&
            ` 총 ${snapshots.length}개 스냅샷`}
        </p>
      </div>
    </div>
  );
}
