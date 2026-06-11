'use client';

import { useState } from 'react';
import Link from 'next/link';
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
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { validateNickname } from '@/lib/profile';

interface ProfileFormProps {
  userId: string;
  initialNickname: string | null;
}

export function ProfileForm({ userId, initialNickname }: ProfileFormProps) {
  const [nickname, setNickname] = useState(initialNickname ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const needsSetup = !initialNickname?.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateNickname(nickname);
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsLoading(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ nickname: nickname.trim() })
      .eq('id', userId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSaved(true);
      router.refresh();
    }
    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>프로필 설정</CardTitle>
        <CardDescription>
          {needsSetup
            ? 'Discord ID 대신 앱에서 사용할 닉네임을 설정해 주세요.'
            : '앱에서 표시될 닉네임을 변경합니다.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="nickname">
                닉네임 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nickname"
                type="text"
                placeholder="1~32자 닉네임 입력"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  if (error) setError(null);
                  if (saved) setSaved(false);
                }}
                maxLength={32}
                required
                className="min-h-11"
              />
              <p className="text-xs text-muted-foreground">
                약속 목록, 상세, 명단에 표시됩니다. 1~32자.
              </p>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {saved && (
              <div className="space-y-2">
                <p className="text-sm text-green-600 dark:text-green-400">
                  닉네임이 저장되었습니다.
                </p>
                <Button asChild variant="outline" className="w-full min-h-11">
                  <Link href="/events">약속 목록으로 →</Link>
                </Button>
              </div>
            )}

            <Button type="submit" className="w-full min-h-11" disabled={isLoading}>
              {isLoading ? '저장 중...' : '저장'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
