/**
 * The sole sanctioned path from social-listening-admin to social-listening-core (ADR-0001).
 * Every call reaches core over HTTP against a configurable base URL — never a database
 * driver, never an in-process import of core's source. See
 * .claude/skills/core-api-client/SKILL.md before adding calls here.
 *
 * Story 6.1 / ADR-0036 §2 — also the single choke point that attaches
 * `Authorization: Bearer <token>` to any authenticated call: no other file in this repo
 * constructs that header. See .claude/skills/admin-auth-session/SKILL.md.
 */

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, decryptSession } from './session';

export interface AdminTenant {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  licenseSeatCount: number;
  activeSeatCount: number;
  domain: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditLogEntry {
  id: string;
  actorIdentity: string;
  operation: string;
  targetTenantId: string | null;
  detail: unknown;
  createdAt: string;
}

export interface AdminAuditLogPage {
  entries: AdminAuditLogEntry[];
  nextCursor: string | null;
}

function coreBaseUrl(): string {
  const baseUrl = process.env.CORE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('CORE_API_BASE_URL is not set — social-listening-admin cannot reach social-listening-core.');
  }
  return baseUrl;
}

/**
 * Placeholder call proving the REST-only mechanism works end to end. Real endpoint
 * calls (connect/disconnect a platform, manage watchlists, connector status, ...)
 * are added here as Phase 1 stories build the corresponding core routes and admin
 * features — see docs/implementation-plan.md. Path is under /v1/ per ADR-0017
 * (Story 1.3) — every core route lives behind a version prefix, no exceptions.
 */
export async function checkCoreHealth(): Promise<Response> {
  return fetch(`${coreBaseUrl()}/v1/health`);
}

/**
 * Story 6.1 / ADR-0036 §2 — reads the caller's server-side session cookie itself (via
 * Next.js's cookies() API) and attaches the bearer token, so no Server Component/Route
 * Handler needs to plumb a token through by hand. Throws if there is no valid session —
 * callers running behind middleware.ts's own redirect-if-unauthenticated gate should
 * never reach this with none.
 */
export async function authenticatedCoreFetch(path: string, init?: RequestInit): Promise<Response> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  if (!session) {
    throw new Error('authenticatedCoreFetch() called with no valid session.');
  }
  return fetch(`${coreBaseUrl()}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${session.accessToken}` },
  });
}

/**
 * Story 6.1 / ADR-0036 §5 — the core-side identity-exposure endpoint (built 2026-08-05,
 * Story 5.11, `GET /v1/me`). Takes an explicit access token (rather than reading the
 * session cookie, like authenticatedCoreFetch() above does) because its only caller today
 * is the sign-in callback itself, bootstrapping the session before that cookie is a
 * readable request cookie.
 *
 * Returns `unknown`, not core's real ResolvedIdentity type, deliberately — this is raw
 * JSON off the wire and must be validated (role-routing.ts's isResolvedIdentity()) before
 * a caller treats it as a real identity. A non-2xx response or a network failure here is
 * treated as "identity not yet resolvable," not a fatal sign-in error — callers get `null`
 * and must handle that, not assume core always answers.
 */
