-- pg_cron, pg_net 확장 활성화
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- ============================================================
-- pg_cron: 1시간마다 캐릭터 스펙 자동 갱신
-- ============================================================
-- 사전 설정 필요 (Supabase 대시보드 → Project Settings → Database 또는 아래 명령):
--   alter database postgres set app.edge_function_url = 'https://<ref>.supabase.co/functions/v1';
--   alter database postgres set app.service_role_key  = '<service_role_key>';
-- ============================================================
select cron.schedule(
  'refresh-character-specs',
  '0 * * * *',
  $$
    select net.http_post(
      url     := current_setting('app.edge_function_url', true) || '/update-character-specs',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := '{}'::jsonb
    )
    where current_setting('app.edge_function_url', true) is not null
      and current_setting('app.service_role_key',  true) is not null;
  $$
);
