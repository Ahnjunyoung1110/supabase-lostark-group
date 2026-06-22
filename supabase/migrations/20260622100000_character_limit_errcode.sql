-- check_character_limit 트리거에 커스텀 SQLSTATE 부여
-- 기존 문자열 매칭(message.includes) 대신 error.code === 'V0001' 로 탐지 가능하게 함
create or replace function public.check_character_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.characters where user_id = new.user_id) >= 3 then
    raise exception '캐릭터는 계정당 최대 3개까지 등록할 수 있습니다.'
      using errcode = 'V0001';
  end if;
  return new;
end;
$$;
