/**
 * 표시명 관련 순수 유틸리티
 * UUID/user_id/raw Discord id를 절대 fallback으로 쓰지 않는다.
 */

export function getDisplayName(
  profile: { nickname: string | null } | null | undefined
): string {
  const trimmed = profile?.nickname?.trim();
  return trimmed || '(닉네임 미설정)';
}

/** 닉네임 유효성 검사: trim 후 1~32자 */
export function validateNickname(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return '닉네임을 입력해 주세요.';
  if (trimmed.length > 32) return '닉네임은 32자 이하로 입력해 주세요.';
  return null;
}
