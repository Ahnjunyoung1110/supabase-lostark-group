'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function SiteNavLinks() {
  const pathname = usePathname();

  const activeSection =
    pathname.startsWith('/characters/ranking')
      ? 'ranking'
      : pathname.startsWith('/characters')
      ? 'characters'
      : pathname.startsWith('/events')
      ? 'events'
      : undefined;

  return (
    <div className="flex items-center gap-0.5">
      <Link
        href="/events"
        className={cn(
          'px-2 py-1 text-sm rounded-md transition-colors',
          activeSection === 'events'
            ? 'bg-muted font-medium text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
      >
        약속
      </Link>
      <Link
        href="/characters"
        className={cn(
          'px-2 py-1 text-sm rounded-md transition-colors',
          activeSection === 'characters'
            ? 'bg-muted font-medium text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
      >
        캐릭터
      </Link>
      <Link
        href="/characters/ranking"
        className={cn(
          'px-2 py-1 text-sm rounded-md transition-colors',
          activeSection === 'ranking'
            ? 'bg-muted font-medium text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
      >
        랭킹
      </Link>
    </div>
  );
}
