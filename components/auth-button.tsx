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
      <Button asChild size="sm" variant="outline">
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
    <div className="flex items-center gap-3">
      <Link
        href="/profile"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {displayName}
      </Link>
      <LogoutButton />
    </div>
  );
}
