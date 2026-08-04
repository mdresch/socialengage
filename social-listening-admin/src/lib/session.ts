/**
 * Story 6.1 / ADR-0036 §1, §6 — the admin UI's server-side session.
 *
 * Reference/session-ID pattern (ADR-0036 §1's own named alternative to a full
 * encrypted-cookie session store) — chosen after confirming directly (not assumed) that
 * the alternative doesn't actually fit in a cookie: Entra CIAM's real id_token +
 * access_token + refresh_token together comfortably exceed the ~4KB per-cookie limit
 * browsers enforce, and a real browser silently drops an oversized Set-Cookie header
 * rather than erroring — the first design here (all three tokens JWE-encrypted directly
 * into the cookie) produced a cookie that round-tripped correctly at the HTTP-header
 * level but never actually reached the browser's cookie jar.
 *
 * The cookie itself is a small encrypted (JWE, A256GCM direct encryption) reference —
 * `{ sid }`, nothing token-shaped — httpOnly, Secure (in production), SameSite=Lax, never
 * a value browser-side JavaScript can read. The real tokens live in an in-memory,
 * server-side store keyed by that `sid`. This is a real, named limitation for a later
 * story to revisit, not glossed over: the store does not survive a server restart, and
 * would not be shared across multiple concurrent instances — acceptable at this
 * project's own current single-instance, solo-developer scale (the same "not built
 * speculatively until a second concurrent instance is ever actually run" stance
 * ADR-0020's own distributed rate-limit gate already takes), not a permanent design.
 */

import { EncryptJWT, jwtDecrypt } from 'jose';
import { randomBytes } from 'crypto';

export const SESSION_COOKIE_NAME = 'se_admin_session';

/** ADR-0036 §6 — hard, absolute maximum lifetime, no silent renewal past this ceiling. */
export const SESSION_ABSOLUTE_LIFETIME_SECONDS = 8 * 60 * 60;

/**
 * `secure` is gated on NODE_ENV, not hardcoded true — confirmed directly (not assumed):
 * a real browser silently drops a `Secure`-flagged cookie set over plain http://localhost
 * (verified by inspecting the real Set-Cookie response header vs. the browser's actual
 * cookie jar afterward — the header was correct, the cookie jar was empty). Real
 * deployments run over https, where this evaluates true; local dev runs over http, where
 * it must be false or no session would ever persist. The same convention NextAuth.js's
 * own default cookie config uses.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export interface SessionTokens {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  /**
   * Story 6.1 / ADR-0036 §5 — the resolved { type, tenantId?, userId?, role?, adminId? }
   * shape from core's GET /v1/me, or null if that endpoint isn't reachable yet (it does
   * not exist in social-listening-core today — see core-client.ts's own note). Never
   * derived from any Entra token claim directly (ADR-0029 §2).
   */
  identity: unknown | null;
}

export interface SessionPayload extends SessionTokens {
  /** Epoch seconds. The 8-hour ceiling is measured from here and never refreshed. */
  issuedAt: number;
}

function sessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is not set — see .env.example (Story 6.1 / ADR-0036 §1).');
  }
  const key = Buffer.from(secret, 'base64');
  if (key.length < 32) {
    throw new Error(
      'SESSION_SECRET must decode to at least 256 bits (32 bytes) of real entropy (ADR-0036 §1) — ' +
        'generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  return new Uint8Array(key.subarray(0, 32));
}

interface StoredSession {
  tokens: SessionTokens;
  issuedAt: number;
}

/**
 * In-process only (see this file's own header comment for why that's an accepted, named
 * limitation right now) — but anchored on `globalThis`, not a plain module-level
 * variable. Confirmed directly (not assumed): Next.js compiles `proxy.ts` and Route
 * Handlers as separate module bundles even though both run in the same Node.js process
 * (verified by logging a random per-load instance id from this file — proxy.ts and the
 * auth Route Handlers each loaded their own, distinct copy). A `const` here would give
 * each bundle its own empty Map, so proxy.ts would never see a session a Route Handler
 * just created. `globalThis` is the one thing both bundles actually share.
 */
const globalForSession = globalThis as unknown as { __seAdminSessionStore?: Map<string, StoredSession> };
const sessionStore: Map<string, StoredSession> =
  globalForSession.__seAdminSessionStore ?? (globalForSession.__seAdminSessionStore = new Map());

function pruneExpired(): void {
  const nowSeconds = Math.floor(Date.now() / 1000);
  for (const [sid, stored] of sessionStore) {
    if (nowSeconds - stored.issuedAt > SESSION_ABSOLUTE_LIFETIME_SECONDS) {
      sessionStore.delete(sid);
    }
  }
}

export async function encryptSession(
  tokens: SessionTokens,
  issuedAt: number = Math.floor(Date.now() / 1000)
): Promise<string> {
  pruneExpired();
  const sid = randomBytes(32).toString('base64url');
  sessionStore.set(sid, { tokens, issuedAt });

  return new EncryptJWT({ sid })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt(issuedAt)
    .encrypt(sessionKey());
}

/**
 * Returns null for a missing, tampered, malformed, past-its-8-hour-ceiling, or
 * server-store-evicted cookie — every one of those cases is "treat as signed out," never
 * differentiated to the caller (mirrors entraAuthMiddleware.ts's own "one outcome
 * regardless of cause" convention).
 */
export async function decryptSession(cookieValue: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtDecrypt(cookieValue, sessionKey());
    const sid = (payload as { sid?: string }).sid;
    const issuedAt = payload.iat;
    if (!sid || typeof issuedAt !== 'number') {
      return null;
    }

    const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt;
    if (ageSeconds > SESSION_ABSOLUTE_LIFETIME_SECONDS) {
      return null;
    }

    const stored = sessionStore.get(sid);
    if (!stored) {
      return null;
    }

    return { ...stored.tokens, issuedAt: stored.issuedAt };
  } catch {
    return null;
  }
}

/** Removes the server-side record — called on sign-out, in addition to clearing the cookie. */
export async function deleteSession(cookieValue: string): Promise<void> {
  try {
    const { payload } = await jwtDecrypt(cookieValue, sessionKey());
    const sid = (payload as { sid?: string }).sid;
    if (sid) {
      sessionStore.delete(sid);
    }
  } catch {
    // Malformed/undecryptable cookie — nothing to delete.
  }
}
