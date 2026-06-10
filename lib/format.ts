/**
 * 날짜/시간 포맷 유틸리티
 */

/**
 * timestamptz 문자열을 한국어 날짜·시간 형식으로 반환
 * 예: "2026-06-14T21:00:00+09:00" → "2026년 6월 14일 (일) 오후 9:00"
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '미정';
  try {
    const date = new Date(iso);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return '미정';
  }
}

/**
 * datetime-local input value용 포맷
 * 예: Date → "2026-06-14T21:00"
 */
export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
  } catch {
    return '';
  }
}

/**
 * 다가오는 약속 여부 판별
 * scheduled_at이 null이면 미정(다가오는 약속으로 처리)
 */
export function isUpcoming(iso: string | null | undefined): boolean {
  if (!iso) return true;
  return new Date(iso) >= new Date();
}

/**
 * 상대적인 시간 표현
 * 예: "3일 후", "어제", "2시간 전"
 */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '미정';
  try {
    const diff = new Date(iso).getTime() - Date.now();
    const rtf = new Intl.RelativeTimeFormat('ko-KR', { numeric: 'auto' });
    const absDiff = Math.abs(diff);
    if (absDiff < 60_000) return '방금';
    if (absDiff < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
    if (absDiff < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour');
    if (absDiff < 2_592_000_000) return rtf.format(Math.round(diff / 86_400_000), 'day');
    return formatDateTime(iso);
  } catch {
    return '미정';
  }
}
