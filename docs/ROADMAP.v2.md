# 로스트아크 레이드 약속 관리 앱 — ROADMAP v2

> 요청 반영 범위: Discord 공유/연동 강화, 사용자 닉네임 노출 개선, 약속 일괄 선택 삭제.
> 현재 코드 기준으로 `docs/ROADMAP.md`의 MVP/시간 변경/반복/Realtime 일부가 이미 구현되어 있으므로, v2는 기존 로드맵 이후에 붙는 실행 계획으로 작성한다.

---

## 0. 현재 코드 기준 요약

### 이미 존재하는 기반

- Discord OAuth 로그인 UI: `components/login-form.tsx`
- 프로필/닉네임 수정 화면: `app/profile/page.tsx`, `components/profile-form.tsx`
- 약속 목록/상세/생성/수정/삭제: `app/events/*`, `components/event-card.tsx`, `components/delete-event-button.tsx`
- 서버 액션: `app/events/actions.ts`
  - `createEvent`, `updateEvent`, `deleteEvent`, `upsertResponse`
  - `createTimeProposal`, `applyTimeProposal`, `rejectTimeProposal`
- Supabase 테이블: `profiles`, `events`, `event_responses`, `time_proposals`
- RLS: 주최자만 `events` update/delete, 본인만 response upsert

### v2에서 해결할 문제

1. 약속 생성 후 Discord로 자연스럽게 공유해야 한다.
2. Discord 로그인 사용자의 내부 UUID 또는 식별자가 UI에 그대로 노출되지 않아야 하며, 사용자가 닉네임을 안정적으로 설정/수정할 수 있어야 한다.
3. 약속 목록에서 체크박스로 여러 약속을 선택해 한 번에 삭제할 수 있어야 한다.

---

## 1. 우선순위

| 우선순위 | 기능 | 이유 |
|---|---|---|
| P0 | 닉네임/표시명 노출 안정화 | 사용자에게 ID가 보이는 문제는 UX 신뢰도를 바로 떨어뜨림 |
| P0 | 약속 일괄 삭제 | 요청이 명확하고, 현재 단건 삭제 액션을 확장하면 구현 난이도 대비 효과 큼 |
| P1 | 약속 생성 후 Discord 공유 MVP | 앱의 핵심 사용처가 Discord이므로 생성 플로우와 바로 연결 필요 |
| P2 | Discord 메시지에서 참석/불참 버튼 응답 | 구현에는 Discord Bot/Interaction 검증/계정 매핑이 필요하므로 별도 단계 |

---

## 2. Phase v2-0 — 닉네임/표시명 노출 안정화 (P0)

### 목표

Discord 로그인 사용자의 내부 `auth.users.id`/UUID가 목록, 상세, 명단, 주최자 영역에 노출되지 않게 하고, 모든 사용자에게 사람이 읽을 수 있는 표시명을 보장한다.

### 구현 계획

#### 2.1 데이터 모델 보강

새 Supabase migration 생성:

```bash
npx supabase migration new harden_profile_display_names
```

권장 변경:

- `profiles.nickname`을 `not null`에 가깝게 운영한다.
  - 기존 null 값은 안전한 기본값으로 backfill.
  - DB 레벨 `check (char_length(trim(nickname)) between 1 and 32)` 추가 검토.
- Discord 계정 매핑을 위해 nullable 컬럼 추가 검토:
  - `profiles.discord_user_id text unique null`
  - Discord 버튼 응답(P2)을 할 경우 필요.
- `handle_new_user()` 기본 닉네임 추출 로직 개선:
  - Discord OAuth metadata 우선순위 예시:
    1. `global_name`
    2. `full_name`
    3. `name`
    4. `preferred_username`
    5. 이메일 prefix
    6. `사용자-xxxx` 형태의 랜덤/짧은 fallback
  - `avatar_url`도 Discord metadata에서 안정적으로 추출.

주의:

- RLS 정책에서 `profiles_update_own`은 유지한다.
- `raw_user_meta_data`는 사용자가 수정 가능한 값이므로 권한 판단에는 쓰지 않는다. 표시명 기본값으로만 사용한다.

#### 2.2 앱 표시명 헬퍼 추가

권장 파일:

- `lib/profile.ts` 또는 `lib/display-name.ts`

예상 API:

```ts
export function getDisplayName(profile: { nickname: string | null } | null): string
```

