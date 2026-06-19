-- ============================================================
-- Discord 사용자 ID 매핑
-- - profiles.discord_user_id 컬럼 추가
-- - handle_new_user: Discord OAuth 로그인 시 Discord 사용자 ID 추출
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN discord_user_id text UNIQUE;

-- handle_new_user 개선 — 기존 닉네임/아바타 로직 유지 + discord_user_id 추출
-- Discord OAuth 로그인: raw_app_meta_data.provider = 'discord'
-- Discord 사용자 ID 후보: provider_id → sub → id (GoTrue 버전에 따라 키 이름 다를 수 있음)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nickname text;
  v_discord_id text;
BEGIN
  v_nickname := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'global_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'preferred_username'), ''),
    nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), ''),
    '사용자-' || substring(new.id::text, 1, 4)
  );

  IF (new.raw_app_meta_data ->> 'provider') = 'discord' THEN
    v_discord_id := coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'provider_id'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'sub'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'id'), '')
    );
  END IF;

  INSERT INTO public.profiles (id, nickname, avatar_url, discord_user_id)
  VALUES (
    new.id,
    v_nickname,
    new.raw_user_meta_data ->> 'avatar_url',
    v_discord_id
  );
  RETURN new;
END;
$$;
