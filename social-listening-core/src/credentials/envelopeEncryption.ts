import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const DEK_LENGTH_BYTES = 32; // AES-256
const IV_LENGTH_BYTES = 12; // recommended length for AES-GCM

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/** A fresh, random per-credential data-encryption key (DEK) — never persisted unwrapped. */
export function generateDataEncryptionKey(): Buffer {
  return randomBytes(DEK_LENGTH_BYTES);
}

export function encryptWithDek(plaintext: string, dek: Buffer): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function decryptWithDek(payload: EncryptedPayload, dek: Buffer): string {
  const decipher = createDecipheriv('aes-256-gcm', dek, payload.iv);
  decipher.setAuthTag(payload.authTag);
  return Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]).toString('utf8');
}