규칙:

- 닉네임이 있으면 trim 후 표시.
- 없으면 `(닉네임 미설정)` 또는 `알 수 없음`을 표시.
- UUID, `user_id`, Discord raw id를 fallback으로 절대 노출하지 않는다.

적용 대상:

- `app/events/[id]/page.tsx`
  - 주최자 표시
- `lib/queries.ts`
  - `buildRoster()` fallback
- `components/roster-list.tsx`
  - 명단 표시
- 향후 Discord 공유 메시지 embed 작성 시 organizer/attendee 표시명

#### 2.3 프로필 설정 UX 개선

대상 파일:

- `app/profile/page.tsx`
- `components/profile-form.tsx`
- 공통 네비게이션/인증 버튼 관련 컴포넌트가 있다면 함께 수정

작업:

- 현재 닉네임이 비어 있거나 fallback 상태면 `/profile`에서 명확히 안내:
  - “Discord ID 대신 앱에서 사용할 닉네임을 설정해 주세요.”
- 닉네임 validation:
  - trim 후 1~32자
  - 너무 긴 공백/개행 제거
- 저장 성공 후 현재 페이지 refresh뿐 아니라 이전 작업으로 돌아갈 수 있는 CTA 제공:
  - “약속 목록으로”
- 로그인 직후 닉네임이 비어 있으면 주요 화면 진입 전 `/profile?next=/events`로 유도하는 middleware/server guard는 선택사항.
  - 단, 친구 그룹 앱이라 강제 온보딩이 UX에 좋을 가능성이 높다.

### 완료 기준

- 신규 Discord 로그인 사용자가 `/events`, `/events/[id]`, 참석 명단에서 UUID/raw id로 보이지 않는다.
- 닉네임 미설정 사용자는 `(닉네임 미설정)` 또는 온보딩 CTA로 표시된다.
- `/profile`에서 닉네임을 수정하면 목록/상세/명단에 즉시 반영된다.
- 검증:
  - `npm run lint`
  - `npm run build`
  - 가능하면 Supabase 로컬/원격에서 `profiles.nickname is null` 케이스 수동 확인

---

## 3. Phase v2-1 — 약속 일괄 선택 삭제 (P0)

### 목표

`/events` 목록에서 여러 약속을 체크박스로 선택한 뒤 한 번에 삭제할 수 있게 한다. RLS와 서버 액션 양쪽에서 “내가 주최자인 약속만 삭제 가능”을 보장한다.

### UX 원칙

- 모바일 360px에서도 체크박스, 카드 클릭, 삭제 버튼이 서로 충돌하지 않아야 한다.
- 카드 전체 클릭으로 상세 이동하는 기존 UX를 유지하되, 체크박스 클릭은 상세 이동을 막는다.
- 사용자가 선택한 개수와 삭제 대상 범위를 명확히 보여준다.
- 삭제는 파괴적 작업이므로 확인 단계를 둔다.

### 구현 계획

#### 3.1 서버 액션 추가

대상 파일:

- `app/events/actions.ts`

추가 함수 예시:

```ts
export async function deleteEvents(eventIds: string[]): Promise<{ error?: string; deletedCount?: number }>
```

권장 처리:

1. 로그인 사용자 확인.
2. `eventIds`가 비어 있으면 에러 반환.
3. 최대 개수 제한(예: 50개)으로 실수/남용 방지.
4. Supabase delete:
   - `.from('events').delete().in('id', eventIds).eq('created_by', user.id)`
   - RLS도 주최자만 delete 허용하므로 이중 방어.
5. 삭제 전/후 count가 필요하면 삭제 전 select로 “내가 지울 수 있는 id”를 먼저 확인.
6. `revalidatePath('/events')`.

주의:

- `delete().in()` 결과 row count를 안정적으로 쓰려면 Supabase client 옵션/returning 동작을 확인한다.
- 일부 선택 항목이 타인 주최 약속이면 전체 실패보다 “삭제 가능한 것만 삭제 + n개 제외”가 친구 그룹 앱에는 더 친절하다.
- 단, 혼란을 줄이려면 v1은 “선택한 항목 중 내가 주최자인 항목만 선택 가능”하게 UI에서 제한하는 방식을 권장한다.

#### 3.2 목록 데이터에 주최자 정보 활용

대상 파일:

- `lib/queries.ts`
- `app/events/page.tsx`

