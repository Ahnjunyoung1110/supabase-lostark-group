-- ============================================================
-- Phase 4: Supabase Realtime publication
-- 이벤트 상세 화면에서 응답/제안/약속 시간 변경을 새로고침 없이 반영한다.
-- ============================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'event_responses'
    ) then
      alter publication supabase_realtime add table public.event_responses;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'time_proposals'
    ) then
      alter publication supabase_realtime add table public.time_proposals;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'events'
    ) then
      alter publication supabase_realtime add table public.events;
    end if;
  end if;
end $$;
