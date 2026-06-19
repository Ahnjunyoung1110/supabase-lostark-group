'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { removeCharacter } from '@/app/characters/actions';

interface DeleteCharacterButtonProps {
  characterId: string;
}

export function DeleteCharacterButton({ characterId }: DeleteCharacterButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    startTransition(async () => {
      await removeCharacter(characterId);
    });
  };

  return (
    <Button
      variant={confirming ? 'destructive' : 'ghost'}
      size="icon"
      className={cn(
        'h-7 w-7',
        !confirming && 'text-muted-foreground hover:text-destructive',
      )}
      disabled={isPending}
      title={confirming ? '한 번 더 클릭하여 삭제' : '캐릭터 삭제'}
      onClick={handleClick}
    >
      {isPending ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5" />
      )}
    </Button>
  );
}