현재 `EventWithCounts`에는 `created_by`가 있으므로 로그인 사용자의 id를 가져오면 주최 여부 판단 가능.

작업:

- `EventsPage`에서 `supabase.auth.getClaims()` 또는 `getUser()`로 현재 사용자 확인.
- `EventCard`에 `isOrganizer` 또는 `selectable` prop 전달.
- 비주최자 약속은 체크박스를 숨기거나 disabled 처리하고 “주최자만 삭제 가능” tooltip/보조 텍스트는 선택사항.

#### 3.3 클라이언트 선택 UI 컴포넌트 추가

권장 신규 컴포넌트:

- `components/events-bulk-delete-bar.tsx`
- `components/selectable-event-card.tsx` 또는 `components/event-card.tsx` 확장

가능한 구조:

- `app/events/page.tsx`는 서버 컴포넌트 유지.
- 선택 상태는 클라이언트 컴포넌트에서 관리.
- 서버에서 upcoming/past 배열과 currentUserId를 prop으로 넘김.

예상 UI:

- 목록 상단 sticky/inline action bar:
  - “선택 3개”
  - “선택 해제”
  - “선택 삭제” destructive button
- 각 카드 왼쪽 상단에 checkbox.
- checkbox 클릭 시 `event.stopPropagation()` / `preventDefault()`로 Link 이동 방지.
- 확인 단계:
  - 간단 v1: 버튼 클릭 후 `confirm('선택한 약속 N개를 삭제할까요?')`
  - 개선 v2: shadcn AlertDialog 도입

#### 3.4 권한/부분 실패 메시지

- 삭제 성공: “3개 약속을 삭제했습니다.”
- 선택한 항목 중 삭제 권한이 없는 항목이 있으면:
  - “2개를 삭제했고, 권한이 없는 1개는 건너뛰었습니다.”
- 전체 실패:
  - Supabase error message를 그대로 노출하기보다 한국어 메시지로 매핑.

### 완료 기준

- 주최자인 약속 여러 개를 선택해 한 번에 삭제할 수 있다.
- 타인이 만든 약속은 선택할 수 없거나, 선택되어도 서버에서 삭제되지 않는다.
- 삭제 후 `/events` 목록이 새로고침/refresh되어 삭제된 항목이 사라진다.
- 모바일 360px에서 체크박스와 카드 상세 이동이 오작동하지 않는다.
- 검증:
  - `npm run lint`
  - `npm run build`
  - 계정 A가 만든 약속과 계정 B가 만든 약속을 섞어 권한 동작 수동 확인

---

## 4. Phase v2-2 — 약속 생성 후 Discord 공유 MVP (P1)

### 목표

약속을 만든 직후 사용자가 Discord 채널/DM에 쉽게 공유할 수 있게 한다. 우선은 구현 난이도와 안정성을 고려해 “앱에서 Discord 공유 메시지를 생성하고, 사용자가 Discord에 붙여넣거나 웹훅으로 전송”하는 MVP를 만든다.

### 핵심 설계 결정

Discord에 메시지를 보내는 방법은 크게 3가지다.

| 방식 | 장점 | 단점 | v2 권장 |
|---|---|---|---|
| 공유 문구 복사 + Discord 열기 | 구현 쉬움, Bot 불필요 | 완전 자동 전송 아님 | 1차 fallback으로 필수 |
| Discord Webhook | Bot보다 간단, 채널 자동 전송 가능 | 채널별 webhook 설정 필요, 비밀 URL 관리 필요 | P1 MVP 자동 공유로 권장 |
| Discord Bot + Slash Command/Buttons | 참석 버튼까지 가능, 가장 강한 연동 | 배포/서명 검증/권한/계정 매핑 필요 | P2로 분리 |

P1에서는 다음 순서를 권장한다.

1. 항상 사용 가능한 “공유 메시지 복사” 기능을 먼저 구현.
2. 환경변수 또는 DB 설정으로 Discord Webhook URL이 있으면 “Discord 채널로 공유” 버튼을 추가.
3. Discord 메시지에서 참석/불참 버튼은 P2로 미룬다.

### 구현 계획

#### 4.1 공유 메시지 생성 유틸 추가

권장 파일:

- `lib/discord/share-message.ts`

입력:

- event title
- raid_name
- scheduled_at
- description
- organizer display name
- event detail URL

출력:

- plain text message
- Discord embed payload

