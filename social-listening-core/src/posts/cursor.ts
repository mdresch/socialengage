export interface PostCursor {
  /** social_posts.seq, a monotonic identity column — see migrations/0006_*.sql. */
  seq: string;
}

/** Opaque per ADR-0011 — callers treat this as a token, never construct one directly. */
export function encodeCursor(cursor: PostCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(token: string): PostCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid cursor.');
  }
  const cursor = parsed as Partial<PostCursor>;
  if (typeof cursor.seq !== 'string') {
    throw new Error('Invalid cursor.');
  }
  return { seq: cursor.seq };
}
