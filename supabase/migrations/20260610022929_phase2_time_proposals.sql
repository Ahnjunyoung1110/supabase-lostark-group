-- ============================================================
-- Phase 2: 시간 변경 제안 확정 RPC
-- 주최자가 proposal을 확정하면 약속 시간을 변경하고 모든 응답을 미정으로 초기화한다.
-- ============================================================

create or replace function public.apply_time_proposal(proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target record;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select
    tp.id,
    tp.event_id,
    tp.proposed_at,
    tp.status,
    e.created_by
  into target
  from public.time_proposals tp
  join public.events e on e.id = tp.event_id
  where tp.id = proposal_id
  for update of tp;

  if not found then
    raise exception '시간 변경 제안을 찾을 수 없습니다.';
  end if;

  if target.created_by <> (select auth.uid()) then
    raise exception '주최자만 시간 변경 제안을 확정할 수 있습니다.';
  end if;

  if target.status <> 'pending' then
    raise exception '대기 중인 제안만 확정할 수 있습니다.';
  end if;

  update public.events
  set scheduled_at = target.proposed_at
  where id = target.event_id;

  update public.event_responses
  set status = 'undecided'
  where event_id = target.event_id;

  update public.time_proposals
  set status = 'applied'
  where id = target.id;

  -- 같은 약속의 나머지 대기 제안은 더 이상 현재 약속 시간 기준과 맞지 않으므로 거절 처리한다.
  update public.time_proposals
  set status = 'rejected'
  where event_id = target.event_id
    and id <> target.id
    and status = 'pending';
end;
$$;

revoke all on function public.apply_time_proposal(uuid) from public;
grant execute on function public.apply_time_proposal(uuid) to authenticated;
