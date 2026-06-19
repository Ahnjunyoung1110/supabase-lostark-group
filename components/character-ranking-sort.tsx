import Link from 'next/link';
import {
  CHARACTER_RANKING_SORT_OPTIONS,
  type CharacterRankingSortKey,
} from '@/lib/characters';
import { cn } from '@/lib/utils';

interface CharacterRankingSortProps {
  currentSort: CharacterRankingSortKey;
}

export function CharacterRankingSort({ currentSort }: CharacterRankingSortProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CHARACTER_RANKING_SORT_OPTIONS.map((option) => {
        const active = option.key === currentSort;
        return (
          <Link
            key={option.key}
            href={`/characters/ranking?sort=${option.key}`}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            title={option.description}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
