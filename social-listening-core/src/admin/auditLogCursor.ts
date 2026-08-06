export interface AuditLogCursor {
  /** platform_admin_audit_log has no monotonic seq column — (created_at, id) together break ties deterministically. */
  createdAt: string;
  id: string;
}

/** Opaque per ADR-0011 — callers treat this as a token, never construct one directly. */
export function encodeAuditLogCursor(cursor: AuditLogCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeAuditLogCursor(token: string): AuditLogCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid cursor.');
  }
  const cursor = parsed as Partial<AuditLogCursor>;
  if (typeof cursor.createdAt !== 'string' || typeof cursor.id !== 'string') {
    throw new Error('Invalid cursor.');
  }
  return { createdAt: cursor.createdAt, id: cursor.id };
}
