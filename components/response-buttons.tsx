'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { upsertResponse } from '@/app/events/actions';
import { cn } from '@/lib/utils';

type ResponseStatus = 'attending' | 'declined' | 'undecided';

interface ResponseButtonsProps {
  eventId: string;
  currentStatus: ResponseStatus | null;
}

const BUTTONS: { status: ResponseStatus; label: string; icon: React.ReactNode }[] = [
  { status: 'attending', label: '참석', icon: <CheckCircle className="w-4 h-4" /> },
  { status: 'declined',  label: '불참', icon: <XCircle className="w-4 h-4" /> },
  { status: 'undecided', label: '미정', icon: <HelpCircle className="w-4 h-4" /> },
];

export function ResponseButtons({ eventId, currentStatus }: ResponseButtonsProps) {
  const [selected, setSelected] = useState<ResponseStatus | null>(currentStatus);
  const [isLoading, setIsLoading] = useState<ResponseStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (status: ResponseStatus) => {
    if (isLoading) return;
    setIsLoading(status);
    setError(null);
    try {
      const result = await upsertResponse(eventId, status);
      if (result.error) {
        setError(result.error);
      } else {
        setSelected(status);
      }
    } catch {
      setError('응답 저장에 실패했습니다.');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">내 응답</p>
      <div className="flex gap-2 flex-wrap">
        {BUTTONS.map(({ status, label, icon }) => {
          const isSelected = selected === status;
          const loading = isLoading === status;
          return (
            <Button
              key={status}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              disabled={!!isLoading}
              onClick={() => handleClick(status)}
              className={cn(
                'flex items-center gap-1.5',
                status === 'attending' && isSelected && 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800',
                status === 'declined'  && isSelected && 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800',
              )}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : icon}
              {label}
            </Button>
          );
        })}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