예시 메시지:

```text
🗓️ 로스트아크 레이드 약속이 생성되었습니다!

제목: 카멘 하드
시간: 2026-06-13 21:00
주최자: 준영

참석 여부 응답하기: https://.../events/<id>
```

#### 4.2 생성 완료 후 공유 CTA 노출

대상 후보:

- `app/events/actions.ts`
- `app/events/[id]/page.tsx`
- 신규 컴포넌트 `components/discord-share-panel.tsx`

현재 `createEvent()`는 생성 후 `/events/${firstEvent.id}`로 이동한다. 따라서 상세 페이지에서 다음 조건으로 공유 패널을 보여주는 방식이 단순하다.

- `created_by === currentUserId`
- 생성 직후임을 query string으로 전달:
  - `redirectTo: /events/<id>?created=1`
- 또는 상세 화면의 주최자 액션 영역에 항상 “Discord 공유” 버튼 표시.

권장 v1:

- 상세 페이지 주최자 액션 영역에 “Discord 공유” 버튼 상시 표시.
- 생성 직후에는 상단에 “약속이 생성되었습니다. Discord에 공유해 보세요.” callout 표시.

#### 4.3 클립보드/Web Share fallback

신규 클라이언트 컴포넌트:

- `components/discord-share-button.tsx`

기능:

- `navigator.clipboard.writeText(message)`로 복사.
- 모바일 브라우저에서는 `navigator.share()` 지원 시 native share 사용 검토.
- Discord 앱/웹을 여는 링크 제공:
  - `https://discord.com/channels/@me`
  - 특정 서버/채널 deep link는 guild/channel id 설정이 있을 때만 가능.

#### 4.4 Webhook 자동 전송 옵션

환경변수 MVP:

```env
DISCORD_WEBHOOK_URL=...
NEXT_PUBLIC_SITE_URL=https://...
```

서버 액션 추가:

```ts
export async function shareEventToDiscord(eventId: string): Promise<{ error?: string }>
```

권장 검증:

1. 로그인 사용자 확인.
2. 이벤트 조회.
3. `event.created_by === user.id` 확인.
4. `DISCORD_WEBHOOK_URL`이 없으면 친절한 에러 반환.
5. Discord webhook POST:
   - `content` 또는 `embeds`
   - `allowed_mentions: { parse: [] }`로 원치 않는 멘션 방지.
6. 성공 시 `discord_shared_at` 저장을 원하면 migration으로 컬럼 추가.

선택 데이터 모델:

- 단일 친구 서버만 대상으로 하면 환경변수 하나로 충분.
- 여러 Discord 채널을 지원하려면 추후 테이블 추가:
  - `discord_share_targets(id, guild_id, channel_id, webhook_url_encrypted, created_by, created_at)`

보안 주의:

- Webhook URL은 절대 클라이언트에 노출하지 않는다.
- `NEXT_PUBLIC_` prefix를 붙이지 않는다.
- 서버 액션 또는 Route Handler에서만 사용한다.

### 완료 기준

- 약속 상세에서 주최자가 Discord 공유 문구를 복사할 수 있다.
- `DISCORD_WEBHOOK_URL` 설정 시 주최자가 버튼 클릭으로 Discord 채널에 약속 embed를 전송할 수 있다.
- 공유 메시지의 링크를 누르면 로그인 후 해당 약속 상세로 이동한다.
- 비주최자는 자동 webhook 공유 버튼을 사용할 수 없다.
- 검증:
  - `npm run lint`
  - `npm run build`
  - 테스트 Discord webhook으로 실제 메시지 1회 전송 확인
  - webhook 미설정 환경에서 fallback UI가 깨지지 않는지 확인

---

## 5. Phase v2-3 — Discord 메시지에서 참석/불참 선택 (P2, 선택 기능)

### 목표

Discord에 공유된 약속 메시지에서 사용자가 버튼으로 참석/불참/미정을 선택하면 앱의 `event_responses`에 반영되게 한다.

이 기능은 “있으면 좋음, 구현이 어렵다면 우선순위 낮음” 요청에 해당하므로 P2로 분리한다.

### 왜 별도 단계인가

Discord Webhook만으로는 버튼 클릭 interaction을 받을 수 없다. 버튼 응답을 처리하려면 Discord Application/Bot이 필요하다.

필요 요소:

