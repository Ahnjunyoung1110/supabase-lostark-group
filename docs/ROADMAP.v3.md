# 로스트아크 레이드 약속 관리 앱 — ROADMAP v3

## ⚡ 빠른 상태 요약 (2026-06-19)

| Phase | 상태 | 커밋 |
|---|---|---|
| v3-0 캐릭터 데이터 모델 + Edge Function | ✅ 완료 | `09a1a6b` |
| v3-1 pg_cron 자동 갱신 + 수동 새로고침 | ✅ 완료 | `09a1a6b` |
| v3-2 캐릭터 UI (`/characters` 페이지) | ✅ 완료 | `09a1a6b` |
| v3-2.1 랭킹 정렬 지표 확장 (젬/팔찌 효율) | ✅ 완료 | this commit |
| v3-3 Discord 버튼 응답 (Bot + Interaction) | 🚧 미시작 | — |

### 완료된 파일 목록

```
supabase/migrations/20260619171923_add_characters.sql   # characters 테이블 + RLS
supabase/migrations/20260619180500_add_character_efficiency_metrics.sql  # 젬/팔찌/각인/메인노드 효율 컬럼
supabase/migrations/20260619180000_add_pg_cron_schedule.sql  # pg_cron job 등록
supabase/functions/update-character-specs/index.ts      # lopec 파싱 + 효율 지표 + 공식 API 폴백
lib/characters.ts                                       # CharacterRow, CharacterWithProfile 타입
lib/queries.ts                                          # getMyCharacters(), getAllCharactersForCompare() 추가
app/characters/actions.ts                               # addCharacter(), refreshCharacter(), removeCharacter()
app/characters/page.tsx                                 # 서버 컴포넌트 — 내 캐릭터 + 그룹 비교
app/characters/layout.tsx                               # SiteNav 사용
app/events/layout.tsx                                   # SiteNav로 교체 (캐릭터 탭 추가)
components/site-nav.tsx                                 # 공유 네비 (약속/캐릭터 탭, activeSection prop)
components/character-section.tsx                        # 3슬롯 그리드 + 빈 슬롯 폼 토글
components/character-card.tsx                           # 티어 배지, 환산점수, 새로고침/삭제
components/character-form.tsx                           # 캐릭터 등록 폼
components/character-compare-table.tsx                  # 그룹 비교 테이블 (overflow-x-auto)
```

### 주의사항 (pg_cron)
`app.edge_function_url`, `app.service_role_key` DB 설정이 없으면 cron job이 Edge Function을 호출하지 못함.  
Supabase 대시보드 → Project Settings → Database에서 수동 설정 필요.

### 다음 작업: v3-3 Discord 버튼 응답
섹션 5 참고. Bot + Interaction Endpoint 인프라가 필요하므로 Discord Developer Portal 설정 선행.

---

> v1(MVP·시간변경·반복·Realtime), v2(Discord 공유·표시명 안정화·일괄 삭제) 구현 완료 기준.

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

## 2. ✅ Phase v3-0 — 캐릭터 데이터 모델 + 스크래핑 코어 (완료)

- `characters` 테이블: `supabase/migrations/20260619171923_add_characters.sql` (원격 적용 완료)
  - 컬럼: `id, user_id, character_name, server_name, class_name, item_level, spec_score, tier, combat_stats(jsonb), source(lopec|official), source_url, last_fetched_at, fetch_error`
  - 효율 확장: `gem_efficiency_percent`, `bracelet_efficiency_percent`, `engraving_efficiency_percent`, `main_node_efficiency_percent`, `efficiency_stats(jsonb)` (`20260619180500_add_character_efficiency_metrics.sql`, 원격 적용 완료)
  - RLS: 전체 인증 사용자 SELECT, 본인만 INSERT/UPDATE/DELETE
  - 트리거: `check_character_limit()` — 계정당 3개 초과 시 예외
- Edge Function: `supabase/functions/update-character-specs/index.ts` (Deno)
  - `POST { ids?: string[] }` — 특정 캐릭터 또는 전체 갱신
  - lopec.kr HTML 파싱 → 실패 시 공식 로아 API 폴백
  - `/character/specPoint`에서 환산점수/티어/젬 옵션을 수집하고, `/character/efficiency`에서 팔찌·각인·메인노드 효율 카드를 수집
  - lopec 파싱 셀렉터 상세: `memory/reference_lopec_parsing.md` 참조
- 환경변수: `LOSTARK_API_KEY` (supabase secrets set), `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_URL` 자동 주입

---

## 3. ✅ Phase v3-1 — 자동 / 수동 업데이트 (완료)

- pg_cron job `refresh-character-specs` (`0 * * * *`) 원격 DB 등록 완료
  - 마이그레이션: `20260619180000_add_pg_cron_schedule.sql`
  - ⚠️ **`app.edge_function_url`, `app.service_role_key` DB 설정 별도 필요** (Supabase 대시보드 → Project Settings → Database)
- 서버 액션: `app/characters/actions.ts`
  - `addCharacter(name, server?)` — insert + 즉시 Edge Function 호출
  - `refreshCharacter(id)` — 소유권 확인 후 Edge Function 호출
  - `removeCharacter(id)` — 본인 캐릭터만 삭제

