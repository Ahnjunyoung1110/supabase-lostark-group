# 로스트아크 레이드 약속 관리 앱 — ROADMAP v3

> v1(MVP·시간변경·반복·Realtime), v2(Discord 공유·표시명 안정화·일괄 삭제) 구현 완료 기준.  
> v3은 두 가지 신규 기능을 추가한다:  
> 1. **lopec.kr 기반 캐릭터 스펙 비교** — 그룹 멤버의 주요 캐릭터 스펙을 한 곳에서 비교.  
> 2. **Discord 버튼 응답** — Discord에 공유된 약속 메시지에서 참석/불참/미정을 버튼으로 바로 선택.

---

## 0. 현재 코드 기준 요약

### 이미 존재하는 기반

- Discord OAuth 로그인: `components/login-form.tsx`
- 프로필/닉네임: `app/profile/page.tsx`, `lib/profile.ts` (`getDisplayName()` 헬퍼 — v3에서 재사용)
- 약속 CRUD·일괄 삭제: `app/events/*`, `app/events/actions.ts`
- Discord 공유 (webhook/복사): `lib/discord/share-message.ts`, `components/discord-share-panel.tsx` — v3에서 확장
- Supabase 테이블: `profiles`, `events`, `event_responses`, `time_proposals`
- Supabase CLI: npx v2.105.0 (로컬 설치)
- **Edge Function / pg_cron: 미사용** — v3에서 처음 도입

### v3에서 해결할 문제

1. 레이드 참여 전 "이 캐릭터 스펙이 되나?" 를 확인하려면 외부 사이트를 개별 방문해야 한다. 그룹 내 비교가 불가능하다.
2. Discord에 약속을 공유해도 멤버가 앱에 별도 접속해야 응답할 수 있다. Discord 메시지 버튼으로 바로 응답하면 마찰이 줄어든다.

---

## 1. 우선순위

| 우선순위 | 기능 | 이유 |
|---|---|---|
| P0 | 캐릭터 스펙 비교 (v3-0 ~ v3-2) | 1순위 요청. 독립 기능이라 Discord 인프라 없이 구현 가능 |
| P1 | Discord 버튼 응답 (v3-3) | Bot/Interaction 인프라 부담이 있어 스펙 기능과 독립적으로 병렬 진행 또는 후속 |

---

## 2. Phase v3-0 — 캐릭터 데이터 모델 + 스크래핑 코어

### 목표

`characters` 테이블을 신설하고, lopec.kr HTML을 서버 사이드에서 파싱해 스펙 데이터를 수집하는 Supabase Edge Function을 구축한다. lopec 스크래핑 실패 시 공식 로스트아크 Open API로 폴백한다.

### 왜 lopec.kr인가

| 소스 | 장점 | 단점 |
|---|---|---|
| lopec.kr | 환산 점수(스펙 포인트)·티어 포함, 시각적으로 익숙 | 공개 API 없음 → DOM 파싱 필요, 구조 변경 시 취약 |
| 공식 로아 Open API | 안정적·합법적 | 환산 점수 없음, 아이템레벨/직업만 제공 |

→ **lopec 우선 파싱, 실패 시 공식 API 폴백** 방식을 채택한다.

### 2.1 데이터 모델

새 마이그레이션:

```bash
npx supabase migration new add_characters
```

```sql
-- ============================================================
-- characters: 캐릭터 스펙 저장
-- ============================================================
create table public.characters (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  character_name  text not null,
  server_name     text,                  -- 서버 구분 (예: 카제로스)
  class_name      text,                  -- 직업 (예: 악의 계승자)
  item_level      numeric(8, 2),         -- 아이템 레벨 (예: 1765.83)
  spec_score      numeric(10, 2),        -- 로펙 환산점수 (예: 4639.70)
  tier            text,                  -- 티어명 (예: Diamond, Master)
  combat_stats    jsonb,                 -- 전투 스탯 상세
  source          text not null default 'lopec'
                    check (source in ('lopec', 'official')),
  source_url      text,                  -- 파싱 대상 URL
  last_fetched_at timestamptz,           -- 마지막 성공 fetch 시각
  fetch_error     text,                  -- 마지막 실패 메시지 (성공 시 null)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 사용자별 캐릭터명 중복 방지
create unique index characters_user_name_uniq
  on public.characters (user_id, lower(character_name));

-- 인덱스
create index characters_user_id_idx on public.characters (user_id);
create index characters_spec_score_idx on public.characters (spec_score desc nulls last);

-- updated_at 자동 갱신 (기존 set_updated_at() 재사용)
create trigger characters_set_updated_at
  before update on public.characters
  for each row execute function public.set_updated_at();

-- 계정당 3개 초과 등록 방지 트리거
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
```

