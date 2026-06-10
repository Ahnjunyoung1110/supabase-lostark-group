'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { deleteEvent } from '@/app/events/actions';

interface DeleteEventButtonProps {
  eventId: string;
}

export function DeleteEventButton({ eventId }: DeleteEventButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await deleteEvent(eventId);
    } catch {
      setError('삭제에 실패했습니다.');
      setIsLoading(false);
      setConfirming(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {confirming && !isLoading && (
        <span className="text-sm text-muted-foreground">정말 삭제하시겠습니까?</span>
      )}
      <Button
        variant={confirming ? 'destructive' : 'outline'}
        size="sm"
        disabled={isLoading}
        onClick={handleDelete}
        className="flex items-center gap-1.5"
      >
        {isLoading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
        {confirming ? '확인 삭제' : '약속 삭제'}
      </Button>
      {confirming && !isLoading && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
        >
          취소
        </Button>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
