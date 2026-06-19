-- ============================================================
-- characters: 캐릭터 스펙 저장
-- ============================================================
create table public.characters (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  character_name  text not null,
  server_name     text,
  class_name      text,
  item_level      numeric(8, 2),
  spec_score      numeric(10, 2),
  tier            text,
  combat_stats    jsonb,
  source          text not null default 'lopec'
                    check (source in ('lopec', 'official')),
  source_url      text,
  last_fetched_at timestamptz,
  fetch_error     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index characters_user_name_uniq
  on public.characters (user_id, lower(character_name));

create index characters_user_id_idx on public.characters (user_id);
create index characters_spec_score_idx on public.characters (spec_score desc nulls last);

create trigger characters_set_updated_at
  before update on public.characters
  for each row execute function public.set_updated_at();

-- 계정당 3개 초과 방지
create or replace function public.check_character_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.characters where user_id = new.user_id) >= 3 then
    raise exception '캐릭터는 계정당 최대 3개까지 등록할 수 있습니다.';
  end if;
  return new;
end;
$$;

create trigger characters_limit_check
  before insert on public.characters
  for each row execute function public.check_character_limit();

-- RLS
alter table public.characters enable row level security;
grant select, insert, update, delete on public.characters to authenticated;

-- 전체 인증 사용자 읽기 (그룹 비교용)
create policy "characters_select_authenticated"
  on public.characters for select
  to authenticated using (true);

-- 본인 캐릭터만 쓰기
create policy "characters_insert_own"
  on public.characters for insert
  to authenticated with check ((select auth.uid()) = user_id);

create policy "characters_update_own"
  on public.characters for update
  to authenticated
  using  ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "characters_delete_own"
  on public.characters for delete
  to authenticated using ((select auth.uid()) = user_id);