export async function fetchResolvedIdentity(accessToken: string): Promise<unknown | null> {
  try {
    const response = await fetch(`${coreBaseUrl()}/v1/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export interface SelfServiceSignupOutcome {
  status: number;
  body: { error?: string; id?: string; name?: string; userId?: string; [key: string]: unknown };
}

/**
 * Story 6.7 / ADR-0037 §5 — calls core's already-built POST
 * /v1/tenants/self-service-signup with an explicit access token (the caller has
 * no session cookie yet at this point — same reason fetchResolvedIdentity() above
 * takes an explicit token rather than reading cookies()). Returns the raw
 * status/body rather than throwing on a non-2xx: 409 (domain match /
 * already-belongs) and 5xx are both real, expected outcomes signupFlow.ts must
 * distinguish and react to, not failures this function should collapse into one
 * generic error.
 */
export async function selfServiceSignup(accessToken: string, name: string): Promise<SelfServiceSignupOutcome> {
  const response = await fetch(`${coreBaseUrl()}/v1/tenants/self-service-signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ name }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.9 / Story 1.8 — reads the caller's own tenant's settings
 * (GET /v1/tenants/me, ADR-0031). Read-only; writes to
 * status/licenseSeatCount/domain remain Platform-Admin-only (Story 5.12,
 * `updateAdminTenant()` above). Throws on a non-2xx rather than returning a
 * partial/empty tenant — this screen has nothing sensible to render without
 * a real tenant object.
 */
export async function getMyTenant(): Promise<AdminTenant> {
  const response = await authenticatedCoreFetch('/v1/tenants/me');
  if (!response.ok) {
    throw new Error(`Failed to load tenant settings: ${response.status}`);
  }
  return (await response.json()) as AdminTenant;
}

export interface DomainSignupAttemptSummary {
  domain: string;
  distinctEmailCount: number;
  escalated: boolean;
  emails: string[];
}

/**
 * Story 6.10 / Story 5.16 (ADR-0037 §8b) — reads the Same-Domain Invite
 * Assist data for the caller's own tenant (GET
 * /v1/tenants/domain-signup-attempts, tenant_admin only). All tenant
 * scoping is the backend's own RLS (Story 5.16) — this function takes no
 * tenantId parameter and must not gain one; see this component's own
 * SKILL.md. Throws on a non-2xx (a 403 from a stale/non-admin session is a
 * real, expected outcome the caller must not silently swallow into an empty
 * list).
 */
export async function listDomainSignupAttempts(): Promise<DomainSignupAttemptSummary[]> {
  const response = await authenticatedCoreFetch('/v1/tenants/domain-signup-attempts');
  if (!response.ok) {
    throw new Error(`Failed to load domain signup attempts: ${response.status}`);
  }
  const payload = (await response.json()) as { domains?: DomainSignupAttemptSummary[] };
  return Array.isArray(payload.domains) ? payload.domains : [];
}

export interface TenantUser {
  id: string;
  tenantId: string;
  email: string;
  role: 'tenant_admin' | 'tenant_user';
  status: 'invited' | 'active';
  accessEndsAt: string | null;
}

export interface TenantUserActionOutcome {
  status: number;
  body: { error?: string; id?: string; [key: string]: unknown };
}

/**
 * Story 6.8 / Story 1.9 — lists every user for the caller's own tenant
 * (GET /v1/tenants/users, RLS-scoped, no role gate on read).
 */
export async function listTenantUsers(): Promise<TenantUser[]> {
  const response = await authenticatedCoreFetch('/v1/tenants/users');
  if (!response.ok) {
    throw new Error(`Failed to list tenant users: ${response.status}`);
  }
  const payload = (await response.json()) as { users?: TenantUser[] };
  return Array.isArray(payload.users) ? payload.users : [];
}

/**
 * Story 6.8 / Story 1.9 — invites a new user into the caller's tenant
 * (POST /v1/tenants/users, tenant_admin only). Returns the raw status/body
 * rather than throwing on a non-2xx: 403 (role gate) and 409 (seat ceiling)
 * are both real, expected outcomes the invite form must react to
 * specifically (Story 6.8's own AC3/AC5), not failures collapsed into one
 * generic error.
 */
export async function inviteTenantUser(input: {
  email: string;
  role?: 'tenant_admin' | 'tenant_user';
}): Promise<TenantUserActionOutcome> {
  const response = await authenticatedCoreFetch('/v1/tenants/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.8 / Story 1.9 — sets or clears (null) a user's access_ends_at
 * (PATCH /v1/tenants/users/:id, tenant_admin only). Same raw status/body
 * pattern as inviteTenantUser() above, for the same reason.
 */
export async function setUserAccessEndsAt(
  userId: string,
  accessEndsAt: string | null
): Promise<TenantUserActionOutcome> {
  const response = await authenticatedCoreFetch(`/v1/tenants/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessEndsAt }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface AccessHistoryEntry {
  id: string;
  targetUserId: string;
  actorUserId: string;
  operation: string;
  oldValue: string | null;
  newValue: string | null;
  occurredAt: string;
}

/**
 * Story 6.14 / Story 5.17 — the audit trail for one user's own
 * access_ends_at writes (GET /v1/tenants/users/:id/access-history,
 * tenant_admin only, RLS-scoped server-side). Throws on a non-2xx, the same
 * convention listTenantUsers() already uses — unlike inviteTenantUser()/
 * setUserAccessEndsAt() above, there's no documented non-2xx outcome this
 * screen needs to react to differently; a 403/404 here is a genuine failure.
 */
export async function getUserAccessHistory(userId: string): Promise<AccessHistoryEntry[]> {
  const response = await authenticatedCoreFetch(`/v1/tenants/users/${encodeURIComponent(userId)}/access-history`);
  if (!response.ok) {
    throw new Error(`Failed to load access history: ${response.status}`);
  }
  const payload = (await response.json()) as { entries?: AccessHistoryEntry[] };
  return Array.isArray(payload.entries) ? payload.entries : [];
}

export interface ConnectorStatus {
  status: 'healthy' | 'degraded' | 'failing' | 'disconnected';
  lastSuccessfulFetchAt: string | null;
  lastAttemptAt: string | null;
  consecutiveFailures: number;
  credentialStatus: 'valid' | 'expiring_soon' | 'expired' | 'revoked' | null;
  /** Story 1.12 (ADR-0051 Open Question 5) — real activation state, tenant-wide scope, read fresh, never derived from credentialStatus/authMode. */
  isActive: boolean;
}

export interface ConnectorActivationOutcome {
  status: number;
  body: { error?: string; platformId?: string; ownerType?: string; isActive?: boolean; [key: string]: unknown };
}

export interface ConnectorActionOutcome {
  status: number;
  body: { error?: string; id?: string; [key: string]: unknown };
}

/**
 * Story 6.3 (healed 2026-08-10) / Story 4.3 (ADR-0022) — reads a platform's
 * real derived health (`GET /v1/connectors/:platformId`). `connected` is not
 * a field this endpoint returns directly — callers derive it themselves as
 * `credentialStatus !== null` (see `tenant/connectors/page.tsx`), the same
 * derivation `deriveConnectorHealth()` itself uses server-side. Throws on a
 * non-2xx rather than silently treating a real backend failure as
 * "not connected" — the caller must distinguish the two.
 */
export async function getConnectorStatus(platformId: string): Promise<ConnectorStatus> {
  const response = await authenticatedCoreFetch(`/v1/connectors/${encodeURIComponent(platformId)}`);
  if (!response.ok) {
    throw new Error(`Failed to load connector status for ${platformId}: ${response.status}`);
  }
  return (await response.json()) as ConnectorStatus;
}

/**
 * Story 6.3 (healed 2026-08-10) / Story 1.7 (ADR-0034) — stores a credential
 * for a platform (`POST /v1/connectors/:platformId/connect`). `credential`
 * is always a single string on the wire — for a multi-part credential (e.g.
 * Azure AI Language's `{endpoint,key}`), the caller JSON-encodes it first
 * (see `ConnectForm.tsx`); this function never inspects or reshapes it.
 * Returns the raw status/body rather than throwing on a non-2xx: 403 (role
 * gate) is a real, expected outcome the form must react to specifically
 * (AC3), not collapsed into a generic error.
 */
export async function connectPlatform(
  platformId: string,
  credential: string,
  ownerType: 'tenant' | 'user'
): Promise<ConnectorActionOutcome> {
  const response = await authenticatedCoreFetch(`/v1/connectors/${encodeURIComponent(platformId)}/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential, ownerType }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.3 (healed 2026-08-10) / Story 1.7 (ADR-0034) — removes a
 * credential (`DELETE /v1/connectors/:platformId/disconnect`), discriminated
 * by an `ownerType` query parameter (no request body on a DELETE, matching
 * every other route in this repo). Same raw status/body pattern as
 * `connectPlatform()`, for the same reason (a 403 here is real and expected,
 * not exceptional).
 */
export async function disconnectPlatform(
  platformId: string,
  ownerType: 'tenant' | 'user'
): Promise<ConnectorActionOutcome> {
  const response = await authenticatedCoreFetch(
    `/v1/connectors/${encodeURIComponent(platformId)}/disconnect?ownerType=${encodeURIComponent(ownerType)}`,
    { method: 'DELETE' }
  );
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.15 (Story 1.11, ADR-0051) — turns a connector on
 * (`POST /v1/connectors/:platformId/activate`), independent of whether a
 * credential is stored. `ownerType: 'user'` always uses the caller's own
 * resolved identity server-side (Story 1.11 AC4) — this function never
 * accepts or sends a `userId`. Same raw `{status, body}` outcome pattern as
 * `connectPlatform()` — a `400`/`403` here is a real, expected outcome the
 * UI must react to, not an exception.
 */
export async function activatePlatform(
  platformId: string,
  ownerType: 'tenant' | 'user'
): Promise<ConnectorActivationOutcome> {
  const response = await authenticatedCoreFetch(`/v1/connectors/${encodeURIComponent(platformId)}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerType }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.15 (Story 1.11, ADR-0051) — turns a connector off
 * (`POST /v1/connectors/:platformId/deactivate`) without deleting its
 * stored credential (`disconnectPlatform()` remains the destructive
 * action). `userId` is optional and only meaningful for
 * `ownerType: 'user'` — the offboarding case where a `tenant_admin`
 * deactivates a different user's own personal connector (Story 1.11 AC5,
 * mirroring `disconnect`'s own offboarding-override shape); omitted, it
 * defaults server-side to the caller's own identity.
 */
export async function deactivatePlatform(
  platformId: string,
  ownerType: 'tenant' | 'user',
  userId?: string
): Promise<ConnectorActivationOutcome> {
  const response = await authenticatedCoreFetch(`/v1/connectors/${encodeURIComponent(platformId)}/deactivate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userId ? { ownerType, userId } : { ownerType }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.6 / ADR-0030, ADR-0031 — Platform Admin tenant registry surface.
 */
export async function listAdminTenants(): Promise<AdminTenant[]> {
  const response = await authenticatedCoreFetch('/v1/admin/tenants');
  if (!response.ok) {
    throw new Error(`Failed to list tenants: ${response.status}`);
  }
  const payload = (await response.json()) as { tenants?: AdminTenant[] };
  return Array.isArray(payload.tenants) ? payload.tenants : [];
}

export interface AdminTenantActionOutcome {
  status: number;
  body: { error?: string; [key: string]: unknown };
}

export interface BreakGlassRequestSummary {
  id: string;
  requestedBy: string;
  targetTenantId: string;
  targetUserId: string;
  status: 'requested' | 'executed' | 'denied';
}

export interface BreakGlassExecutionResult {
  requestId: string;
  targetUserId: string;
  executedAt: string;
  temporaryAccessPass: string;
}

export interface BreakGlassActionOutcome {
  status: number;
  body: Partial<BreakGlassRequestSummary & BreakGlassExecutionResult> & { error?: string };
}

/**
 * Story 6.6 (reworked 2026-08-12) / Story 5.12 — create tenant via Platform
 * Admin endpoint. Returns the raw status/body rather than throwing on a
 * non-2xx: a 400 (missing name/licenseSeatCount) is a real, expected
 * outcome ProvisionTenantForm.tsx must react to specifically, not collapsed
 * into a generic error.
 */
export async function createAdminTenant(input: {
  name: string;
  licenseSeatCount: number;
  domain?: string | null;
}): Promise<AdminTenantActionOutcome> {
  const response = await authenticatedCoreFetch('/v1/admin/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.6 (reworked 2026-08-12) / Story 5.12 — update tenant
 * administrative metadata. Same raw status/body pattern as
 * createAdminTenant(), for the same reason (a 404 — no fields provided, or
 * not found — is real and expected).
 */
export async function updateAdminTenant(
  tenantId: string,
  input: { status?: 'active' | 'suspended'; licenseSeatCount?: number; domain?: string | null; name?: string }
): Promise<AdminTenantActionOutcome> {
  const response = await authenticatedCoreFetch(`/v1/admin/tenants/${encodeURIComponent(tenantId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.6 (reworked 2026-08-12) / Story 5.13 — record a break-glass
 * request. `targetUserId` is always caller-supplied directly (the Tenant-
 * Admin-lookup-by-tenant-name gap named in
 * social-listening-core/.claude/skills/platform-admin-break-glass-rest/
 * SKILL.md is not built here). Returns the raw status/body — the real
 * request `id` on success is what BreakGlassPanel.tsx needs before it can
 * offer the separate execute action at all.
 */
export async function requestBreakGlassReset(input: {
  tenantId: string;
  targetUserId: string;
}): Promise<BreakGlassActionOutcome> {
  const response = await authenticatedCoreFetch(
    `/v1/admin/tenants/${encodeURIComponent(input.tenantId)}/break-glass/request`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: input.targetUserId }),
    }
  );
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.6 (reworked 2026-08-12) / Story 5.13 — execute an existing
 * break-glass request. Returns the raw status/body: a 409 (already
 * executed) and a 404 (unknown request) are both real, expected outcomes;
 * a 200's own `temporaryAccessPass` is real, single-disclosure material —
 * BreakGlassPanel.tsx renders it from this return value directly and must
 * never persist it anywhere.
 */
export async function executeBreakGlassRequest(input: {
  tenantId: string;
  requestId: string;
}): Promise<BreakGlassActionOutcome> {
  const response = await authenticatedCoreFetch(
    `/v1/admin/tenants/${encodeURIComponent(input.tenantId)}/break-glass/requests/${encodeURIComponent(input.requestId)}/execute`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.6 (added 2026-08-12) / Story 1.10 — reads the real, deliberately
 * unauthenticated GET /v1/health directly (never via authenticatedCoreFetch()
 * — no bearer token is required or sent for this one call, the same
 * boundary Story 1.3/1.10 already established). Never throws — a network
 * failure degrades to 'unavailable', the same signal a real 503 gives.
 */
export async function getCoreHealthStatus(): Promise<'ok' | 'unavailable'> {
  try {
    const response = await checkCoreHealth();
    return response.ok ? 'ok' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export interface Watchlist {
  id: string;
  name: string;
  matchType: string;
  terms: string[] | null;
  booleanQuery?: string;
  platformIds: string[];
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistActionOutcome {
  status: number;
  body: { code?: string; details?: string[]; current_version?: number; [key: string]: unknown };
}

/**
 * Story 6.4 (reworked 2026-08-12, ADR-0044) — lists the caller's own
 * watchlists (GET /v1/watchlists). Takes zero parameters, deliberately:
 * ownership is derived entirely from the bearer token server-side (§5c) —
 * there is nothing a caller could legitimately supply to see another user's
 * watchlists, and this function must never grow a parameter that would let
 * one try. Throws on a non-2xx — this screen has nothing sensible to render
 * without a real list.
 */
export async function listWatchlists(): Promise<Watchlist[]> {
  const response = await authenticatedCoreFetch('/v1/watchlists');
  if (!response.ok) {
    throw new Error(`Failed to list watchlists: ${response.status}`);
  }
  const payload = (await response.json()) as { watchlists?: Watchlist[] };
  return Array.isArray(payload.watchlists) ? payload.watchlists : [];
}

/**
 * Story 6.4 (reworked 2026-08-12, ADR-0044) — creates a watchlist (POST
 * /v1/watchlists). Returns the raw status/body rather than throwing on a
 * non-2xx: a 422 (the matchType <-> terms/booleanQuery invariant) is a
 * real, expected outcome the form must react to specifically (its own
 * `details` array), not collapsed into a generic error.
 */
export async function createWatchlist(input: {
  name: string;
  matchType: 'keyword' | 'hashtag' | 'account' | 'boolean';
  terms?: string[] | null;
  booleanQuery?: string | null;
  platformIds?: string[];
}): Promise<WatchlistActionOutcome> {
  const response = await authenticatedCoreFetch('/v1/watchlists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.4 (reworked 2026-08-12, ADR-0044) — RFC 7396 merge-patch update
 * (PATCH /v1/watchlists/:id) with version-based optimistic locking:
 * `expectedVersion` is always sent as `If-Match`, required by the backend
 * (missing -> 428). `patch` is sent verbatim — building only-the-changed-
 * fields is always the caller's job (WatchlistForm.tsx's buildEditPatch(),
 * WatchlistRow.tsx's own dedicated isActive-only toggle), never this
 * function's. Returns the raw status/body rather than throwing: 409
 * (version_conflict, with the real current_version), 422, and 404 are all
 * real, expected outcomes the caller must react to specifically.
 */
export async function updateWatchlist(
  id: string,
  patch: Record<string, unknown>,
  expectedVersion: number
): Promise<WatchlistActionOutcome> {
  const response = await authenticatedCoreFetch(`/v1/watchlists/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'If-Match': String(expectedVersion) },
    body: JSON.stringify(patch),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.4 (reworked 2026-08-12, ADR-0044) — deletes a watchlist (DELETE
 * /v1/watchlists/:id, hard delete, no undo). A 204 has no JSON body — parsed
 * as {} rather than attempting response.json() on an empty stream.
 */
export async function deleteWatchlist(id: string): Promise<WatchlistActionOutcome> {
  const response = await authenticatedCoreFetch(`/v1/watchlists/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface SocialPostSummary {
  id: string;
  createdAt: string;
  rawPayload: unknown;
  publishedAt: string | null;
  enrichment: unknown;
}

export interface SocialPostsPage {
  posts: SocialPostSummary[];
  nextCursor: string | null;
}

export interface SocialPostFull extends SocialPostSummary {
  authorId: string | null;
  acquisitionId: string;
}

/**
 * Story 6.11 / Story 3.4 (ADR-0011) — the first frontend caller of
 * `GET /v1/posts` anywhere in this repo (it has existed, real and
 * contract-verified, since Phase 1 with zero UI surface). `cursor` is
 * always the exact, untouched `nextCursor` a prior page returned — this
 * function never constructs or decodes one, per ADR-0011's own
 * opaque-cursor contract (`posts-api/SKILL.md`'s own "cursor is opaque by
 * contract" constraint). Throws on a non-2xx — this screen has nothing
 * sensible to render without a real page of results.
 *
 * `limit` (Story 8.1, ADR-0054 Decision §3) is optional and forwarded
 * as-is — the real, already-supported `GET /v1/posts?limit=` query param
 * (`postsRouter.ts`, capped server-side at `MAX_PAGE_LIMIT=100`), not a new
 * backend capability. Analytics' own paginate-everything-and-aggregate
 * loop uses this to fetch in bigger pages (fewer round trips); every other
 * existing caller keeps the server's own default page size by omitting it.
 */
export async function listPosts(cursor?: string, limit?: number): Promise<SocialPostsPage> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (typeof limit === 'number') params.set('limit', String(limit));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await authenticatedCoreFetch(`/v1/posts${suffix}`);
  if (!response.ok) {
    throw new Error(`Failed to list posts: ${response.status}`);
  }
  return (await response.json()) as SocialPostsPage;
}

/**
 * Story 6.11 / Story 5.1 (ADR-0012) — the REST-fetch-on-demand half of
 * keeping Service Bus events thin, called from the admin UI for the first
 * time. Returns `null` on a 404 (an unknown id, or one belonging to
 * another tenant — RLS makes the two indistinguishable) so the caller can
 * render a real "not found" state rather than crash; throws on any other
 * non-2xx, since that's a real backend failure, not an expected outcome.
 */
export async function getPost(id: string): Promise<SocialPostFull | null> {
  const response = await authenticatedCoreFetch(`/v1/posts/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to load post ${id}: ${response.status}`);
  }
  return (await response.json()) as SocialPostFull;
}

export interface PostEnrichOutcome {
  status: number;
  body: SocialPostFull | { error?: string };
}

/**
 * Story 6.16 / Story 2.8/2.9 — manually (re-)runs enrichment for one
 * already-ingested post (`POST /v1/posts/:id/enrich`). Returns the raw
 * status/body rather than throwing on a non-2xx, the same pattern every
 * other Client-Component-triggered action in this app uses — a `200` with
 * `enrichment: null` (no AI provider currently connected and active) is a
 * real, honest outcome the caller must react to specifically, not an
 * exception.
 */
export async function runPostEnrichment(id: string): Promise<PostEnrichOutcome> {
  const response = await authenticatedCoreFetch(`/v1/posts/${encodeURIComponent(id)}/enrich`, { method: 'POST' });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface TenantOwnedFeedActivation {
  connectorActivationId: string;
  txtRecordHost: string;
  txtRecordValue: string;
  expiresAt: string;
  feedUrl: string;
}

export interface TenantOwnedFeedConnectOutcome {
  status: number;
  body: Partial<TenantOwnedFeedActivation> & { error?: string };
}

export interface TenantOwnedFeedVerifyOutcome {
  status: number;
  body: { status?: 'verified' | 'pending'; connectorActivationId?: string; retryAfter?: number; error?: string };
}

/**
 * Story 6.12 / Story 2.11 (ADR-0050) — begins the tenant-owned-feed connect
 * flow (`POST /v1/connectors/tenant-owned-feed/connect`). `domain`/`feedUrl`
 * are sent as two plain fields, never JSON-encoded into a single opaque
 * `credential` string the way `connectPlatform()` handles multi-field
 * credentials — this connector has `authMode: 'none'`, no credential at
 * all. Returns the raw status/body rather than throwing on a non-2xx: a
 * `400` (missing domain/feedUrl) is a real, expected outcome the form must
 * react to specifically, not collapsed into a generic error.
 */
export async function connectTenantOwnedFeed(domain: string, feedUrl: string): Promise<TenantOwnedFeedConnectOutcome> {
  const response = await authenticatedCoreFetch('/v1/connectors/tenant-owned-feed/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, feedUrl }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.12 / Story 2.11 (ADR-0050) — re-clickable DNS TXT-record check
 * (`POST /v1/connectors/tenant-owned-feed/verify-domain`). Returns the raw
 * status/body: a `{status: 'pending'}` 200 is a real, expected, non-error
 * outcome (DNS propagation can take up to 72 hours) the UI must keep
 * offering "Verify now" for, never collapsed into a failure.
 */
export async function verifyTenantOwnedFeedDomain(connectorActivationId: string): Promise<TenantOwnedFeedVerifyOutcome> {
  const response = await authenticatedCoreFetch('/v1/connectors/tenant-owned-feed/verify-domain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectorActivationId }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface TenantDeletionRequestOutcome {
  status: number;
  body: { tenantId?: string; deletionRequestedAt?: string; graceEndsAt?: string; error?: string };
}

/**
 * Story 6.13 / Story 3.8 (ADR-0043) — the soft-delete step
 * (`POST /v1/tenants/self-service-deletion/request`). Returns the raw
 * status/body rather than throwing on a non-2xx — a `409` (a request is
 * already active for this tenant) is a real, expected outcome the panel
 * must react to specifically, not a generic error.
 */
export async function requestTenantSelfServiceDeletion(): Promise<TenantDeletionRequestOutcome> {
  const response = await authenticatedCoreFetch('/v1/tenants/self-service-deletion/request', { method: 'POST' });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface TenantDeletionExportOutcome {
  status: number;
  contentType: string;
  body: string;
}

/**
 * Story 6.13 / Story 3.8 (ADR-0043 §4) — re-triggerable export
 * (`POST /v1/tenants/self-service-deletion/export`), caller's choice of
 * JSON or CSV. Returns the raw response text and content-type rather than
 * parsing it — the body may be a large JSON export or a CSV file, neither
 * of which this function should assume the shape of; the proxy route and
 * panel component decide how to present it.
 */
export async function requestTenantSelfServiceExport(format: 'json' | 'csv'): Promise<TenantDeletionExportOutcome> {
  const response = await authenticatedCoreFetch('/v1/tenants/self-service-deletion/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(format === 'csv' ? { format: 'csv' } : {}),
  });
  const text = await response.text();
  return { status: response.status, contentType: response.headers.get('content-type') ?? 'application/json', body: text };
}

export interface TenantDeletionCancelOutcome {
  status: number;
  body: { tenantId?: string; cancelled?: boolean; error?: string };
}

/**
 * Story 6.13 / Story 3.8 (ADR-0043 §5) — cancel
 * (`DELETE /v1/tenants/self-service-deletion`), available any time from
 * request until confirmation. A `409` (no active request, or already
 * confirmed) is a real, expected outcome, not a generic error.
 */
export async function cancelTenantSelfServiceDeletion(): Promise<TenantDeletionCancelOutcome> {
  const response = await authenticatedCoreFetch('/v1/tenants/self-service-deletion', { method: 'DELETE' });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface TenantDeletionConfirmOutcome {
  status: number;
  body: { tenantId?: string; status?: string; error?: string; graceEndsAt?: string };
}

/**
 * Story 6.13 / Story 3.8 (ADR-0043 §6) — the one irreversible action in
 * this entire admin UI (`POST /v1/tenants/self-service-deletion/confirm`).
 * A `409 grace_period_not_elapsed` (with the real remaining `graceEndsAt`)
 * is a real, expected outcome the panel must handle even after its own
 * client-side timing check — that check is best-effort, not authoritative.
 */
export async function confirmTenantSelfServiceDeletion(): Promise<TenantDeletionConfirmOutcome> {
  const response = await authenticatedCoreFetch('/v1/tenants/self-service-deletion/confirm', { method: 'POST' });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.6 / Story 5.14 — query Platform Admin audit-log entries.
 */
export async function queryAdminAuditLog(input?: {
  tenantId?: string;
  actorIdentity?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}): Promise<AdminAuditLogPage> {
  const params = new URLSearchParams();
  if (input?.tenantId) params.set('tenantId', input.tenantId);
  if (input?.actorIdentity) params.set('actorIdentity', input.actorIdentity);
  if (input?.from) params.set('from', input.from);
  if (input?.to) params.set('to', input.to);
  if (input?.cursor) params.set('cursor', input.cursor);
  if (typeof input?.limit === 'number') params.set('limit', String(input.limit));

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await authenticatedCoreFetch(`/v1/admin/audit-log${suffix}`);
  if (!response.ok) {
    throw new Error(`Failed to query audit log: ${response.status}`);
  }
  return (await response.json()) as AdminAuditLogPage;
}
