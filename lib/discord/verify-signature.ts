/**
 * Discord Interaction Ed25519 서명 검증
 * Node.js WebCrypto API 사용 — runtime = 'nodejs' 필수
 */
export async function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      Buffer.from(publicKey, 'hex'),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      'Ed25519',
      key,
      Buffer.from(signature, 'hex'),
      Buffer.from(timestamp + body),
    );
  } catch {
    return false;
  }
}
