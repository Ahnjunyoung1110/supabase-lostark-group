-- character_snapshots: 매 갱신 시 스펙 이력을 누적 저장
-- 변화 시에만 INSERT (Edge Function에서 비교 후 결정)
create table public.character_snapshots (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_level numeric(8,2),
  spec_score numeric(10,2),
  tier text,
  class_name text,
  gem_efficiency_percent numeric(8,2),
  bracelet_efficiency_percent numeric(8,2),
  engraving_efficiency_percent numeric(8,2),
  main_node_efficiency_percent numeric(8,2),
  source text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 캐릭터별 시간순 조회 인덱스
create index character_snapshots_char_time_idx
  on public.character_snapshots (character_id, fetched_at desc);

-- RLS: 인증 사용자 전체 읽기 가능 (그룹 비교용), 쓰기는 service role(Edge Function)만
alter table public.character_snapshots enable row level security;

create policy "인증 사용자 스냅샷 조회"
  on public.character_snapshots for select
  to authenticated
  using (true);
