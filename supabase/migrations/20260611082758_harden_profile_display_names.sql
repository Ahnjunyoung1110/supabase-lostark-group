-- ============================================================
-- 프로필 표시명 안정화 마이그레이션
-- - null/공백 닉네임 backfill
-- - handle_new_user Discord metadata 우선순위 개선
-- - 닉네임 길이 check 제약 추가
-- ============================================================

-- 1. 기존 null/공백 닉네임 → 안전한 기본값으로 backfill
UPDATE public.profiles
SET nickname = '사용자-' || substring(id::text, 1, 4)
WHERE nickname IS NULL OR trim(nickname) = '';

-- 2. 닉네임 길이 check 제약 추가 (trim 기준 1~32자)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_nickname_length
  CHECK (nickname IS NULL OR (char_length(trim(nickname)) BETWEEN 1 AND 32));

-- 3. handle_new_user Discord metadata 우선순위 개선
--    global_name > full_name > name > preferred_username > email prefix > 랜덤 fallback
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nickname text;
BEGIN
  v_nickname := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'global_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'preferred_username'), ''),
    nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), ''),
    '사용자-' || substring(new.id::text, 1, 4)
  );

  INSERT INTO public.profiles (id, nickname, avatar_url)
  VALUES (
    new.id,
    v_nickname,
    new.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN new;
END;
$$;