```sql
-- RLS
alter table public.characters enable row level security;
grant select, insert, update, delete on public.characters to authenticated;

-- 전체 인증 사용자가 읽기 가능 (그룹 비교용)
create policy "characters_select_authenticated"
  on public.characters for select
  to authenticated using (true);

-- 본인 캐릭터만 insert/update/delete
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
```

`combat_stats` JSONB 예시:

```json
{
  "attackPower":       { "level": 44, "pct": 1.61 },
  "additionalDamage":  { "level": 45, "pct": 3.63 },
  "bossDamage":        { "level": 34, "pct": 2.83 }
}
```

### 2.2 스크래핑 Edge Function

권장 파일:

- `supabase/functions/update-character-specs/index.ts` (Deno 런타임)

입력 (HTTP POST body):

```ts
{
  ids?: string[];   // 특정 character id 배열. 없으면 전체 대상
}
```

로직:

1. Supabase Admin 클라이언트(service role) 초기화.
2. `ids` 있으면 해당 캐릭터만, 없으면 모든 `characters` 행 조회.
3. 각 캐릭터에 대해 **lopec 파싱 시도**:
   - `https://lopec.kr/character/specPoint/{encodeURIComponent(character_name)}` GET.
   - `deno-dom` 또는 정규식으로 `spec_score`, `item_level`, `class_name`, `tier`, `combat_stats` 추출.
   - **셀렉터는 구현 시점에 페이지 DOM 직접 확인 후 확정.** (현재 페이지 조사 결과: 서버 렌더 HTML 확인.)
4. lopec 파싱 실패(HTTP 4xx/5xx, 파싱 에러, 빈 값) 시 **공식 로아 Open API 폴백**:
   - `https://developer-lostark.game.onstove.com/characters/{name}/siblings` 또는 `/armories/characters/{name}/profiles`
   - `item_level`, `class_name` 추출. `source = 'official'`, `fetch_error` 기록.
5. `characters` 테이블 upsert: `last_fetched_at = now()`, 성공 시 `fetch_error = null`.
6. 결과 요약 JSON 반환.

보안 주의:

- Edge Function 내부에서만 service role key 사용.
- 입력 `ids`는 존재하는 캐릭터 id인지 검증.
- lopec.kr 요청에 적절한 `User-Agent` + 요청 간 소량 지연(레이트리밋 방지).

환경변수 (`supabase secrets set`):

```env
LOSTARK_API_KEY=...         # 공식 로아 Open API 키
SUPABASE_SERVICE_ROLE_KEY=... # Edge Function에 자동 주입됨
SUPABASE_URL=...              # Edge Function에 자동 주입됨
```

### 완료 기준

- [x] `characters` 테이블 마이그레이션 적용. (`20260619171923_add_characters.sql`, `npx supabase db push --linked` 완료)
- [ ] Edge Function 로컬 실행 성공: `npx supabase functions serve update-character-specs`.
- [ ] 캐릭터명 입력 → lopec 데이터 파싱 확인.
- [ ] 잘못된 캐릭터명 → `fetch_error` 기록 + 공식 API 폴백 확인.
- [ ] 4개 등록 시도 → 트리거 예외 발생 확인.
- [x] `npm run lint`, `npm run build`

---

## 3. Phase v3-1 — 자동 / 수동 업데이트

### 목표

스펙 데이터를 1시간마다 자동 갱신하고, 사용자가 `/characters` 화면에서 수동으로 즉시 새로고침할 수 있게 한다.

### 3.1 자동 갱신 (pg_cron + pg_net)

새 마이그레이션:

```bash
npx supabase migration new schedule_character_refresh
```

```sql
-- pg_cron, pg_net 확장 활성 (Supabase 대시보드에서도 가능)
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- 1시간마다 Edge Function 호출
select cron.schedule(
  'refresh-character-specs',
  '0 * * * *',
  $$
    select net.http_post(
      url := current_setting('app.edge_function_url') || '/update-character-specs',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
```

주의:

