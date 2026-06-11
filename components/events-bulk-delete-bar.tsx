'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2, X } from 'lucide-react';
import { deleteEvents } from '@/app/events/actions';

interface EventsBulkDeleteBarProps {
  selectedIds: string[];
  onClear: () => void;
}

export function EventsBulkDeleteBar({ selectedIds, onClear }: EventsBulkDeleteBarProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const count = selectedIds.length;

  if (count === 0) return null;

  const handleDeleteClick = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    startTransition(async () => {
      const result = await deleteEvents(selectedIds);
      if (result.error) {
        setMessage(`오류: ${result.error}`);
      } else {
        const msg =
          result.skippedCount && result.skippedCount > 0
            ? `${result.deletedCount}개를 삭제했고, 권한이 없는 ${result.skippedCount}개는 건너뛰었습니다.`
            : `약속 ${result.deletedCount}개를 삭제했습니다.`;
        setMessage(msg);
        onClear();
        router.refresh();
      }
      setConfirming(false);
    });
  };

  const handleCancel = () => {
    setConfirming(false);
    setMessage(null);
  };

  return (
    <div className="sticky top-0 z-10 mb-4 flex flex-col gap-2 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{count}개 선택됨</span>

        {confirming && !isPending && (
          <span className="text-sm text-muted-foreground">
            정말 {count}개 약속을 삭제할까요?
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {confirming && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isPending}
              className="min-h-10"
            >
              <X className="w-4 h-4 mr-1" />
              취소
            </Button>
          )}
          <Button
            variant={confirming ? 'destructive' : 'outline'}
            size="sm"
            onClick={handleDeleteClick}
            disabled={isPending}
            className="min-h-10 flex items-center gap-1.5"
          >
            {isPending ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {confirming ? '확인 삭제' : '선택 삭제'}
          </Button>
          {!confirming && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={isPending}
              className="min-h-10"
            >
              <X className="w-4 h-4 mr-1" />
              선택 해제
            </Button>
          )}
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.startsWith('오류') ? 'text-red-500' : 'text-muted-foreground'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