- Discord Application 생성
- Bot 권한/초대
- Interaction endpoint URL 설정
- Next.js Route Handler에서 Discord Ed25519 signature 검증
- Discord user id와 앱 `profiles.id` 매핑
- 버튼 클릭 시 Supabase에 response upsert

### 구현 계획

#### 5.1 Discord 계정 매핑

데이터:

- `profiles.discord_user_id text unique null`

매핑 방법:

- Discord OAuth 로그인 시 Supabase metadata/identity 정보에서 Discord user id를 얻어 저장.
- Supabase Auth metadata에 Discord provider id가 안정적으로 들어오는지 먼저 확인한다.
- 부족하면 별도의 서버 로직 또는 Supabase Admin API가 필요할 수 있다.

완료 기준:

- 현재 로그인 사용자의 `profiles.discord_user_id`가 실제 Discord interaction `member.user.id`와 매칭된다.

#### 5.2 Discord Interaction Route 추가

권장 파일:

- `app/api/discord/interactions/route.ts`

환경변수:

```env
DISCORD_PUBLIC_KEY=...
DISCORD_BOT_TOKEN=...
DISCORD_APPLICATION_ID=...
SUPABASE_SERVICE_ROLE_KEY=... # 서버 전용. 클라이언트 노출 금지.
```

처리:

1. Discord signature headers 검증:
   - `X-Signature-Ed25519`
   - `X-Signature-Timestamp`
2. Ping 요청에 Pong 응답.
3. custom_id 파싱:
   - `event_response:<eventId>:attending`
   - `event_response:<eventId>:declined`
   - `event_response:<eventId>:undecided`
4. Discord user id로 `profiles` 조회.
5. 없으면 “먼저 앱에서 Discord 로그인을 완료해 주세요” ephemeral 응답.
6. 있으면 `event_responses` upsert.
7. Discord 메시지 embed의 집계 업데이트는 선택사항.

보안 주의:

- Interaction endpoint는 반드시 signature 검증 후 처리한다.
- service role key를 쓰는 경우 route handler 안에서만 사용하고, 입력 검증/권한 검사를 직접 수행한다.
- 계정 매핑이 없는 Discord 사용자에게 임의 프로필 생성은 하지 않는다.

#### 5.3 Discord 공유 메시지에 버튼 추가

Webhook/Bot 메시지 payload에 components 추가:

- 참석 ✅
- 불참 ❌
- 미정 ❔

응답 후 UX:

- ephemeral message: “참석으로 저장했습니다.”
- 앱 링크 제공: “상세 보기”

### 완료 기준

- Discord 메시지 버튼 클릭으로 앱의 참석 상태가 변경된다.
- 앱 상세 페이지의 Supabase Realtime/refresh로 변경 결과가 보인다.
- 앱에 로그인/매핑되지 않은 Discord 사용자는 안내 메시지를 받는다.
- 서명 검증 없는 요청은 거부된다.
- 검증:
  - Discord Developer Portal interaction endpoint verify 통과
  - 실제 Discord 서버에서 버튼 3종 클릭 테스트
  - `npm run lint`
  - `npm run build`

---

## 6. 권장 구현 순서

```text
v2-0 닉네임/표시명 안정화
  └─ v2-1 일괄 선택 삭제
      └─ v2-2 Discord 공유 MVP
          └─ v2-3 Discord 버튼 참석 응답 (선택/P2)
```

병렬 가능성:

- v2-0과 v2-1은 충돌이 적어 병렬 가능.
- v2-2는 v2-0의 display name helper를 재사용하므로 v2-0 이후 권장.
- v2-3은 v2-2의 Discord message/share payload 위에 확장하는 것이 좋다.

---

## 7. 파일별 변경 예상 목록

### 공통/프로필

- `supabase/migrations/*_harden_profile_display_names.sql`
- `lib/profile.ts` 또는 `lib/display-name.ts`
- `lib/queries.ts`
- `app/profile/page.tsx`
- `components/profile-form.tsx`
- `app/events/[id]/page.tsx`
- `components/roster-list.tsx`

### 일괄 삭제

- `app/events/actions.ts`
- `app/events/page.tsx`
- `components/event-card.tsx` 또는 신규 `components/selectable-event-card.tsx`
- 신규 `components/events-bulk-delete-bar.tsx`
- 필요 시 `components/ui/alert-dialog.tsx`

### Discord 공유 MVP

