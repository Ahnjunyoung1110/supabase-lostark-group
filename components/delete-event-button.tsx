'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { deleteEvent } from '@/app/events/actions';

interface DeleteEventButtonProps {
  eventId: string;
}

export function DeleteEventButton({ eventId }: DeleteEventButtonProps) {
  const router = useRouter();
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
      const result = await deleteEvent(eventId);

      if (result.error) {
        setError(result.error);
        setIsLoading(false);
        setConfirming(false);
        return;
      }

      if (result.redirectTo) {
        router.push(result.redirectTo);
        return;
      }

      setIsLoading(false);
    } catch {
      setError('삭제에 실패했습니다.');
      setIsLoading(false);
      setConfirming(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      {confirming && !isLoading && (
        <span className="text-sm text-muted-foreground">정말 삭제하시겠습니까?</span>
      )}
      <Button
        variant={confirming ? 'destructive' : 'outline'}
        disabled={isLoading}
        onClick={handleDelete}
        className="flex min-h-11 w-full items-center gap-1.5 sm:w-auto"
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
          onClick={() => setConfirming(false)}
          className="min-h-11 w-full sm:w-auto"
        >
          취소
        </Button>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
