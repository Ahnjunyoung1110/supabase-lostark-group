import Link from 'next/link';
import { Suspense } from 'react';
import { AuthButton } from '@/components/auth-button';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Swords } from 'lucide-react';

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* 네비게이션 바 */}
      <nav className="w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
          <Link
            href="/events"
            className="flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity"
          >
            <Swords className="w-5 h-5" />
            <span>로스트아크 약속</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Suspense fallback={<div className="w-16 h-8 bg-muted rounded animate-pulse" />}>
              <AuthButton />
            </Suspense>
          </div>
        </div>
      </nav>

      {/* 본문 */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
