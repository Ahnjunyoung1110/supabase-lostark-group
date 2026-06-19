'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { refreshCharacter } from '@/app/characters/actions';

interface RefreshCharacterButtonProps {
  characterId: string;
}

export function RefreshCharacterButton({ characterId }: RefreshCharacterButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-foreground"
      disabled={isPending}
      title="스펙 새로고침"
      onClick={() =>
        startTransition(async () => {
          await refreshCharacter(characterId);
        })
      }
    >
      <RefreshCw className={cn('w-3.5 h-3.5', isPending && 'animate-spin')} />
    </Button>
  );
}
