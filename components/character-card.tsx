'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Trash2, AlertCircle, History } from 'lucide-react';
import { refreshCharacter, removeCharacter } from '@/app/characters/actions';
import type { CharacterRow } from '@/lib/characters';
import { cn } from '@/lib/utils';

function formatFetchTime(at: string | null): string {
  if (!at) return '미조회';
  const diffMs = Date.now() - new Date(at).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

const TIER_CLASS: Record<string, string> = {
  esther:   'border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  legend:   'border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  diamond:  'border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  master:   'border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400',
  platinum: 'border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400',
  gold:     'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  silver:   'border-slate-400/40 bg-slate-400/10 text-slate-500 dark:text-slate-300',
  bronze:   'border-orange-800/40 bg-orange-800/10 text-orange-700 dark:text-orange-400',
};

interface CharacterCardProps {
  character: CharacterRow;
}

export function CharacterCard({ character }: CharacterCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setActionError(null);
    const result = await refreshCharacter(character.id);
    if (result.error) setActionError(result.error);
    setIsRefreshing(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsDeleting(true);
    const result = await removeCharacter(character.id);
    if (result.error) {
      setActionError(result.error);
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const tierKey = character.tier?.toLowerCase() ?? '';
  const tierClass = TIER_CLASS[tierKey] ?? 'border-border bg-muted/40 text-muted-foreground';

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-col gap-3 p-4">
        {/* 캐릭터명 + 티어 */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold truncate">{character.character_name}</p>
            {character.server_name && (
              <p className="text-xs text-muted-foreground">{character.server_name}</p>
            )}
          </div>
          {character.tier && (
            <Badge variant="outline" className={cn('shrink-0 text-xs', tierClass)}>
              {character.tier.charAt(0).toUpperCase() + character.tier.slice(1)}
            </Badge>
          )}
        </div>

        {/* 직업 + 아이템레벨 */}
        <div className="flex items-center gap-2 flex-wrap">
          {character.class_name && (
            <span className="text-sm text-muted-foreground">{character.class_name}</span>
          )}
          {character.item_level != null && (
            <Badge variant="secondary" className="text-xs tabular-nums">
              {character.item_level} IL
            </Badge>
          )}
        </div>

        {/* 로펙 환산점수 */}
        <div className="text-center py-2 border-y border-border/50">
          {character.source === 'lopec' && character.spec_score != null ? (
            <>
              <p className="text-2xl font-bold tabular-nums leading-tight">
                {character.spec_score.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">로펙 환산점수</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-1">
              {character.source === 'official' ? '점수 없음 (공식 API)' : '점수 없음'}
            </p>
          )}
        </div>

        {/* 갱신 시각 */}
        <p className="text-xs text-muted-foreground">
          마지막 갱신: {formatFetchTime(character.last_fetched_at)}
        </p>

        {/* 오류 메시지 */}
        {character.fetch_error && (
          <div className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{character.fetch_error}</span>
          </div>
        )}
        {actionError && <p className="text-xs text-red-500">{actionError}</p>}

        {/* 버튼 */}
        <div className="flex items-center gap-2 pt-1">
          {confirmDelete ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 text-xs"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  '확인 삭제'
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setConfirmDelete(false)}
                disabled={isDeleting}
              >
                취소
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 flex items-center gap-1.5 text-xs"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                새로고침
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-primary"
                asChild
                title="스펙 이력 보기"
              >
                <Link href={`/characters/${character.id}`}>
                  <History className="w-3.5 h-3.5" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={handleDelete}
                disabled={isRefreshing}
                title="캐릭터 삭제"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