- 신규 `lib/discord/share-message.ts`
- 신규 `components/discord-share-button.tsx`
- 신규 `components/discord-share-panel.tsx`
- `app/events/actions.ts`
- `app/events/[id]/page.tsx`
- 선택 migration:
  - `supabase/migrations/*_add_discord_share_tracking.sql`

### Discord 버튼 응답(P2)

- `supabase/migrations/*_add_discord_user_id_to_profiles.sql`
- `app/api/discord/interactions/route.ts`
- `lib/discord/verify-signature.ts`
- `lib/discord/components.ts`
- `app/events/actions.ts` 또는 서버 전용 response service

---

## 8. 테스트/검증 체크리스트

### 기본 품질 게이트

```bash
npm run lint
npm run build
```

### Supabase 검증

- 신규 migration 생성 후:

```bash
npx supabase migration list --local
```

- 가능하면 로컬 reset 또는 원격 dry-run:

```bash
npx supabase db push --linked --dry-run
```

### 수동 시나리오

#### 닉네임

1. Discord 로그인.
2. `/profile`에서 닉네임 변경.
3. 약속 생성.
4. 상세 주최자/명단/카드 어디에도 UUID/raw id가 보이지 않는지 확인.

#### 일괄 삭제

1. 계정 A로 약속 3개 생성.
2. 계정 B로 약속 1개 생성.
3. 계정 A로 `/events`에서 본인 약속만 체크 가능한지 확인.
4. 2개 선택 삭제.
5. 삭제 후 목록과 상세 접근 결과 확인.

#### Discord 공유 MVP

1. webhook 미설정 상태에서 공유 문구 복사 버튼 동작 확인.
2. `DISCORD_WEBHOOK_URL` 설정 상태에서 실제 테스트 채널로 공유.
3. 공유 링크 클릭 → 로그인 → 약속 상세 접근 확인.

#### Discord 버튼 응답(P2)

1. Discord interaction endpoint verify 통과.
2. 매핑된 사용자가 참석/불참/미정 버튼 클릭.
3. 앱 상세의 집계가 변경되는지 확인.
4. 매핑되지 않은 사용자는 앱 로그인 안내를 받는지 확인.

---

## 9. 리스크와 결정 필요 사항

### Discord 공유 방식 결정

- 친구 그룹이 한 서버/채널만 쓴다면 `DISCORD_WEBHOOK_URL` 환경변수 방식이 가장 빠르다.
- 여러 서버/채널이 필요하면 webhook 설정 UI와 저장 테이블이 필요하다.
- Discord 버튼 응답까지 원하면 Bot/Interaction 방식으로 확장해야 한다.

### 계정 매핑 리스크

- Supabase Discord OAuth metadata에서 Discord user id가 어떤 키로 들어오는지 실제 프로젝트에서 확인해야 한다.
- 매핑이 불안정하면 P2 버튼 응답 기능은 보류하고 앱 링크 기반 응답을 유지한다.

### 일괄 삭제 UX 리스크

- 카드 전체가 Link인 현재 구조에서 checkbox 이벤트 버블링을 막아야 한다.
- 모바일에서 checkbox가 너무 작으면 오동작 가능성이 있으므로 44px 터치 영역을 확보한다.

### 데이터 삭제 정책

- 현재는 `events` delete 시 FK cascade로 responses/proposals가 함께 삭제된다.
- 추후 감사/이력 보존이 필요하면 hard delete 대신 `status = 'cancelled'` 또는 soft delete를 검토한다.
- 이번 요청은 “삭제”이므로 v2-1은 현재 hard delete 정책을 유지한다.

---

## 10. v2 완료 정의

v2 필수 완료 범위:

- [x] 앱 어디에도 사용자 UUID/raw Discord id가 일반 표시명으로 노출되지 않는다.
- [x] 사용자는 `/profile`에서 닉네임을 설정/수정할 수 있고, 주요 화면에 반영된다.
- [x] `/events`에서 주최자가 본인 약속을 여러 개 선택해 삭제할 수 있다.
- [x] 약속 상세 또는 생성 직후 화면에서 Discord 공유 문구를 복사할 수 있다.
- [x] webhook 설정 시 Discord 채널로 약속 공유 메시지를 전송할 수 있다.

v2 선택 완료 범위:

- [ ] Discord 메시지 버튼으로 참석/불참/미정 응답이 가능하다.
