import { describe, it, expect } from 'vitest';
import { buildRecurrenceRule, buildRecurringOccurrences } from '@/lib/event-utils';

describe('buildRecurrenceRule', () => {
  it('untilRaw 없으면 COUNT=3 포함', () => {
    const rule = buildRecurrenceRule([1, 3], null); // 월, 수
    expect(rule).toContain('FREQ=WEEKLY');
    expect(rule).toContain('BYDAY=MO,WE');
    expect(rule).toContain('COUNT=3');
    expect(rule).not.toContain('UNTIL=');
  });

  it('untilRaw 있으면 UNTIL 포함', () => {
    const rule = buildRecurrenceRule([5], '2026-12-31'); // 금
    expect(rule).toContain('BYDAY=FR');
    expect(rule).toContain('UNTIL=');
    expect(rule).not.toContain('COUNT=');
  });

  it('UNTIL 형식이 iCalendar 포맷 (Z 끝)', () => {
    const rule = buildRecurrenceRule([0], '2026-07-01');
    const untilMatch = rule.match(/UNTIL=(\S+)/);
    expect(untilMatch).not.toBeNull();
    expect(untilMatch![1]).toMatch(/^\d{8}T\d{6}Z$/);
  });
});

describe('buildRecurringOccurrences', () => {
  it('untilRaw 없으면 최대 3주치 반환', () => {
    // 2026-06-22 월요일 기준, 매주 월요일
    const result = buildRecurringOccurrences('2026-06-22T10:00:00', [1], null);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(new Date('2026-06-22T10:00:00').toISOString());
    expect(result[1]).toBe(new Date('2026-06-29T10:00:00').toISOString());
    expect(result[2]).toBe(new Date('2026-07-06T10:00:00').toISOString());
  });

  it('untilRaw 이후 날짜 제외', () => {
    const result = buildRecurringOccurrences('2026-06-22T10:00:00', [1], '2026-07-01');
    expect(result).toHaveLength(2); // 6/22, 6/29 — 7/6은 until 초과
  });

  it('시작일 이전 요일 제외', () => {
    // 2026-06-22 월요일, 매주 일(0)+월(1) → 첫 주 일요일(6/21)은 start 이전이라 제외
    const result = buildRecurringOccurrences('2026-06-22T10:00:00', [0, 1], null);
    // 1주: 월 22일 | 2주: 일 28일 + 월 29일 | 3주: 일 5일 + 월 6일
    expect(result[0]).toContain('2026-06-22');
    result.forEach((iso) => {
      expect(new Date(iso) >= new Date('2026-06-22T10:00:00')).toBe(true);
    });
  });

  it('중복 제거 후 정렬', () => {
    const result = buildRecurringOccurrences('2026-06-22T10:00:00', [1], null);
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
    // Set으로 중복 제거 확인
    expect(result).toEqual([...new Set(result)]);
  });
});
