import { createHash, createHmac, timingSafeEqual } from 'crypto';

export interface DSRReceiptPayload {
  requestId: string;
  tenantId: string;
  subjectHash: string;
  requestType: 'access' | 'rectification' | 'erasure' | 'restriction' | 'takedown' | string;
  timestamp: string;
}

export interface SignedDSRReceipt {
  receiptId: string;
  payload: DSRReceiptPayload;
  signature: string;
  issuedAt: string;
}

const DEFAULT_SECRET = process.env.DSR_RECEIPT_SECRET || 'socialengage-dsr-master-receipt-signing-key-2026';

/**
 * Computes a deterministic one-way SHA-256 hash of a normalized email address.
 * Never stores or exposes raw personal identifiers in public receipt payloads.
 */
export function generateSubjectHash(email: string): string {
  const normalized = email.trim().toLowerCase();
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Computes an HMAC-SHA256 digital signature over a canonically sorted JSON representation
 * of the DSR receipt payload.
 */
export function generateDSRReceipt(payload: DSRReceiptPayload, secret: string = DEFAULT_SECRET): string {
  const sortedKeys = Object.keys(payload).sort() as Array<keyof DSRReceiptPayload>;
  const canonicalObj: Record<string, any> = {};
  for (const k of sortedKeys) {
    canonicalObj[k] = payload[k];
  }
  const canonicalString = JSON.stringify(canonicalObj);
  return createHmac('sha256', secret).update(canonicalString).digest('hex');
}

/**
 * Verifies the authenticity of a DSR receipt signature using constant-time equality check
 * to prevent timing side-channel attacks.
 */
export function verifyDSRReceipt(
  payload: DSRReceiptPayload,
  signature: string,
  secret: string = DEFAULT_SECRET
): boolean {
  if (!signature || typeof signature !== 'string') {
    return false;
  }
  const expected = generateDSRReceipt(payload, secret);
  try {
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) {
      return false;
    }
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}
