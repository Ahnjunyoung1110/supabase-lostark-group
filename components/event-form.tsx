'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createEvent, updateEvent } from '@/app/events/actions';
import { toDatetimeLocalValue } from '@/lib/format';

interface EventFormProps {
  /** 수정 모드일 때만 eventId 전달 */
  eventId?: string;
  initialValues?: {
    title?: string;
    description?: string | null;
    raid_name?: string | null;
    scheduled_at?: string | null;
  };
}

export function EventForm({ eventId, initialValues }: EventFormProps) {
  const router = useRouter();
  const isEdit = !!eventId;
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);

  const handleAction = async (formData: FormData) => {
    setError(null);
    setIsLoading(true);
    try {
      const result = isEdit
        ? await updateEvent(eventId, formData)
        : await createEvent(formData);

      if (result.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      if (result.redirectTo) {
        router.push(result.redirectTo);
        return;
      }

      setIsLoading(false);
    } catch {
      setError('저장에 실패했습니다.');
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>{isEdit ? '약속 수정' : '약속 만들기'}</CardTitle>
        <CardDescription>
          {isEdit ? '약속 정보를 수정합니다.' : '새 레이드 약속을 만들어 멤버들과 공유하세요.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleAction}>
          <div className="flex flex-col gap-5">
            {/* 제목 */}
            <div className="grid gap-1.5">
              <Label htmlFor="title">
                제목 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                name="title"
                placeholder="예: 카멘 하드"
                required
                defaultValue={initialValues?.title ?? ''}
              />
            </div>

            {/* 레이드명 */}
            <div className="grid gap-1.5">
              <Label htmlFor="raid_name">레이드명</Label>
              <Input
                id="raid_name"
                name="raid_name"
                placeholder="예: 카멘, 에키드나"
                defaultValue={initialValues?.raid_name ?? ''}
              />
            </div>

            {/* 일시 */}
            <div className="grid gap-1.5">
              <Label htmlFor="scheduled_at">약속 일시</Label>
              <Input
                id="scheduled_at"
                name="scheduled_at"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(initialValues?.scheduled_at)}
              />
            </div>

            {!isEdit && (
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    name="is_recurring"
                    className="h-4 w-4 rounded border-primary"
                    checked={isRecurring}
                    onChange={(event) => setIsRecurring(event.target.checked)}
                  />
                  반복 약속으로 다음 3주치 미리 생성
                </label>

                {isRecurring && (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>반복 요일</Label>
                      <div className="grid grid-cols-4 gap-2 text-sm sm:flex sm:flex-wrap">
                        {[
                          ['0', '일'],
                          ['1', '월'],
                          ['2', '화'],
                          ['3', '수'],
                          ['4', '목'],
                          ['5', '금'],
                          ['6', '토'],
                        ].map(([value, label]) => (
                          <label key={value} className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border px-2 py-1 sm:min-h-0 sm:justify-start">
                            <input type="checkbox" name="recurrence_weekdays" value={value} />
                            {label}
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        선택하지 않으면 기준 일시의 요일로 매주 생성됩니다.
                      </p>
                    </div>

                    <div className="grid gap-1.5">
                      <Label htmlFor="recurrence_until">종료일(선택)</Label>
                      <Input id="recurrence_until" name="recurrence_until" type="date" />
                      <p className="text-xs text-muted-foreground">
                        종료일이 없으면 기준 일시부터 다음 3주치 인스턴스를 생성합니다.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 설명 */}
            <div className="grid gap-1.5">
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="추가 안내 사항을 입력하세요."
                rows={3}
                defaultValue={initialValues?.description ?? ''}
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="min-h-11 w-full" disabled={isLoading}>
              {isLoading
                ? isEdit ? '저장 중...' : '만드는 중...'
                : isEdit ? '수정 저장' : '약속 만들기'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
