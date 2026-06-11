/**
 * Client-safe event/response utilities.
 * Do not import server-only Supabase helpers from this file.
 */

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