- `app.edge_function_url`, `app.service_role_key`는 Supabase 대시보드 → Project Settings → Database에서 설정하거나, 마이그레이션 내에서 `alter database ... set app.xxx = '...'` 으로 주입.
- 대안: Supabase Dashboard → Cron Jobs UI에서 직접 등록(코드 없이).

### 3.2 수동 갱신 (서버 액션)

새 파일:

- `app/characters/actions.ts`

```ts
// 단일 캐릭터 수동 새로고침
export async function refreshCharacter(characterId: string): Promise<{ error?: string }>

// 내 캐릭터 등록
export async function addCharacter(characterName: string, serverName?: string): Promise<{ error?: string; id?: string }>

// 내 캐릭터 삭제
export async function removeCharacter(characterId: string): Promise<{ error?: string }>
```

`refreshCharacter` 내부:

1. 로그인 사용자 확인.
2. `character.user_id === user.id` 검증.
3. `supabase.functions.invoke('update-character-specs', { body: { ids: [characterId] } })`.
4. 결과 반환.

스크래핑 로직은 Edge Function 단일 출처. 서버 액션은 호출만 담당.

### 완료 기준

- `select * from cron.job` 에서 `refresh-character-specs` 등록 확인.
- 수동 새로고침 버튼 클릭 → `last_fetched_at` 갱신 확인.
- 타인의 캐릭터 새로고침 시도 → 거절 확인.

---

## 4. Phase v3-2 — 캐릭터 UI

### 목표

`/characters` 페이지에서 내 캐릭터를 등록/관리하고, 그룹 전체의 스펙을 비교 테이블로 볼 수 있게 한다.

### 4.1 페이지 구조

- `app/characters/page.tsx` (서버 컴포넌트)
  - 현재 로그인 사용자의 캐릭터 목록 + 그룹 전체 비교 테이블을 한 화면에 표시.
  - 로그인 여부 확인 → 비로그인 시 `/auth/login`으로 리다이렉트.

### 4.2 신규 컴포넌트

| 컴포넌트 | 역할 |
|---|---|
| `components/character-form.tsx` | 캐릭터명·서버명 입력 폼. 제출 시 `addCharacter()` 호출 + 즉시 1회 fetch |
| `components/character-card.tsx` | 등록된 캐릭터 1개 표시. 직업·아이템레벨·환산점수·티어·마지막 갱신 시각. 삭제/새로고침 버튼 |
| `components/refresh-character-button.tsx` | 클라이언트 컴포넌트. 클릭 → `refreshCharacter()` 서버 액션 호출. 로딩 상태 표시 |
| `components/character-compare-table.tsx` | 그룹 전체 캐릭터를 `spec_score` 내림차순 정렬한 비교 테이블 |

### 4.3 쿼리 헬퍼

`lib/queries.ts`에 추가:

```ts
// 내 캐릭터 목록 (최대 3개)
export async function getMyCharacters(userId: string): Promise<CharacterRow[]>

// 그룹 전체 비교용 (닉네임 join 포함, spec_score 내림차순)
export async function getAllCharactersForCompare(): Promise<CharacterWithProfile[]>
```

타입 정의:

- `lib/characters.ts` 신규 파일

```ts
export type CharacterRow = {
  id: string;
  user_id: string;
  character_name: string;
  server_name: string | null;
  class_name: string | null;
  item_level: number | null;
  spec_score: number | null;
  tier: string | null;
  combat_stats: Record<string, { level: number; pct: number }> | null;
  source: 'lopec' | 'official';
  last_fetched_at: string | null;
  fetch_error: string | null;
  created_at: string;
  updated_at: string;
};

export type CharacterWithProfile = CharacterRow & {
  profiles: { nickname: string | null; avatar_url: string | null } | null;
};
```

### 4.4 UI 상세

**내 캐릭터 섹션**:

- 최대 3슬롯 그리드(모바일 1열, `sm:` 이상 3열).
- 각 카드에:
  - 직업 · 캐릭터명 · 아이템레벨
  - 로펙 점수 · 티어 (lopec 소스면 표시, official 소스면 "점수 없음")
  - `last_fetched_at` 시각 + `fetch_error` 있으면 에러 메시지 뱃지
  - 수동 새로고침 버튼(⟳) + 삭제 버튼
- 슬롯 3개 미만이면 빈 슬롯에 "+ 캐릭터 추가" CTA 표시.

**그룹 비교 섹션**:

