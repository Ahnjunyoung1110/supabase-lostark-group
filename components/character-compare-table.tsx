import { Badge } from '@/components/ui/badge';
import { getDisplayName } from '@/lib/profile';
import type { CharacterWithProfile } from '@/lib/characters';

interface CharacterCompareTableProps {
  characters: CharacterWithProfile[];
}

export function CharacterCompareTable({ characters }: CharacterCompareTableProps) {
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
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
              닉네임
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
              캐릭터명
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
              직업
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">
              아이템레벨
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">
              환산점수
            </th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground whitespace-nowrap">
              소스
            </th>
          </tr>
        </thead>
        <tbody>
          {characters.map((char, idx) => (
            <tr
              key={char.id}
              className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
            >
              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                {getDisplayName(char.profiles)}
              </td>
              <td className="px-4 py-3 font-medium whitespace-nowrap">
                {char.character_name}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                {char.class_name ?? '—'}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                {char.item_level != null ? String(char.item_level) : '—'}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums font-medium">
                {char.spec_score != null
                  ? char.spec_score.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
                  : '—'}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
