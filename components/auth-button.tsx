import Link from 'next/link';
import { Button } from './ui/button';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from './logout-button';

export async function AuthButton() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user) {
    return (
      <Button asChild variant="outline" className="min-h-10">
        <Link href="/auth/login">로그인</Link>
      </Button>
    );
  }

  // 닉네임 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', user.sub)
    .single();

  const displayName = profile?.nickname ?? user.email ?? '사용자';

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link
        href="/profile"
        className="max-w-24 truncate text-sm text-muted-foreground transition-colors hover:text-foreground sm:max-w-40"
      >
        {displayName}
      </Link>
      <LogoutButton />
    </div>
  );
}