- 테이블 또는 카드 목록: 닉네임(`getDisplayName` 재사용) · 캐릭터명 · 직업 · 아이템레벨 · 환산점수 · 소스.
- `spec_score` 내림차순 정렬. null 점수는 하단.
- 모바일 360px: 테이블은 `overflow-x: auto` 컨테이너로 가로 스크롤. 또는 카드 스택으로 전환.

**네비게이션**:

- `components/auth-button.tsx` 또는 `app/events/layout.tsx` 공통 네비에 `/characters` 링크 추가.

### 완료 기준

- `/characters`에서 캐릭터 등록 → lopec 스펙 즉시 fetch → 표시 확인.
- 4번째 등록 시도 → "최대 3개" 에러 표시.
- 수동 새로고침 → 스펙 갱신 확인.
- 그룹 비교 테이블에 다른 멤버 캐릭터도 표시되는지 확인.
- `fetch_error` 케이스(잘못된 캐릭터명): 마지막 성공 데이터 유지 + 에러 표시.
- 모바일 360px에서 가로 스크롤 또는 카드 스택으로 깨지지 않는지 확인.
- `npm run lint`, `npm run build`

---

## 5. Phase v3-3 — Discord 버튼 응답 (P1)

### 목표

Discord에 공유된 약속 메시지에서 멤버가 참석/불참/미정 버튼을 클릭하면 앱의 `event_responses`에 즉시 반영된다.

### 왜 별도 Phase인가

- Discord Webhook은 버튼 interaction을 받을 수 없다. **Bot + Interaction Endpoint** 가 필수.
- Discord Application 생성, 서명 검증, 계정 매핑이 추가로 필요해 캐릭터 기능과 독립적으로 진행하는 것이 안전하다.
- 인프라 셋업 후보: Discord Developer Portal (수동), `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_APPLICATION_ID`.

### 5.1 계정 매핑

새 마이그레이션:

```bash
npx supabase migration new add_discord_user_id
```

```sql
alter table public.profiles
  add column discord_user_id text unique;
```

`handle_new_user()` 함수 개선:

- Discord OAuth 로그인 시 `auth.users.raw_user_meta_data`의 provider identity에서 Discord user id 추출.
- `profiles.discord_user_id`에 저장.
- Supabase Discord OAuth metadata 구조 실제 확인 후 키 이름 확정. 후보: `provider_id`, `sub`.

기존 사용자 backfill:

- OAuth 재로그인으로 trigger 재실행 유도. 또는 Supabase Admin API로 수동 매핑 스크립트.

완료 기준:

- Discord 로그인 후 `profiles.discord_user_id`가 실제 Discord user id와 일치하는지 확인.

### 5.2 Discord Bot 메시지 + 버튼

`lib/discord/share-message.ts` 확장:

- 기존 webhook 텍스트 메시지 유지.
- `createBotMessage(event, detailUrl)` 추가:
  - embed: 약속 정보
  - `components`: action row 1개, 버튼 3개
    - 참석 ✅ — `custom_id: event_response:<eventId>:attending`
    - 불참 ❌ — `custom_id: event_response:<eventId>:declined`
    - 미정 ❔ — `custom_id: event_response:<eventId>:undecided`

공유 흐름:

- `DISCORD_BOT_TOKEN` 설정 있으면: Bot이 채널에 버튼 포함 메시지 게시.
- 없으면: 기존 webhook / 복사 fallback 유지.

환경변수 (서버 전용, `NEXT_PUBLIC_` 절대 금지):

```env
DISCORD_PUBLIC_KEY=...
DISCORD_BOT_TOKEN=...
DISCORD_APPLICATION_ID=...
DISCORD_GUILD_ID=...
DISCORD_CHANNEL_ID=...
```

### 5.3 Interaction Route

새 파일:

- `app/api/discord/interactions/route.ts`

```ts
export const runtime = 'nodejs'; // Ed25519 crypto 필요 — Edge 런타임 불가
```

처리 흐름:

1. `X-Signature-Ed25519` + `X-Signature-Timestamp` + `DISCORD_PUBLIC_KEY`로 Ed25519 서명 검증.  
   **검증 실패 시 즉시 401 반환. 이후 로직 진행 금지.**
