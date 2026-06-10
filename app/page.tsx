export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { AuthButton } from '@/components/auth-button';
import { Swords, CalendarDays, Users, CheckCircle } from 'lucide-react';

export default async function LandingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = !!data?.claims;

  return (
    <div className="min-h-screen flex flex-col">
      {/* 네비 */}
      <nav className="w-full border-b border-border/50">
        <div className="max-w-5xl mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 font-semibold">
            <Swords className="w-5 h-5" />
            <span>로스트아크 약속</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Suspense fallback={null}>
              <AuthButton />
            </Suspense>
          </div>
        </div>
      </nav>

      {/* 히어로 */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center gap-8 py-16">
        <div className="space-y-4 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm text-muted-foreground">
            <Swords className="w-4 h-4" />
            친구 그룹 레이드 약속 관리
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            레이드 약속을
            <br />
            <span className="text-primary">쉽게 잡아요</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            약속을 올리면 멤버들이 참석 여부를 응답하고
            <br />
            그 결과가 자동으로 집계됩니다.
          </p>
        </div>

        {/* CTA */}
        <div className="flex gap-3 flex-wrap justify-center">
          {isLoggedIn ? (
            <Button asChild size="lg">
              <Link href="/events" className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                약속 목록 보기
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link href="/auth/login" className="flex items-center gap-2">
                Discord로 시작하기
              </Link>
            </Button>
          )}
        </div>

        {/* 기능 소개 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mt-4 text-left">
          <div className="rounded-lg border p-4 space-y-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            <h3 className="font-semibold text-sm">약속 생성</h3>
            <p className="text-xs text-muted-foreground">
              레이드명, 날짜, 시간을 설정해 약속을 만드세요.
            </p>
          </div>
          <div className="rounded-lg border p-4 space-y-2">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <h3 className="font-semibold text-sm">참석 응답</h3>
            <p className="text-xs text-muted-foreground">
              참석 / 불참 / 미정으로 응답하세요.
            </p>
          </div>
          <div className="rounded-lg border p-4 space-y-2">
            <Users className="w-6 h-6 text-blue-500" />
            <h3 className="font-semibold text-sm">실시간 집계</h3>
            <p className="text-xs text-muted-foreground">
              상태별 인원 수와 멤버 명단을 한눈에 확인하세요.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        <ThemeSwitcher />
      </footer>
    </div>
  );
}
