export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/profile-form';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, avatar_url')
    .eq('id', user.sub)
    .single();

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
      <ProfileForm
        userId={user.sub}
        initialNickname={profile?.nickname ?? null}
      />
    </div>
  );
}