2. PING(`type: 1`) → PONG(`{ type: 1 }`) 응답 (Developer Portal verify용).
3. MESSAGE_COMPONENT(`type: 3`) 처리:
   - `custom_id` 파싱: `event_response:<eventId>:<status>`.
   - `member.user.id` (또는 `user.id`) → `profiles.discord_user_id` 조회.
   - 매핑 없으면 ephemeral 응답: "앱에서 Discord 로그인 후 이용 가능합니다. [앱 링크]".
   - 매핑 있으면 **service role 클라이언트**로 `event_responses` upsert.
     - `event_id` 존재 여부, `status` 유효값 직접 검증.
   - 성공 ephemeral 응답: "참석으로 저장했습니다. [약속 상세 보기]"

서명 검증 유틸:

- `lib/discord/verify-signature.ts` 신규 파일.
- Node.js `crypto` 모듈(`subtle.verify`, Ed25519) 사용.

보안 주의:

- service role key는 이 route handler 내부에서만 사용.
- 계정 매핑이 없는 Discord 사용자에게 임의 프로필 생성 금지.
- `event_id`가 실제 존재하는지 서버에서 반드시 확인.

### 5.4 Developer Portal 설정 (수동)

1. Discord Developer Portal에서 Application 생성.
2. Bot 추가 → 필요한 권한 부여 (서버 메시지 게시용: `Send Messages`, `Use Slash Commands`).
3. Interaction Endpoint URL: `https://<배포 도메인>/api/discord/interactions`
4. Portal에서 "Verify" 버튼 클릭 → PING/PONG 검증 통과 확인.
5. Bot을 서버에 초대.

### 완료 기준

- Discord Developer Portal interaction endpoint verify 통과.
- 실제 Discord 서버에서 버튼 3종(참석/불참/미정) 클릭 → 앱 `event_responses` 반영.
- 미매핑 Discord 사용자 → 안내 ephemeral 메시지.
- 서명 없는 임의 POST 요청 → 401 반환.
- 앱 상세 페이지의 집계/명단이 Realtime 또는 새로고침 후 변경 반영.
- `npm run lint`, `npm run build`

---

## 6. 권장 구현 순서

```text
v3-0 캐릭터 데이터 모델 + 스크래핑 코어
  └─ v3-1 자동/수동 업데이트
       └─ v3-2 캐릭터 UI

v3-3 Discord 버튼 응답   ← v3-0~v3-2와 독립. 병렬 진행 가능
```

- v3-0 ~ v3-2는 순서 의존성이 있다.
- v3-3은 캐릭터 기능과 완전히 독립이므로 병렬로 진행하거나 캐릭터 기능 완료 후 착수해도 무방하다.
- Discord 인프라(Bot, Developer Portal) 셋업은 v3-3 착수 전에 미리 완료해 두는 것을 권장한다.

---

## 7. 파일별 변경 예상 목록

### 캐릭터 스펙 (v3-0 ~ v3-2)

- `supabase/migrations/*_add_characters.sql` — 신규
- `supabase/migrations/*_schedule_character_refresh.sql` — 신규
- `supabase/functions/update-character-specs/index.ts` — 신규 (Deno)
- `lib/characters.ts` — 신규 (타입 정의)
- `lib/queries.ts` — `getMyCharacters()`, `getAllCharactersForCompare()` 추가
- `app/characters/page.tsx` — 신규 (서버 컴포넌트)
- `app/characters/actions.ts` — 신규
- `components/character-form.tsx` — 신규
- `components/character-card.tsx` — 신규
- `components/refresh-character-button.tsx` — 신규 (클라이언트)
- `components/character-compare-table.tsx` — 신규
- `components/auth-button.tsx` 또는 레이아웃 — `/characters` 링크 추가

### Discord 버튼 응답 (v3-3)

- `supabase/migrations/*_add_discord_user_id.sql` — 신규
- `app/api/discord/interactions/route.ts` — 신규 (Node 런타임)
- `lib/discord/verify-signature.ts` — 신규
- `lib/discord/share-message.ts` — 확장 (버튼 컴포넌트 추가)
- `app/events/actions.ts` — discord_user_id 매핑 로직 추가 가능성

---

## 8. 테스트 / 검증 체크리스트

### 기본 품질 게이트

```bash
npm run lint
npm run build
```

### Supabase 마이그레이션

```bash
npx supabase migration list --local
npx supabase db push --linked --dry-run  # 원격 적용 전 확인
```

### Edge Function 로컬 테스트

```bash
npx supabase functions serve update-character-specs
# 별도 터미널에서:
curl -X POST http://localhost:54321/functions/v1/update-character-specs \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["<character_id>"]}'
```

### 수동 시나리오

#### 캐릭터 스펙