---

## 4. ✅ Phase v3-2 — 캐릭터 UI (완료)

- 라우트: `/characters` (`app/characters/page.tsx`, `layout.tsx`)
- 공유 네비: `components/site-nav.tsx` — `activeSection` prop으로 약속/캐릭터 탭 구분
  - `app/events/layout.tsx`, `app/characters/layout.tsx` 모두 SiteNav 사용
- 컴포넌트:
  - `character-section.tsx` — 3슬롯 그리드, 빈 슬롯 클릭 → 폼 토글 (클라이언트)
  - `character-card.tsx` — 티어 배지(색상별), 환산점수, 새로고침/삭제(2단계 확인) (클라이언트)
  - `character-form.tsx` — 캐릭터명·서버명 입력, 등록 중 로딩 표시 (클라이언트)
  - `character-compare-table.tsx` — spec_score 내림차순, overflow-x-auto (서버)
- 쿼리: `lib/queries.ts` — `getMyCharacters(userId)`, `getAllCharactersForCompare(sortBy)`
- 타입: `lib/characters.ts` — `CharacterRow`, `CharacterWithProfile`, `CharacterRankingSortKey`

### v3-2.1 랭킹 지표 확장

- `/characters/ranking`에서 정렬 탭 추가: 환산점수 / 젬 효율 / 팔찌 효율 / 아이템레벨
- 랭킹 테이블에 젬 효율, 팔찌 효율, 각인 효율 컬럼 추가
- 젬 효율은 lopec `specPoint`의 활성 젬 옵션(`ArkgridData_topGemEffect`) 퍼센트 합계로 계산
- 팔찌·각인·메인노드 효율은 lopec `efficiency` 페이지 카드 값에서 수집
- 원격 DB 마이그레이션 및 `update-character-specs` Edge Function 배포 완료

#### v3-2.1 Agent handoff notes

다음 agent가 이 영역을 이어받을 때는 아래 맥락을 먼저 확인한다.

**Delegate task 분할 방식**

1. **lopec 수집/파싱 조사 task**
   - 대상 파일: `supabase/functions/update-character-specs/index.ts`, `supabase/migrations/*`, `lib/characters.ts`.
   - 역할: 현재 lopec 파서가 어떤 HTML 패턴을 쓰는지 확인하고, 실제 lopec `specPoint` / `efficiency` HTML에서 추가 수집 가능한 지표를 찾는 조사.
   - 결과: `팔찌 효율`, `각인 총합 효율`, `메인노드 효율`은 `efficiency` 페이지 카드에서 직접 추출 가능. `젬 효율` 단일 카드는 확인되지 않아 `specPoint`의 활성 젬 옵션 퍼센트 합계로 계산하는 방식을 선택.

2. **랭킹 UI/타입/쿼리 설계 task**
   - 대상 파일: `app/characters/ranking/page.tsx`, `components/character-ranking-table.tsx`, `lib/queries.ts`, `lib/characters.ts`.
   - 역할: 새 numeric 지표를 랭킹 정렬 기준으로 선택하게 만들 때 Server/Client 경계를 어떻게 유지할지 설계.
   - 결과: `searchParams.sort` + whitelist 기반 `CharacterRankingSortKey` + 서버 쿼리 정렬 + `Link` 기반 `CharacterRankingSort` 컴포넌트 구조로 구현. Client Component가 `lib/queries.ts`나 `lib/supabase/server.ts`를 import하지 않도록 유지.

**오래 걸린 이유 / 주의점**

- lopec은 공개 API가 아니라 Next.js 렌더 HTML을 파싱하므로, 실제 HTML을 여러 경로에서 확인해야 했다.
- `젬 효율`은 `efficiency` 페이지 카드에 직접 없었고, `specPoint` 내부 `aria-label="젬 옵션"` 영역의 활성 젬 옵션만 추려 합산해야 했다. 비활성 효과(`ArkgridData_invalidGemEffect`)까지 포함하면 값이 부풀려져서 `ArkgridData_topGemEffect`만 쓰도록 수정했다.
- DB 컬럼 추가가 필요해 Supabase migration을 만들고 원격 DB에 `db push --linked`로 적용했다. 처음 생성된 migration timestamp가 이미 원격에 적용된 migration보다 앞서서 dry-run이 실패했기 때문에 파일명을 `20260619180500_add_character_efficiency_metrics.sql`로 뒤로 이동했다.
- Edge Function은 코드 수정만으로 Vercel 배포에 포함되지 않으므로 `npx supabase functions deploy update-character-specs`를 별도로 실행했다.
- 실제 원격 데이터 갱신까지 확인했다. 예시 확인값: `가나에오옹` 젬 효율 `8.07`, 팔찌 효율 `11.80`; `나는응애에요` 젬 효율 `3.15`, 팔찌 효율 `5.70`.

**검증 명령**

```bash
npm run lint
npm run build
npx supabase migration list --linked
npx supabase db query --linked -o table "select character_name, gem_efficiency_percent, bracelet_efficiency_percent from public.characters order by character_name;"
```

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
