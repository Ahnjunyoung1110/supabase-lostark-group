import Link from 'next/link';
import { Suspense } from 'react';
import { AuthButton } from '@/components/auth-button';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { SiteNavLinks } from '@/components/site-nav-links';
import { Swords } from 'lucide-react';

export function SiteNav() {
  return (
    <nav className="w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/events"
            className="flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity"
          >
            <Swords className="w-5 h-5" />
            <span className="text-sm sm:text-base hidden xs:inline">로스트아크</span>
          </Link>
          <SiteNavLinks />
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeSwitcher />
          <Suspense fallback={<div className="w-16 h-8 bg-muted rounded animate-pulse" />}>
            <AuthButton />
          </Suspense>
        </div>
      </div>
    </nav>
  );
}
