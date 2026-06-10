-- ============================================================
-- 로스트아크 레이드 약속 관리 앱 — 핵심 스키마 + RLS
-- ============================================================

-- ---------- updated_at 자동 갱신 헬퍼 ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- profiles
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nickname    text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- events
-- ============================================================
create table public.events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  raid_name       text,
  scheduled_at    timestamptz,
  created_by      uuid not null references public.profiles (id) on delete cascade,
  is_recurring    boolean not null default false,
  recurrence_rule text,
  status          text not null default 'scheduled'
                    check (status in ('scheduled', 'cancelled', 'done')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index events_scheduled_at_idx on public.events (scheduled_at);
create index events_created_by_idx   on public.events (created_by);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ============================================================
-- event_responses
-- ============================================================
create table public.event_responses (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id)   on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'undecided'
                check (status in ('attending', 'declined', 'undecided')),
  updated_at  timestamptz not null default now(),
  unique (event_id, user_id)
);

create index event_responses_event_id_idx on public.event_responses (event_id);
create index event_responses_user_id_idx  on public.event_responses (user_id);

create trigger event_responses_set_updated_at
  before update on public.event_responses
  for each row execute function public.set_updated_at();

-- ============================================================
-- time_proposals (Phase 0 스키마; UI는 Phase 2에서 구현)
-- ============================================================
create table public.time_proposals (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id)   on delete cascade,
  proposed_by  uuid not null references public.profiles (id) on delete cascade,
  proposed_at  timestamptz not null,
  message      text,
  status       text not null default 'pending'
                 check (status in ('pending', 'applied', 'rejected')),
  created_at   timestamptz not null default now()
);

create index time_proposals_event_id_idx on public.time_proposals (event_id);

-- ============================================================
-- handle_new_user: 회원가입 시 profiles 행 자동 생성
-- 디스코드 OAuth metadata: full_name / name / avatar_url
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security 활성
-- ============================================================
alter table public.profiles        enable row level security;
alter table public.events          enable row level security;
alter table public.event_responses enable row level security;
alter table public.time_proposals  enable row level security;

-- Data API 노출: authenticated 롤에 테이블 권한 부여
grant select, insert, update, delete on public.profiles        to authenticated;
grant select, insert, update, delete on public.events          to authenticated;
grant select, insert, update, delete on public.event_responses to authenticated;
grant select, insert, update, delete on public.time_proposals  to authenticated;

-- ============================================================
-- RLS 정책
-- ============================================================

-- ---------- profiles ----------
-- INSERT는 handle_new_user 트리거(SECURITY DEFINER)가 담당
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using  ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------- events ----------
create policy "events_select_authenticated"
  on public.events for select
  to authenticated
  using (true);

create policy "events_insert_own"
  on public.events for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

create policy "events_update_organizer"
  on public.events for update
  to authenticated
  using  ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

create policy "events_delete_organizer"
  on public.events for delete
  to authenticated
  using ((select auth.uid()) = created_by);

-- ---------- event_responses ----------
create policy "event_responses_select_authenticated"
  on public.event_responses for select
  to authenticated
  using (true);

create policy "event_responses_insert_own"
  on public.event_responses for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "event_responses_update_own"
  on public.event_responses for update
  to authenticated
  using  ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "event_responses_delete_own"
  on public.event_responses for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- time_proposals ----------
create policy "time_proposals_select_authenticated"
  on public.time_proposals for select
  to authenticated
  using (true);

create policy "time_proposals_insert_authenticated"
  on public.time_proposals for insert
  to authenticated
  with check ((select auth.uid()) = proposed_by);

-- 확정/거절은 해당 약속의 주최자만 가능
create policy "time_proposals_update_event_organizer"
  on public.time_proposals for update
  to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = time_proposals.event_id
        and e.created_by = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = time_proposals.event_id
        and e.created_by = (select auth.uid())
    )
  );
