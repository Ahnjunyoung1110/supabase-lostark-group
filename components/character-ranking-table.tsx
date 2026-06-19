import { Badge } from '@/components/ui/badge';
import { getDisplayName } from '@/lib/profile';
import type { CharacterRankingSortKey, CharacterWithProfile } from '@/lib/characters';
import { cn } from '@/lib/utils';

interface CharacterRankingTableProps {
  characters: CharacterWithProfile[];
  currentUserId: string;
  sortBy: CharacterRankingSortKey;
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function formatNumber(value: number | null | undefined, maximumFractionDigits = 2) {
  return value != null
    ? value.toLocaleString('ko-KR', { maximumFractionDigits })
    : '—';
}

function metricCellClass(sortBy: CharacterRankingSortKey, key: CharacterRankingSortKey, rank: number) {
  return cn(
    'px-4 py-3 text-right whitespace-nowrap tabular-nums',
    sortBy === key && 'font-semibold',
    sortBy === key && rank === 1 && 'text-yellow-500 dark:text-yellow-400'
  );
}

export function CharacterRankingTable({ characters, currentUserId, sortBy }: CharacterRankingTableProps) {
  if (characters.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-10 border rounded-lg border-dashed">
        아직 등록된 캐릭터가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-center font-medium text-muted-foreground w-12">순위</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">닉네임</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">캐릭터명</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">직업</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">아이템레벨</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">환산점수</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">젬 효율</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">팔찌 효율</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">각인 효율</th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground whitespace-nowrap">소스</th>
          </tr>
        </thead>
        <tbody>
          {characters.map((char, idx) => {
            const rank = idx + 1;
            const isMe = char.user_id === currentUserId;
            return (
              <tr
                key={char.id}
                className={cn(
                  'border-b border-border/40 last:border-0',
                  isMe
                    ? 'bg-primary/5 dark:bg-primary/10'
                    : idx % 2 === 0
                    ? 'bg-background'
                    : 'bg-muted/20'
                )}
              >
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  {rank <= 3 ? (
                    <span className="text-base">{MEDAL[rank]}</span>
                  ) : (
                    <span className="tabular-nums text-muted-foreground font-medium">{rank}</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={cn('text-muted-foreground', isMe && 'text-foreground font-medium')}>
                    {getDisplayName(char.profiles)}
                  </span>
                  {isMe && (
                    <span className="ml-1.5 text-xs text-primary font-medium">(나)</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium whitespace-nowrap">{char.character_name}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{char.class_name ?? '—'}</td>
                <td className={metricCellClass(sortBy, 'item_level', rank)}>
                  {formatNumber(char.item_level)}
                </td>
                <td className={metricCellClass(sortBy, 'spec_score', rank)}>
                  {formatNumber(char.spec_score)}
                </td>
                <td className={metricCellClass(sortBy, 'gem_efficiency_percent', rank)}>
                  {char.gem_efficiency_percent != null ? `${formatNumber(char.gem_efficiency_percent)}%` : '—'}
                </td>
                <td className={metricCellClass(sortBy, 'bracelet_efficiency_percent', rank)}>
                  {char.bracelet_efficiency_percent != null ? `${formatNumber(char.bracelet_efficiency_percent)}%` : '—'}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                  {char.engraving_efficiency_percent != null ? `${formatNumber(char.engraving_efficiency_percent)}%` : '—'}
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <Badge
                    variant={char.source === 'lopec' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {char.source === 'lopec' ? '로펙' : '공식'}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
