# 로스트아크 레이드 약속 관리 앱 — PRD

## 1. 개요

친구 그룹이 로스트아크 레이드 약속을 잡을 때, 약속 시간을 정해 올리면
멤버들이 참석 여부를 응답하고 그 결과가 자동 집계되는 웹앱.
총무가 수동으로 가능 인원을 종합하던 수고를 없앤다.

## 2. 목표 / 비목표

### 목표

- 시간이 정해진 약속을 올리고, 멤버별 **참석 / 불참 / 미정** 상태를 한눈에 본다.
- 약속 시간 변경(미루기)을 **누구나 제안**할 수 있고, 주최자가 확정한다.
- 일회성 약속과 반복(정기) 약속 모두 지원한다.

### 비목표 (이번 범위 제외)

- 레이드 공략/숙제 관리, 골드 분배, 캐릭터 스펙 관리
- 외부 알림(카카오톡/디스코드 푸시) — 추후 검토
- 권한 등급/관리자 콘솔 — 친구 그룹 전제, 단순 유지

## 3. 사용자 & 시나리오

- **주최자**: 약속을 올리고 시간 변경을 확정하는 사람 (보통 총무)
- **멤버**: 약속에 참석 여부를 응답하는 친구들

### 핵심 시나리오

1. 주최자가 "토요일 21:00 카멘 하드" 약속을 올린다.
2. 멤버들이 각자 참석 / 불참 / 미정으로 응답한다.
3. 약속 화면에서 상태별 인원과 명단이 실시간 집계된다.
4. 한 멤버가 "22시로 미뤄도 될까?" 시간 변경을 제안한다.
5. 주최자가 제안을 확정하면 시간이 바뀌고 모든 응답이 미정으로 초기화된다 (재확인 유도).

## 4. 기능 요구사항

### 4.1 인증

- 카카오 / 디스코드 소셜 OAuth (Supabase Auth Provider)
- 최초 로그인 시 닉네임(프로필) 자동 생성, 변경 가능
- 비로그인 사용자는 약속 조회/응답 불가 (친구 그룹 전용)

### 4.2 약속 (Event)

| 필드 | 설명 |
|------|------|
| 제목 | 필수 (예: "카멘 하드") |
| 설명 | 선택 |
| 레이드명 | 선택 (예: "카멘", "에키드나") |
| 시작 일시 | 필수 |
| 약속 형태 | 일회성 / 반복 선택 |

- **반복 약속**: 요일+주기 규칙(예: 매주 토 21:00)으로 약속 인스턴스 자동 생성
- **목록 화면**: 다가오는 약속 우선 정렬, 지난 약속 분리 표시
- **상세 화면**: 약속 정보 + 상태별 집계 + 응답 버튼 + 시간 변경 제안 영역

### 4.3 참석 응답 (Response)

- 멤버당 약속별 상태 1개: **참석 / 불참 / 미정**
- 기본값 **미정**, 로그인 상태라면 언제든 변경 가능
- 상세 화면에 상태별 인원 수 + 명단 표시
- 변경은 실시간 반영 (Supabase Realtime)

### 4.4 시간 변경 제안 (Time Proposal)

- **누구나** 새 일시 + 메모를 담아 제안 가능
- 주최자가 제안 목록에서 **확정 / 거절** 선택
- 확정 시: 약속 시간 변경 + 모든 응답을 **미정으로 초기화** (재확인 유도)
- 제안/확정 이력은 약속 상세에 표시

## 5. 데이터 모델 (Supabase Postgres)

### profiles

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | auth.users.id와 동일 |
| nickname | text | 표시 이름 |
| avatar_url | text | 소셜 프로필 이미지 URL |
| created_at | timestamptz | |

### events

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| title | text | 약속 제목 |
| description | text | 선택 |
| raid_name | text | 선택 |
| scheduled_at | timestamptz | 약속 시간 |
| created_by | uuid → profiles | 주최자 |
| is_recurring | bool | 반복 여부 |
| recurrence_rule | text | iCal RRULE 또는 커스텀 규칙, 반복 시에만 |
| status | text | scheduled / cancelled / done |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### event_responses

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| event_id | uuid → events | |
| user_id | uuid → profiles | |
| status | text | attending / declined / undecided |
| updated_at | timestamptz | |

UNIQUE(`event_id`, `user_id`)

### time_proposals

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| event_id | uuid → events | |
| proposed_by | uuid → profiles | |
| proposed_at | timestamptz | 제안하는 새 시간 |
| message | text | 메모 |
| status | text | pending / applied / rejected |
| created_at | timestamptz | |

### RLS 정책 (친구 그룹 전제 — 인증 사용자 폭넓게 허용)

| 작업 | 허용 대상 |
|------|-----------|
| events / responses / proposals 읽기 | 로그인 사용자 전체 |
| 본인 response upsert | `user_id = auth.uid()` |
| proposal 생성 | 로그인 사용자 전체 |
| events 수정/삭제, proposal 확정/거절 | `created_by = auth.uid()` (주최자만) |

## 6. 화면 구성

```
/                   랜딩 — 로그인 유도 (기존 스타터 대체)
/events             약속 목록 (다가오는 / 지난)
/events/new         약속 생성 (일회성/반복 토글)
/events/[id]        약속 상세 — 집계, 응답 버튼, 시간 변경 제안/확정
/profile            닉네임 설정
```

## 7. 기술 스택

| 항목 | 선택 |
|------|------|
| 프레임워크 | Next.js 15 App Router, React 19, TypeScript |
| 백엔드 | Supabase (Auth / Postgres / Realtime), `@supabase/ssr` |
| UI | Tailwind CSS 3.4 + shadcn/ui (기존 설치분 활용) |

## 8. 향후 확장 (백로그)

- when2meet 식 여러 후보 시간 투표
- 카카오/디스코드 인앱 알림 연동
- 레이드별 인원 제한·자동 마감
- 캐릭터/직업 표시
- 모바일 앱 (PWA 또는 React Native)
