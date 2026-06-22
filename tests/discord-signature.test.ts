import { describe, it, expect } from 'vitest';
import { verifyDiscordSignature } from '@/lib/discord/verify-signature';

/**
 * Ed25519 키쌍 생성 헬퍼 (테스트 전용)
 */
async function generateTestKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify'],
  );
  const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyHex = Buffer.from(publicKeyRaw).toString('hex');
  return { keyPair, publicKeyHex };
}

async function signMessage(privateKey: CryptoKey, timestamp: string, body: string) {
  const message = Buffer.from(timestamp + body);
  const signatureRaw = await crypto.subtle.sign('Ed25519', privateKey, message);
  return Buffer.from(signatureRaw).toString('hex');
}

describe('verifyDiscordSignature', () => {
  it('유효한 서명 → true', async () => {
    const { keyPair, publicKeyHex } = await generateTestKeyPair();
    const timestamp = '1700000000';
    const body = '{"type":1}';
    const signature = await signMessage(keyPair.privateKey, timestamp, body);

    expect(await verifyDiscordSignature(publicKeyHex, signature, timestamp, body)).toBe(true);
  });

  it('body 변조 시 → false', async () => {
    const { keyPair, publicKeyHex } = await generateTestKeyPair();
    const timestamp = '1700000000';
    const body = '{"type":1}';
    const signature = await signMessage(keyPair.privateKey, timestamp, body);

    expect(
      await verifyDiscordSignature(publicKeyHex, signature, timestamp, '{"type":2}'),
    ).toBe(false);
  });

  it('timestamp 변조 시 → false', async () => {
    const { keyPair, publicKeyHex } = await generateTestKeyPair();
    const timestamp = '1700000000';
    const body = '{"type":1}';
    const signature = await signMessage(keyPair.privateKey, timestamp, body);

    expect(
      await verifyDiscordSignature(publicKeyHex, signature, '9999999999', body),
    ).toBe(false);
  });

  it('잘못된 hex 서명 → false (예외 없이)', async () => {
    const { publicKeyHex } = await generateTestKeyPair();

    expect(
      await verifyDiscordSignature(publicKeyHex, 'not_valid_hex', '1700000000', '{}'),
    ).toBe(false);
  });

  it('빈 publicKey → false (예외 없이)', async () => {
    expect(
      await verifyDiscordSignature('', 'aabbcc', '1700000000', '{}'),
    ).toBe(false);
  });
});
