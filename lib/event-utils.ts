/**
 * Client-safe event/response utilities.
 * Do not import server-only Supabase helpers from this file.
 */

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

/**
 * 주간 반복 iCalendar RRULE 문자열 생성
 */
export function buildRecurrenceRule(weekdays: number[], untilRaw: string | null): string {
  const byDay = weekdays.map((day) => WEEKDAY_CODES[day]).join(',');
  const parts = ['FREQ=WEEKLY', `BYDAY=${byDay}`];
  if (untilRaw) {
    const until = new Date(`${untilRaw}T23:59:59`)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
    parts.push(`UNTIL=${until}`);
  } else {
    parts.push('COUNT=3');
  }
  return parts.join(';');
}

/**
 * 반복 약속의 각 발생 일시(ISO 문자열) 목록 계산
 * - weekdays: 0(일)~6(토)
 * - untilRaw: 'YYYY-MM-DD' 또는 null (null이면 최대 3회)
 */
export function buildRecurringOccurrences(
  scheduledAtRaw: string,
  weekdays: number[],
  untilRaw: string | null,
): string[] {
  const start = new Date(scheduledAtRaw);
  const until = untilRaw ? new Date(`${untilRaw}T23:59:59`) : null;
  const occurrences: string[] = [];

  for (let week = 0; ; week++) {
    if (!until && week >= 3) break;

    const weekBase = new Date(start);
    weekBase.setDate(start.getDate() + week * 7);
    if (until && weekBase > until) break;

    for (const weekday of weekdays) {
      const occurrence = new Date(start);
      const daysUntilWeekday = (weekday - start.getDay() + 7) % 7;
      occurrence.setDate(start.getDate() + daysUntilWeekday + week * 7);

      if (occurrence < start) continue;
      if (until && occurrence > until) continue;

      occurrences.push(occurrence.toISOString());
    }
  }

  return Array.from(new Set(occurrences)).sort();
}

export type ResponseCounts = {
  attending: number;
  declined: number;
  undecided: number;
};

/**
 * 응답 배열에서 상태별 카운트 반환
 */
export function aggregateResponseCounts(
  responses: { status: string }[]
): ResponseCounts {
  return responses.reduce<ResponseCounts>(
    (acc, r) => {
      if (r.status === 'attending') acc.attending++;
      else if (r.status === 'declined') acc.declined++;
      else acc.undecided++;
      return acc;
    },
    { attending: 0, declined: 0, undecided: 0 }
  );
}
