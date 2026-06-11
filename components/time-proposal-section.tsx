'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { createTimeProposal, applyTimeProposal, rejectTimeProposal } from '@/app/events/actions';
import { formatDateTime, formatRelative } from '@/lib/format';
import { getDisplayName } from '@/lib/profile';
import type { TimeProposalWithProfile } from '@/lib/queries';
import { CheckCircle, Clock, History, XCircle } from 'lucide-react';

interface TimeProposalSectionProps {
  eventId: string;
  proposals: TimeProposalWithProfile[];
  isOrganizer: boolean;
}

const STATUS_LABEL: Record<TimeProposalWithProfile['status'], string> = {
  pending: '대기 중',
  applied: '확정됨',
  rejected: '거절됨',
};

function proposalBadgeVariant(status: TimeProposalWithProfile['status']) {
  if (status === 'applied') return 'default' as const;
  if (status === 'rejected') return 'secondary' as const;
  return 'outline' as const;
}

export function TimeProposalSection({ eventId, proposals, isOrganizer }: TimeProposalSectionProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isCreating, startCreateTransition] = useTransition();
  const [isUpdating, startUpdateTransition] = useTransition();

  const sortedProposals = useMemo(
    () => [...proposals].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [proposals]
  );

  const handleCreate = (formData: FormData) => {
    setFormError(null);
    startCreateTransition(async () => {
      const result = await createTimeProposal(eventId, formData);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      formRef.current?.reset();
    });
  };

  const handleProposalAction = (proposalId: string, action: 'apply' | 'reject') => {
    setActionError(null);
    setPendingId(proposalId);
    startUpdateTransition(async () => {
      const result = action === 'apply'
        ? await applyTimeProposal(eventId, proposalId)
        : await rejectTimeProposal(eventId, proposalId);

      if (result.error) {
        setActionError(result.error);
      }
      setPendingId(null);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          시간 변경 제안
        </CardTitle>
        <CardDescription>
          누구나 새 시간을 제안할 수 있고, 주최자가 확정하면 모든 참석 응답이 미정으로 초기화됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form ref={formRef} action={handleCreate} className="grid gap-4 rounded-lg border bg-muted/30 p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="proposed_at">새 일시</Label>
            <Input id="proposed_at" name="proposed_at" type="datetime-local" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="proposal_message">메모</Label>
            <Textarea
              id="proposal_message"
              name="message"
              rows={2}
              placeholder="예: 22시 이후 가능해요."
            />
          </div>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <Button type="submit" disabled={isCreating} className="min-h-11 w-full sm:w-fit">
            {isCreating ? '제안 중...' : '시간 변경 제안하기'}
          </Button>
        </form>

        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4" />
            제안/확정 이력
          </h3>

          {sortedProposals.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              아직 시간 변경 제안이 없습니다.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedProposals.map((proposal) => {
                const isPending = proposal.status === 'pending';
                const isBusy = isUpdating && pendingId === proposal.id;

                return (
                  <div key={proposal.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium break-words">{formatDateTime(proposal.proposed_at)}</p>
                          <Badge variant={proposalBadgeVariant(proposal.status)}>
                            {STATUS_LABEL[proposal.status]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {getDisplayName(proposal.profiles)} · {formatRelative(proposal.created_at)} 제안
                        </p>
                      </div>

                      {isOrganizer && isPending && (
                        <div className="grid grid-cols-2 gap-2 sm:flex">
                          <Button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleProposalAction(proposal.id, 'apply')}
                            className="min-h-11 bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4" />
                            {isBusy ? '처리 중...' : '확정'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isUpdating}
                            onClick={() => handleProposalAction(proposal.id, 'reject')}
                            className="min-h-11"
                          >
                            <XCircle className="h-4 w-4" />
                            거절
                          </Button>
                        </div>
                      )}
                    </div>

                    {proposal.message && (
                      <p className="whitespace-pre-wrap border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground">
                        {proposal.message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {actionError && <p className="text-sm text-red-500">{actionError}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
