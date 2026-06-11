'use client';

import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { buildDiscordShareText, type DiscordShareEvent } from '@/lib/discord/share-message';
import { shareEventToDiscord } from '@/app/events/actions';
import { Check, Copy, ExternalLink, Send, Share2 } from 'lucide-react';

interface DiscordSharePanelProps {
  event: DiscordShareEvent;
  canSendWebhook: boolean;
  created?: boolean;
}

export function DiscordSharePanel({ event, canSendWebhook, created = false }: DiscordSharePanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const eventUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/events/${event.id}`;
    return `${window.location.origin}/events/${event.id}`;
  }, [event.id]);

  const shareText = useMemo(
    () => buildDiscordShareText(event, eventUrl),
    [event, eventUrl]
  );

  const handleCopy = async () => {
    setMessage(null);
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setMessage('공유 문구를 복사했습니다. Discord에 붙여넣어 주세요.');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage('클립보드 복사에 실패했습니다. 아래 문구를 직접 복사해 주세요.');
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) {
      await handleCopy();
      return;
    }

    setMessage(null);
    try {
      await navigator.share({
        title: event.title,
        text: shareText,
        url: eventUrl,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessage('공유를 열 수 없어 문구 복사로 대신 진행해 주세요.');
    }
  };

  const handleWebhookShare = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await shareEventToDiscord(event.id);
      if (result.error) {
        setMessage(`오류: ${result.error}`);
        return;
      }
      setMessage('Discord 채널로 약속을 공유했습니다.');
    });
  };

  return (
    <Card className={created ? 'border-primary/50 bg-primary/5' : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Share2 className="h-5 w-5" />
          Discord 공유
        </CardTitle>
        <CardDescription>
          {created
            ? '약속이 생성되었습니다. Discord에 바로 공유해 보세요.'
            : '이 약속을 Discord 채널이나 DM에 공유할 수 있습니다.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <Button type="button" onClick={handleCopy} className="min-h-11 w-full">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? '복사됨' : '공유 문구 복사'}
          </Button>
          <Button type="button" variant="outline" onClick={handleNativeShare} className="min-h-11 w-full">
            <Share2 className="h-4 w-4" />
            모바일 공유
          </Button>
          <Button asChild type="button" variant="outline" className="min-h-11 w-full">
            <a href="https://discord.com/channels/@me" target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Discord 열기
            </a>
          </Button>
        </div>

        {canSendWebhook && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleWebhookShare}
            disabled={isPending}
            className="min-h-11 w-full sm:w-auto"
          >
            {isPending ? (
              <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isPending ? '전송 중...' : 'Discord 채널로 전송'}
          </Button>
        )}

        {!canSendWebhook && (
          <p className="text-xs text-muted-foreground">
            자동 채널 전송은 서버 환경변수 DISCORD_WEBHOOK_URL 설정 시 활성화됩니다.
          </p>
        )}

        {message && (
          <p className={`text-sm ${message.startsWith('오류') ? 'text-red-500' : 'text-muted-foreground'}`}>
            {message}
          </p>
        )}

        <details className="rounded-lg border bg-muted/30 p-3 text-sm">
          <summary className="cursor-pointer font-medium">공유 문구 미리보기</summary>
          <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">
            {shareText}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}