1. `/characters` 접속 → 캐릭터명 입력 → 등록 → 즉시 fetch → 스펙 표시 확인.
2. 잘못된 캐릭터명 입력 → `fetch_error` 표시 + 공식 API 폴백 동작 확인.
3. 4번째 캐릭터 등록 시도 → "최대 3개" 에러.
4. 수동 새로고침 → `last_fetched_at` 갱신.
5. 그룹 비교 테이블에 다른 멤버 캐릭터 표시 확인.
6. `select * from cron.job` → `refresh-character-specs` 등록 확인.

#### Discord 버튼 응답

1. Bot 계정으로 채널에 약속 메시지 + 버튼 게시 확인.
2. Developer Portal interaction endpoint "Verify" 통과.
3. 매핑된 Discord 계정으로 버튼 클릭 → ephemeral 응답 + 앱 응답 반영.
4. 미매핑 계정으로 버튼 클릭 → 앱 로그인 안내 ephemeral.
5. 서명 없는 임의 POST → 401.
6. 앱 상세 `/events/[id]` → 집계/명단 갱신 확인.

---

## 9. 리스크 / 결정 필요 사항

### 스크래핑 취약성

lopec.kr DOM 구조가 변경되면 파싱이 중단된다.

- 대응: `fetch_error` 기록 + 마지막 성공 데이터 유지 + `last_fetched_at` 노출로 사용자가 상태를 확인할 수 있게 한다.
- 공식 API 폴백으로 최소한의 정보(아이템레벨·직업)는 보장한다.
- 셀렉터 확인 및 유지보수가 필요하다. 파싱 실패 알림 로직(Discord webhook 또는 `fetch_error` 컬럼 모니터링)을 추후 검토한다.

### lopec.kr 이용 약관 / 레이트리밋

- 사설 사이트 스크래핑으로 ToS 제약 또는 IP 차단 가능성이 있다.
- 친구 그룹 규모(시간당 최대 N × 3건)라 부하는 낮다.
- User-Agent 설정, 요청 간 지연(jitter), 캐릭터당 last fetch 체크로 불필요한 중복 요청을 줄인다.

### 캐릭터명 충돌

- lopec.kr URL은 캐릭터명만 사용한다. 로아는 서버별 동명 캐릭터가 존재할 수 있다.
- `server_name` 컬럼을 보관해 두었으나, lopec.kr 스크래핑 자체는 캐릭터명만으로 조회한다.
- 동명 캐릭터 문제가 실제 발생하면 서버명 선택 기능을 추가한다.

### Discord 서명 검증 런타임

- Ed25519 서명 검증에는 Node.js `crypto` 모듈이 필요하다.
- `app/api/discord/interactions/route.ts`에 `export const runtime = 'nodejs'` 명시 필수.
- Vercel Edge 런타임(기본값)으로 배포하면 검증이 실패하므로 주의한다.

### Discord 계정 매핑 불확실성

- Supabase Discord OAuth metadata에서 Discord user id가 어떤 키로 저장되는지 실제 프로젝트에서 확인해야 한다.
- 매핑이 불안정하면 v3-3 버튼 응답은 보류하고 앱 링크 방식(v2 수준)을 유지한다.

---

## 10. v3 완료 정의

### v3 필수 완료 범위

- [ ] `/characters` 페이지에서 계정당 최대 3개 캐릭터를 등록/삭제할 수 있다.
- [ ] 등록 시 lopec.kr에서 환산점수·아이템레벨·직업·티어를 자동으로 가져온다.
- [ ] lopec 실패 시 공식 로아 API로 폴백해 최소 정보를 표시한다.
- [ ] 수동 새로고침과 1시간 자동 갱신이 동작한다.
- [ ] 그룹 전체 캐릭터를 환산점수 순으로 비교하는 테이블이 있다.
- [ ] Discord 메시지 버튼으로 참석/불참/미정을 응답하면 앱에 즉시 반영된다.
- [ ] Discord 서명 검증 없는 요청은 거부된다.
- [ ] 앱에 매핑되지 않은 Discord 사용자는 안내 메시지를 받는다.

### v3 선택 완료 범위

- [ ] 스펙 fetch 실패 시 주최자/관리자에게 알림 (Discord 웹훅 또는 이메일).
- [ ] 캐릭터 직업 아이콘 표시.
- [ ] 비교 테이블 필터/정렬 커스터마이즈.
- [ ] `combat_stats` 상세 팝오버.
