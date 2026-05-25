import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '@/lib/env';
import type { EncryptedString } from '@/lib/types/project';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (base64-encoded)');
  }
  return key;
}

export function encrypt(plaintext: string): EncryptedString {
  // Allow empty string (e.g. token not yet entered) — still encrypt for consistency
  const text = plaintext ?? '';
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}

export function decrypt(encrypted: EncryptedString): string {
  const iv = Buffer.from(encrypted.iv, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');
  const data = Buffer.from(encrypted.data, 'base64');
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Mask a secret for safe display in UI: "abcd…wxyz" */
export function maskSecret(decrypted: string): string {
  if (!decrypted) return '(chưa nhập)';
  if (decrypted.length <= 8) return '••••••••';
  return `${decrypted.slice(0, 4)}…${decrypted.slice(-4)}`;
}
