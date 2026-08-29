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

/**
 * Story 6.40 / ADR-0074 — proxies the full workspace JSON archive from
 * `GET /v1/tenants/me/export/workspace` (Story 3.16). Returns the raw
 * Response so the same-origin proxy route can stream the body through with
 * the original Content-Type and status intact. `tenant_admin` only on the
 * backend side (BRU-001); a `tenant_user` receives 403, which the proxy
 * route passes through as-is.
 */
export async function exportWorkspace(): Promise<Response> {
  return authenticatedCoreFetch('/v1/tenants/me/export/workspace');
}

/**
 * Story 6.40 / ADR-0074 — proxies the matched-posts CSV export from
 * `GET /v1/posts?format=csv` (Story 3.16). Returns the raw Response so the
 * same-origin proxy route can stream the CSV body through with the original
 * Content-Type and status intact. Available to both `tenant_admin` and
 * `tenant_user` (BRU-002); `platform_admin` receives 403.
 */
export async function exportPostsCsv(): Promise<Response> {
  return authenticatedCoreFetch('/v1/posts?format=csv');
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

/** Enhancement, 2026-08-17 — the caller's own tenant's real seat counts, now returned alongside the user list (GET /v1/tenants/users). */
export interface TenantSeatInfo {
  licenseSeatCount: number;
  activeSeatCount: number;
}

export interface TenantUsersResult {
  users: TenantUser[];
  seats: TenantSeatInfo;
}

/**
 * Story 6.8 / Story 1.9 — lists every user for the caller's own tenant
 * (GET /v1/tenants/users, RLS-scoped, no role gate on read).
 *
 * Enhancement, 2026-08-17 (dated correction — widened return shape, see
 * this repo's own story-6.8 contract for the matching dated note): now
 * returns `{ users, seats }` rather than a bare array, since the same
 * response now also carries the caller tenant's own real
 * licenseSeatCount/activeSeatCount (social-listening-core@556bb65).
 */
export async function listTenantUsers(): Promise<TenantUsersResult> {
  const response = await authenticatedCoreFetch('/v1/tenants/users');
  if (!response.ok) {
    throw new Error(`Failed to list tenant users: ${response.status}`);
  }
  const payload = (await response.json()) as { users?: TenantUser[]; seats?: TenantSeatInfo };
  return {
    users: Array.isArray(payload.users) ? payload.users : [],
    seats: payload.seats ?? { licenseSeatCount: 0, activeSeatCount: 0 },
  };
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
  /** Story 2.15 (ADR-0059 Decision §4) added 'reconnect_required'; Story 6.29 (ADR-0070 §2) added 'stalled'. */
  status: 'healthy' | 'degraded' | 'failing' | 'disconnected' | 'reconnect_required' | 'stalled';
  lastSuccessfulFetchAt: string | null;
  lastAttemptAt: string | null;
  consecutiveFailures: number;
  credentialStatus: 'valid' | 'expiring_soon' | 'expired' | 'revoked' | null;
  /** Story 1.12 (ADR-0051 Open Question 5) — real activation state, tenant-wide scope, read fresh, never derived from credentialStatus/authMode. */
  isActive: boolean;
  /** Number of posts ingested in the most recent successful run. */
  lastSuccessfulPostsIngested?: number | null;
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

export interface ConnectorRetryOutcome {
  status: number;
  body: {
    message?: string;
    health?: ConnectorStatus;
    error?: string;
    [key: string]: unknown;
  };
}

/**
 * Story 6.29 / Story 1.16 (ADR-0070 §4) — on-demand force retry / re-sync
 * (`POST /v1/connectors/:platformId/retry` or `/v1/connectors/:platformId/users/:userId/retry`).
 * Reconciles any stale runs, resets circuit-breaker failure streaks, triggers an immediate poll,
 * and returns fresh derived ConnectorHealth. A 409 (run already in progress) is a real expected outcome.
 */
export async function retryConnector(
  platformId: string,
  userId?: string
): Promise<ConnectorRetryOutcome> {
  const path = userId
    ? `/v1/connectors/${encodeURIComponent(platformId)}/users/${encodeURIComponent(userId)}/retry`
    : `/v1/connectors/${encodeURIComponent(platformId)}/retry`;
  const response = await authenticatedCoreFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface FacebookOAuthExchangeOutcome {
  status: number;
  body: {
    sessionToken?: string;
    pages?: { id: string; name: string; category?: string }[];
    error?: string;
    [key: string]: unknown;
  };
}

/**
 * Story 6.23 (ADR-0059 Decision §3/§4) — forwards the code Facebook's own
 * redirect handed to our callback route to social-listening-core's real
 * OAuth-exchange endpoint (Story 2.15), which does the actual Meta token
 * exchange and /me/accounts call server-side. This function never talks to
 * Meta directly — Meta itself is core's own boundary, not this repo's.
 */
export async function exchangeFacebookOAuthCode(
  code: string,
  redirectUri: string
): Promise<FacebookOAuthExchangeOutcome> {
  const response = await authenticatedCoreFetch('/v1/connectors/facebook/oauth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface FacebookSelectPageOutcome {
  status: number;
  body: {
    connected?: { pageId: string; pageName: string }[];
    errors?: { pageId: string; reason: string }[];
    error?: string;
    [key: string]: unknown;
  };
}

/**
 * Story 6.27 (ADR-0060 Decision §5) — completes the Page-picker step
 * (`POST /v1/connectors/facebook/oauth/select-page`, Story 2.15/6.27).
 * Always Tier 3/personal scope on the backend — there is no `ownerType`
 * parameter here to choose, unlike `connectPlatform()`. `pageIds` is a
 * plural array (breaking change from Story 6.23's own singular `pageId`
 * shape) — each Page is processed independently server-side, so the
 * response is a structured `{connected, errors}` partial-failure shape,
 * never a single opaque pass/fail.
 */
export async function selectFacebookPages(
  sessionToken: string,
  pageIds: string[]
): Promise<FacebookSelectPageOutcome> {
  const response = await authenticatedCoreFetch('/v1/connectors/facebook/oauth/select-page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken, pageIds }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface FacebookConnectedPageRow {
  id: string;
  pageId: string;
  pageName: string;
  status: 'connected' | 'removed' | 'orphaned';
  connectorHealth: {
    status: 'healthy' | 'degraded' | 'failing' | 'disconnected' | 'reconnect_required';
    lastSuccessfulFetchAt: string | null;
    lastAttemptAt: string | null;
    consecutiveFailures: number;
    credentialStatus: string | null;
  };
}

export interface FacebookPagesOutcome {
  status: number;
  body: {
    parentConnectionActive?: boolean;
    pages?: FacebookConnectedPageRow[];
    error?: string;
    [key: string]: unknown;
  };
}

/**
 * Story 6.27 (ADR-0060 Decision §5) — the caller's own connected Facebook
 * Pages (`GET /v1/connectors/facebook/pages`), replacing Story 6.23's own
 * single-cookie-cached Page name with the real, per-Page list this screen
 * now renders.
 */
export async function listFacebookPages(): Promise<FacebookPagesOutcome> {
  const response = await authenticatedCoreFetch('/v1/connectors/facebook/pages', { method: 'GET' });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface FacebookDisconnectPageOutcome {
  status: number;
  body: { id?: string; pageId?: string; status?: string; error?: string; [key: string]: unknown };
}

/** Story 6.27 (ADR-0060 Decision §5) — soft-removes one of the caller's own connected Pages (`DELETE /v1/connectors/facebook/pages/:id`). */
export async function disconnectFacebookPage(id: string): Promise<FacebookDisconnectPageOutcome> {
  const response = await authenticatedCoreFetch(`/v1/connectors/facebook/pages/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface InstagramOAuthExchangeOutcome {
  status: number;
  body: {
    sessionToken?: string;
    accounts?: {
      igUserId: string;
      username: string;
      name?: string;
      profilePictureUrl?: string;
      followersCount?: number;
      pageId: string;
      pageName: string;
    }[];
    error?: string;
    [key: string]: unknown;
  };
}

/**
 * Story 6.34 (ADR-0068 Decision §2) — exchanges Meta OAuth code for Instagram accounts discovery.
 */
export async function exchangeInstagramOAuthCode(
  code: string,
  redirectUri: string
): Promise<InstagramOAuthExchangeOutcome> {
  const response = await authenticatedCoreFetch('/v1/connectors/instagram/oauth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface InstagramSelectAccountOutcome {
  status: number;
  body: {
    connected?: { igUserId: string; username: string; pageName: string }[];
    errors?: { igUserId: string; reason: string }[];
    error?: string;
    [key: string]: unknown;
  };
}

/**
 * Story 6.34 (ADR-0068 Decision §2) — registers selected Instagram accounts in core.
 */
export async function selectInstagramAccounts(
  sessionToken: string,
  igUserIds: string[]
): Promise<InstagramSelectAccountOutcome> {
  const response = await authenticatedCoreFetch('/v1/connectors/instagram/oauth/select-accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken, igUserIds }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface InstagramConnectedAccountRow {
  id: string;
  igUserId: string;
  username: string;
  pageId: string;
  pageName: string;
  status: 'connected' | 'removed' | 'orphaned' | 'reconnect_required';
  connectorHealth: {
    status: 'healthy' | 'degraded' | 'failing' | 'disconnected' | 'reconnect_required' | 'stalled';
    lastSuccessfulFetchAt: string | null;
    lastAttemptAt: string | null;
    consecutiveFailures: number;
    credentialStatus: string | null;
  };
}

export interface InstagramAccountsOutcome {
  status: number;
  body: {
    parentConnectionActive?: boolean;
    accounts?: InstagramConnectedAccountRow[];
    error?: string;
    [key: string]: unknown;
  };
}

/**
 * Story 6.34 (ADR-0068 Decision §2) — lists caller's connected Instagram accounts.
 */
export async function listInstagramAccounts(): Promise<InstagramAccountsOutcome> {
  const response = await authenticatedCoreFetch('/v1/connectors/instagram/accounts', { method: 'GET' });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface InstagramDisconnectAccountOutcome {
  status: number;
  body: { id?: string; igUserId?: string; status?: string; error?: string; [key: string]: unknown };
}

/**
 * Story 6.34 (ADR-0068 Decision §2) — soft-removes a connected Instagram account.
 */
export async function disconnectInstagramAccount(id: string): Promise<InstagramDisconnectAccountOutcome> {
  const response = await authenticatedCoreFetch(`/v1/connectors/instagram/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface LinkedInOAuthExchangeOutcome {
  status: number;
  body: {
    success?: boolean;
    memberId?: string;
    memberName?: string;
    error?: string;
    [key: string]: unknown;
  };
}

/**
 * Story 6.35 (ADR-0069) — exchanges LinkedIn authorization code and state with core.
 */
export async function exchangeLinkedInOAuthCode(
  code: string,
  state: string,
  redirectUri: string
): Promise<LinkedInOAuthExchangeOutcome> {
  const response = await authenticatedCoreFetch('/v1/connectors/linkedin/oauth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state, redirectUri }),
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

import { WatchlistAST, ConnectorQueryCapabilities } from './watchlist-ast';
export type { WatchlistAST, ConnectorQueryCapabilities };

export interface Watchlist {
  id: string;
  name: string;
  matchType: string;
  terms: string[] | null;
  booleanQuery?: string;
  ast?: WatchlistAST;
  platformIds: string[];
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistActionOutcome {
  status: number;
  body: { code?: string; details?: string[]; offendingClause?: unknown; reason?: string; current_version?: number; [key: string]: unknown };
}

/**
 * Story 12.3 / 12.4 (ADR-0102) — fetch per-connector query capabilities.
 */
export async function getConnectorQueryCapabilities(platformId: string): Promise<ConnectorQueryCapabilities | null> {
  const response = await authenticatedCoreFetch(`/v1/connectors/${encodeURIComponent(platformId)}/query-capabilities`);
  if (!response.ok) return null;
  return (await response.json()) as ConnectorQueryCapabilities;
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
  ast?: WatchlistAST | null;
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
  /** Story 6.19 (Story 3.10/ADR-0053) — real, canonical Markdown body. null when never populated (pre-Story-3.10 posts), never omitted. */
  bodyMarkdown: string | null;
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
 *
 * `watchlistId` (Story 8.9, ADR-0063) is optional and forwarded as-is —
 * the real `GET /v1/posts?watchlistId=` server-side filter (Story 3.11).
 */
export async function listPosts(cursor?: string, limit?: number, watchlistId?: string): Promise<SocialPostsPage> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (typeof limit === 'number') params.set('limit', String(limit));
  if (watchlistId) params.set('watchlistId', watchlistId);
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
 * Story 6.16 / Story 3.13 / ADR-0071 — manually (re-)runs enrichment for one
 * already-ingested post (`POST /v1/posts/:id/enrich`). Accepts optional { force?: boolean }
 * to overwrite human-in-the-loop overrides.
 */
export async function runPostEnrichment(id: string, options?: { force?: boolean }): Promise<PostEnrichOutcome> {
  const response = await authenticatedCoreFetch(`/v1/posts/${encodeURIComponent(id)}/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force: options?.force ?? false }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface SpikeExplainOutcome {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Story 8.8 (ADR-0062 Decision §6) — AI Spike Storyteller. Calls the
 * backend's POST /v1/posts/explain-spike with a spikeDate and optional
 * customPrompt, returning the AI-generated narrative. Mirrors
 * runPostEnrichment()'s { status, body } outcome shape.
 */
export async function explainSpike(
  spikeDate: string,
  options?: { customPrompt?: string }
): Promise<SpikeExplainOutcome> {
  const response = await authenticatedCoreFetch('/v1/posts/explain-spike', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spikeDate, customPrompt: options?.customPrompt }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface SentimentAspect {
  aspect: string;
  label: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;
  evidence: string;
}

export interface SentimentOverridden {
  by: string;
  at: string;
  reason?: string;
  previousValue?: {
    overall: string;
    confidence: number;
  };
}

export interface PostSentimentEnrichment {
  overall: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;
  language: string;
  aspects?: SentimentAspect[];
  overridden?: SentimentOverridden;
}

export interface PostEnrichmentUpdateInput {
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed' | (Partial<PostSentimentEnrichment> & { reason?: string });
  sentimentScore?: number;
  keyPhrases?: string[];
  detectedLanguage?: string | null;
  geoCountry?: string | null;
  geoCountryName?: string | null;
  summary?: string | null;
  reason?: string;
}

export interface PostEnrichmentUpdateOutcome {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Story 6.31 (ADR-0071) — updates post enrichment overrides via PATCH /v1/posts/:id/enrichment.
 */
export async function updatePostEnrichment(
  id: string,
  updates: PostEnrichmentUpdateInput
): Promise<PostEnrichmentUpdateOutcome> {
  const response = await authenticatedCoreFetch(`/v1/posts/${encodeURIComponent(id)}/enrichment`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.38 (ADR-0073) — the audit row shape for an outbound reply or
 * other outbound engagement. Returned by both POST and GET /v1/posts/:id/replies.
 */
export interface OutboundActivity {
  id: string;
  postId: string;
  providerId: string;
  userId: string;
  credentialId: string;
  activityType: 'reply';
  body: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  externalId: string | null;
  externalUrl: string | null;
  errorCode: string | null;
  createdAt: string;
  sentAt: string | null;
  failedAt: string | null;
}

export interface ReplySubmitOutcome {
  status: number;
  body: OutboundActivity | { error?: string; code?: string };
}

export interface RepliesList {
  replies: OutboundActivity[];
  nextCursor: string | null;
}

/**
 * Story 6.38 (ADR-0073) — submits a reply to an ingested post
 * (POST /v1/posts/:id/replies). Returns the created/failed outbound_activities
 * row with its HTTP status; a 422/429/5xx is still a real, expected outcome
 * the UI must distinguish from a network failure.
 */
export async function submitReply(postId: string, body: string): Promise<ReplySubmitOutcome> {
  const response = await authenticatedCoreFetch(`/v1/posts/${encodeURIComponent(postId)}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  const bodyJson = await response.json().catch(() => ({}));
  return { status: response.status, body: bodyJson };
}

/**
 * Story 6.38 (ADR-0073) — lists the tenant-scoped reply audit rows for a
 * post (GET /v1/posts/:id/replies).
 */
export async function listReplies(postId: string): Promise<RepliesList> {
  const response = await authenticatedCoreFetch(`/v1/posts/${encodeURIComponent(postId)}/replies`);
  if (!response.ok) {
    throw new Error(`Failed to load replies: ${response.status}`);
  }
  return (await response.json()) as RepliesList;
}

export interface TenantOwnedFeedActivation {
  connectorActivationId: string;
  txtRecordHost: string;
  txtRecordValue: string;
  expiresAt: string;
  feedUrl: string;
  /** Story 6.20 (ADR-0057 Decision §1a) — 'verified' when this call auto-verified a second feed on an already-verified domain, skipping the DNS TXT step entirely; 'pending' for the ordinary new-domain path. */
  status?: 'pending' | 'verified';
}

export interface TenantOwnedFeedConnectOutcome {
  status: number;
  body: Partial<TenantOwnedFeedActivation> & { error?: string };
}

/** Story 6.20 (ADR-0057) — one row from GET /v1/connectors/tenant-owned-feed/activations. */
export interface TenantOwnedFeedActivationDetail {
  id: string;
  domain: string;
  feedUrl: string;
  status: 'pending' | 'verified' | 'expired' | 'removed';
  txtRecordHost: string;
  txtRecordValue: string;
  tokenExpiresAt: string;
  verifiedAt: string | null;
  createdAt: string;
  /** Story 6.28 (ADR-0050's 2026-08-20 Amendment Log entry) — optional, tenant-owner-set display label; null when unset (the setup UI falls back to `domain`). */
  name: string | null;
}

export interface TenantOwnedFeedActionOutcome {
  status: number;
  body: Partial<TenantOwnedFeedActivationDetail> & { error?: string };
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
export async function connectTenantOwnedFeed(domain: string, feedUrl: string, name?: string): Promise<TenantOwnedFeedConnectOutcome> {
  const response = await authenticatedCoreFetch('/v1/connectors/tenant-owned-feed/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(name ? { domain, feedUrl, name } : { domain, feedUrl }),
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

/**
 * Story 6.20 (ADR-0057) — lists every tenant-owned-feed activation for the
 * caller's tenant (`GET /v1/connectors/tenant-owned-feed/activations`,
 * `tenant_admin` only), any status. Called server-side from page.tsx, the
 * same pattern `listTenantUsers()` already established — no proxy route
 * needed for a read a Server Component can make directly.
 */
export async function listTenantOwnedFeedActivations(): Promise<TenantOwnedFeedActivationDetail[]> {
  const response = await authenticatedCoreFetch('/v1/connectors/tenant-owned-feed/activations');
  if (!response.ok) {
    throw new Error(`Failed to list tenant-owned feed activations: ${response.status}`);
  }
  const payload = (await response.json()) as { activations?: TenantOwnedFeedActivationDetail[] };
  return Array.isArray(payload.activations) ? payload.activations : [];
}

/**
 * Story 6.20 (ADR-0057) / Story 6.28 (ADR-0050's 2026-08-20 Amendment Log
 * entry widened this to also accept `name`) — updates `feedUrl` and/or
 * `name` on an activation (`PATCH /v1/connectors/tenant-owned-feed/:id`,
 * `tenant_admin` only). `updates` must carry at least one of the two —
 * the same requirement the backend route now enforces. `name: null`
 * explicitly clears a previously-set name. Returns the raw status/body: a
 * `400` (a request that tried to also send `domain`, or supplied neither
 * field) and a `404` (unknown id) are both real, expected outcomes the UI
 * must react to specifically, not collapsed into a generic error.
 */
export async function updateTenantOwnedFeedActivation(
  id: string,
  updates: { feedUrl?: string; name?: string | null }
): Promise<TenantOwnedFeedActionOutcome> {
  const response = await authenticatedCoreFetch(`/v1/connectors/tenant-owned-feed/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.20 (ADR-0057) — soft-removes an activation
 * (`DELETE /v1/connectors/tenant-owned-feed/:id`, `tenant_admin` only).
 * The backend transitions `status` to `'removed'`, never a hard delete;
 * this function's own outcome shape mirrors that — a real, non-error
 * response, not a thrown exception.
 */
export async function removeTenantOwnedFeedActivation(id: string): Promise<TenantOwnedFeedActionOutcome> {
  const response = await authenticatedCoreFetch(`/v1/connectors/tenant-owned-feed/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

/**
 * Story 6.39 (ADR-0075) — the per-Page outcome row returned by
 * POST /v1/outbound/posts.  Reuses the existing OutboundActivity shape
 * augmented with the target asset (Page) id/name for UI display.
 */
export interface PublishPostRow extends OutboundActivity {
  targetAssetId: string;
  targetAssetName: string;
}

export interface PublishPostOutcome {
  status: number;
  rows: PublishPostRow[];
}

/**
 * Story 6.39 (ADR-0075) — creates real outbound posts on selected Facebook
 * Pages (POST /v1/outbound/posts).  `targets` is the list of connected
 * Facebook Page rows the user ticked in PublishTargetsDialog.  `text` is
 * the composer's main text; `platformOverrides` carries per-platform text
 * overrides (only Facebook is published in this story).  `linkPreview` is
 * the optional OpenGraph card preview to attach.  Returns the raw HTTP
 * status (201 all-sent, 207 partial) and the per-Page result rows so the
 * caller can show per-Page external_url or error_code.
 */
export async function publishPost(input: {
  text: string;
  targets: { pageId: string; pageName: string }[];
  platformOverrides?: Record<string, { text?: string }>;
  linkPreview?: { url: string; title?: string; description?: string; image?: string; siteName?: string; hostname?: string } | null;
}): Promise<PublishPostOutcome> {
  const response = await authenticatedCoreFetch('/v1/outbound/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: input.text,
      targets: input.targets.map((t) => ({ platform: 'facebook', targetAssetId: t.pageId, targetAssetName: t.pageName })),
      platformOverrides: input.platformOverrides,
      linkPreview: input.linkPreview,
    }),
  });
  const body = await response.json().catch(() => ({ rows: [] }));
  return { status: response.status, rows: Array.isArray(body.rows) ? body.rows : [] };
}

/**
 * Story 6.41 (ADR-0076) — the result shape returned by
 * POST /v1/composer/research in social-listening-core.
 */
export interface ComposerResearchSource {
  title: string;
  url: string;
  snippet: string;
  provider: string;
}

export interface ComposerResearchResult {
  keyPhrases: string[];
  relatedTopics: string[];
  searchQueries: string[];
  sources: ComposerResearchSource[];
  contextSummary: string;
  comparison: string;
}

export interface ComposerResearchOutcome {
  status: number;
  body: ComposerResearchResult | { error?: string; code?: string };
}

/**
 * Story 6.41 (ADR-0076) — calls POST /v1/composer/research on
 * social-listening-core, which orchestrates key-phrase extraction, one-off
 * web searches (Brave/Bing), and LLM synthesis using the tenant's own
 * credentials. Returns the raw HTTP status and response body.
 */
export async function composerResearch(input: {
  text: string;
  targetPlatforms?: string[];
  maxSearchResultsPerQuery?: number;
}): Promise<ComposerResearchOutcome> {
  const response = await authenticatedCoreFetch('/v1/composer/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: input.text,
      targetPlatforms: input.targetPlatforms,
      maxSearchResultsPerQuery: input.maxSearchResultsPerQuery,
    }),
  });
  const body = await response.json().catch(() => ({ error: 'Unknown error' }));
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

export interface ChecklistStep {
  completed: boolean;
  completedAt: string | null;
  deepLink: string;
}

export interface AdvancedChecklistStep extends ChecklistStep {
  hidden: boolean;
}

/** REST response shape for GET/PATCH /v1/tenants/:id/onboarding-checklist (ADR-0080 / Story 9.5 / Story 9.6). */
export interface OnboardingChecklistResponse {
  isComplete: boolean;
  progressPercentage: number;
  dismissed: boolean;
  dismissedAt: string | null;
  steps: {
    connect_source: ChecklistStep;
    build_watchlist: ChecklistStep;
    invite_user: ChecklistStep;
    verify_posts: ChecklistStep;
  };
  advancedSteps: {
    enable_enrichment: AdvancedChecklistStep;
    configure_alerts: AdvancedChecklistStep;
  };
}

export interface PatchOnboardingChecklistRequest {
  dismissed?: boolean;
  reset?: boolean;
  hiddenAdvancedSteps?: string[];
}

export interface OnboardingChecklistOutcome {
  status: number;
  body: OnboardingChecklistResponse | { error?: string };
}

/**
 * Story 9.6 (ADR-0080) — reads the tenant's onboarding checklist state
 * (GET /v1/tenants/:id/onboarding-checklist). Accessible to both tenant_admin
 * and tenant_user.
 */
export async function getOnboardingChecklist(tenantId: string): Promise<OnboardingChecklistResponse> {
  const response = await authenticatedCoreFetch(`/v1/tenants/${encodeURIComponent(tenantId)}/onboarding-checklist`);
  if (!response.ok) {
    throw new Error(`Failed to load onboarding checklist: ${response.status}`);
  }
  return (await response.json()) as OnboardingChecklistResponse;
}

/**
 * Story 9.6 (ADR-0080) — mutates dismissal state or advanced-step visibility
 * (PATCH /v1/tenants/:id/onboarding-checklist). Restricted to tenant_admin.
 */
export async function patchOnboardingChecklist(
  tenantId: string,
  patch: PatchOnboardingChecklistRequest
): Promise<OnboardingChecklistOutcome> {
  const response = await authenticatedCoreFetch(`/v1/tenants/${encodeURIComponent(tenantId)}/onboarding-checklist`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export interface CrisisTemplateParameter {
  name: string;
  label: string;
  type: string;
  description: string;
  required: boolean;
  default?: string;
}

export interface CrisisTemplatePlaybookStep {
  step: number;
  action: string;
  owner: string;
  sla_minutes: number;
}

export interface CrisisTemplatePlaybook {
  name: string;
  severity: string;
  escalation_contact: string;
  steps: CrisisTemplatePlaybookStep[];
}

export interface CrisisTemplate {
  template_key: string;
  name: string;
  description: string;
  default_query: string;
  default_thresholds: Record<string, unknown>;
  parameters: CrisisTemplateParameter[];
  playbook: CrisisTemplatePlaybook;
}

export interface ActivateCrisisTemplateInput {
  variables: Record<string, string>;
  customThresholds?: Record<string, unknown>;
  notificationChannelIds: string[];
}

export interface ActivateCrisisTemplateResult {
  tenantCrisisTemplateId: string;
  watchlistId: string;
  status: 'active';
  playbook: CrisisTemplatePlaybook;
  thresholds: Record<string, unknown>;
  notificationChannelIds: string[];
}

/**
 * Story 9.4 (ADR-0079, BRD-0079, FDD-0079) — lists active crisis templates.
 */
export async function listCrisisTemplates(): Promise<CrisisTemplate[]> {
  const response = await authenticatedCoreFetch('/v1/crisis-templates');
  if (!response.ok) {
    throw new Error(`Failed to list crisis templates: ${response.status}`);
  }
  const payload = (await response.json()) as { templates?: CrisisTemplate[] };
  return Array.isArray(payload.templates) ? payload.templates : [];
}

/**
 * Story 9.4 (ADR-0079, BRD-0079, FDD-0079) — gets a single crisis template.
 */
export async function getCrisisTemplate(templateKey: string): Promise<CrisisTemplate> {
  const response = await authenticatedCoreFetch(`/v1/crisis-templates/${encodeURIComponent(templateKey)}`);
  if (!response.ok) {
    throw new Error(`Failed to get crisis template ${templateKey}: ${response.status}`);
  }
  const payload = (await response.json()) as { template?: CrisisTemplate };
  return payload.template as CrisisTemplate;
}

/**
 * Story 9.4 (ADR-0079, BRD-0079, FDD-0079) — activates a crisis template.
 */
export async function activateCrisisTemplate(
  templateKey: string,
  input: ActivateCrisisTemplateInput
): Promise<{ status: number; body: any }> {
  const response = await authenticatedCoreFetch(`/v1/crisis-templates/${encodeURIComponent(templateKey)}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}


export interface RAGSearchResultItem {
  postId: string;
  chunkIndex: number;
  score: number;
  platformId: string;
  publishedAt: string;
  snippet: string;
  internalUrl: string;
}

export interface RAGSearchResponse {
  results: RAGSearchResultItem[];
  totalReturned: number;
}

export interface RAGAskCitation {
  citationIndex: number;
  postId: string;
  chunkIndex: number;
  snippet: string;
  platformId: string;
  publishedAt: string;
  internalUrl: string;
}

export interface RAGAskResponse {
  answer: string;
  citations: RAGAskCitation[];
  confidence: 'high' | 'medium' | 'low' | 'unsupported';
  isGrounded: boolean;
}

export interface RAGStatusResponse {
  status: 'healthy' | 'degraded';
  totalIndexedChunks: number;
  syncStatus: {
    synced: number;
    pending: number;
    failed: number;
  };
  lagMinutes: number;
}

/**
 * Story 9.11 (ADR-0084, ADR-0085) — searches vector index semantically.
 */
export async function searchRAG(input: {
  query: string;
  searchMode?: 'semantic' | 'hybrid';
  filter?: Record<string, any>;
  pagination?: { topK?: number };
}): Promise<RAGSearchResponse> {
  const response = await authenticatedCoreFetch('/v1/rag/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`RAG search failed: ${response.status}`);
  }
  return (await response.json()) as RAGSearchResponse;
}

/**
 * Story 9.11 (ADR-0084, ADR-0085) — answers questions with grounding and citations.
 */
export async function askRAG(input: {
  question: string;
  filter?: Record<string, any>;
  maxChunks?: number;
  stream?: boolean;
}): Promise<RAGAskResponse> {
  const response = await authenticatedCoreFetch('/v1/rag/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`RAG ask failed: ${response.status}`);
  }
  return (await response.json()) as RAGAskResponse;
}

/**
 * Story 9.11 (ADR-0084, ADR-0085) — gets RAG vector index status.
 */
export async function getRAGStatus(): Promise<RAGStatusResponse> {
  const response = await authenticatedCoreFetch('/v1/rag/status');
  if (!response.ok) {
    throw new Error(`RAG status failed: ${response.status}`);
  }
  return (await response.json()) as RAGStatusResponse;
}

// ---------------------------------------------------------------------------
// Story 10.1 / 10.2 (ADR-0086) — Prospecting Lists & Social Selling
// ---------------------------------------------------------------------------

export interface ProspectingList {
  id: string;
  tenant_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProspectingListEntry {
  id: string;
  prospecting_list_id: string;
  tenant_id: string;
  author_id: string;
  platform_id: string;
  topic: string | null;
  engagement_score: string | null;
  authenticity_score: string | null;
  influence_score: string | null;
  reach_score: string | null;
  relationship_stage: 'new' | 'contacted' | 'engaged' | 'converted' | 'passed';
  notes: string | null;
  tags: string[];
  custom_attributes: Record<string, unknown>;
  added_by_user_id: string;
  added_at: string;
  updated_at: string;
}

export interface ProspectingListsResponse {
  lists: ProspectingList[];
}

export interface ProspectingEntriesResponse {
  entries: ProspectingListEntry[];
  nextCursor: string | null;
}

/**
 * Story 10.1 (ADR-0086) — creates a prospecting list.
 */
export async function createProspectingList(input: {
  name: string;
  description?: string | null;
  shared?: boolean;
}): Promise<ProspectingList> {
  const response = await authenticatedCoreFetch('/v1/prospecting-lists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to create prospecting list: ${response.status}`);
  }
  return (await response.json()) as ProspectingList;
}

/**
 * Story 10.1 (ADR-0086) — lists all prospecting lists visible to the caller.
 */
export async function listProspectingLists(): Promise<ProspectingListsResponse> {
  const response = await authenticatedCoreFetch('/v1/prospecting-lists');
  if (!response.ok) {
    throw new Error(`Failed to list prospecting lists: ${response.status}`);
  }
  return (await response.json()) as ProspectingListsResponse;
}

/**
 * Story 10.1 (ADR-0086) — gets a single prospecting list.
 */
export async function getProspectingList(listId: string): Promise<ProspectingList> {
  const response = await authenticatedCoreFetch(`/v1/prospecting-lists/${listId}`);
  if (!response.ok) {
    throw new Error(`Failed to get prospecting list: ${response.status}`);
  }
  return (await response.json()) as ProspectingList;
}

/**
 * Story 10.1 (ADR-0086) — updates a prospecting list (owner-only).
 */
export async function updateProspectingList(
  listId: string,
  input: { name?: string; description?: string | null; shared?: boolean }
): Promise<ProspectingList> {
  const response = await authenticatedCoreFetch(`/v1/prospecting-lists/${listId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to update prospecting list: ${response.status}`);
  }
  return (await response.json()) as ProspectingList;
}

/**
 * Story 10.1 (ADR-0086) — deletes a prospecting list (owner-only).
 */
export async function deleteProspectingList(listId: string): Promise<void> {
  const response = await authenticatedCoreFetch(`/v1/prospecting-lists/${listId}`, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete prospecting list: ${response.status}`);
  }
}

/**
 * Story 10.1 (ADR-0086) — lists entries in a prospecting list (cursor-paginated).
 */
export async function listProspectingEntries(
  listId: string,
  options?: { limit?: number; cursor?: string }
): Promise<ProspectingEntriesResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.cursor) params.set('cursor', options.cursor);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const response = await authenticatedCoreFetch(`/v1/prospecting-lists/${listId}/entries${qs}`);
  if (!response.ok) {
    throw new Error(`Failed to list prospecting entries: ${response.status}`);
  }
  return (await response.json()) as ProspectingEntriesResponse;
}

/**
 * Story 10.1 (ADR-0086) — adds an author entry to a prospecting list.
 */
export async function addProspectingEntry(
  listId: string,
  input: {
    author_id: string;
    platform_id?: string;
    topic?: string | null;
    engagement_score?: number | null;
    authenticity_score?: number | null;
    influence_score?: number | null;
    reach_score?: number | null;
    relationship_stage?: 'new' | 'contacted' | 'engaged' | 'converted' | 'passed';
    notes?: string | null;
    tags?: string[];
    custom_attributes?: Record<string, unknown>;
  }
): Promise<ProspectingListEntry> {
  const response = await authenticatedCoreFetch(`/v1/prospecting-lists/${listId}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const status = response.status;
    throw Object.assign(new Error(`Failed to add entry: ${status}`), { status });
  }
  return (await response.json()) as ProspectingListEntry;
}

/**
 * Story 10.1 (ADR-0086) — updates an entry's stage, notes, tags, or custom attributes.
 */
export async function updateProspectingEntry(
  listId: string,
  entryId: string,
  input: {
    relationship_stage?: 'new' | 'contacted' | 'engaged' | 'converted' | 'passed';
    notes?: string | null;
    tags?: string[];
    custom_attributes?: Record<string, unknown>;
  }
): Promise<ProspectingListEntry> {
  const response = await authenticatedCoreFetch(`/v1/prospecting-lists/${listId}/entries/${entryId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to update entry: ${response.status}`);
  }
  return (await response.json()) as ProspectingListEntry;
}

/**
 * Story 10.1 (ADR-0086) — removes an entry from a prospecting list.
 */
export async function deleteProspectingEntry(listId: string, entryId: string): Promise<void> {
  const response = await authenticatedCoreFetch(`/v1/prospecting-lists/${listId}/entries/${entryId}`, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete entry: ${response.status}`);
  }
}

// ---------------------------------------------------------------------------
// Story 10.4 / 10.5 (ADR-0088) — Ad-Hoc Analytics Query Builder
// ---------------------------------------------------------------------------

export interface AdHocQueryPayload {
  dimensions?: string[];
  metrics?: string[];
  timeGrain?: 'day' | 'hour' | 'week' | 'month';
  filters?: {
    startDate?: string;
    endDate?: string;
    platforms?: string[];
    sentiments?: string[];
    watchlists?: string[];
    authors?: string[];
  };
  limit?: number;
  format?: 'json' | 'csv';
}

export interface AdHocQueryClientResponse {
  dimensions: string[];
  metrics: string[];
  rowCount: number;
  executionTimeMs: number;
  data: Record<string, any>[];
  csv?: string;
}

/**
 * Story 10.4 / 10.5 (ADR-0088) — executes parameterized ad-hoc aggregation query.
 */
export async function executeAdHocAnalyticsQuery(
  payload: AdHocQueryPayload
): Promise<AdHocQueryClientResponse> {
  const response = await authenticatedCoreFetch('/v1/analytics/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Ad-hoc query failed: ${response.status}`);
  }
  return (await response.json()) as AdHocQueryClientResponse;
}

// ---------------------------------------------------------------------------
// Story 10.6 / 10.7 (ADR-0089) — Platform Operations Telemetry Dashboard
// ---------------------------------------------------------------------------

export interface PlatformDashboardData {
  throughputPostsSec: number;
  avgIngestionLagSec: number;
  errorRateLast24hPct: number;
  totalTokensLast30d: number;
  estimatedCostLast30dUsd: number;
  connectors: Array<{
    platformId: string;
    status: 'healthy' | 'degraded' | 'error' | 'disconnected';
    errorCountLast24h: number;
    lastSuccessAt: string | null;
  }>;
  timeSeries: Array<{
    timestamp: string;
    ingestionVolume: number;
    errorCount: number;
  }>;
}

/**
 * Story 10.6 / 10.7 (ADR-0089) — gets real-time platform operations dashboard telemetry.
 */
export async function getPlatformDashboard(): Promise<PlatformDashboardData> {
  const response = await authenticatedCoreFetch('/v1/admin/platform-dashboard');
  if (!response.ok) {
    throw new Error(`Platform dashboard query failed: ${response.status}`);
  }
  return (await response.json()) as PlatformDashboardData;
}

// ---------------------------------------------------------------------------
// Story 10.9 / 10.10 (ADR-0091) — Real-Time Alert Engine & Alerts Inbox
// ---------------------------------------------------------------------------

export interface AlertRuleItem {
  id: string;
  tenant_id: string;
  name: string;
  type: 'volume_spike' | 'negative_sentiment_spike' | 'influential_post' | 'connector_error' | 'keyword_burst';
  thresholds: Record<string, any>;
  watchlist_id: string | null;
  platform_id: string | null;
  cooldown_minutes: number;
  last_triggered_at: string | null;
  channels: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantAlertItem {
  id: string;
  tenant_id: string;
  alert_rule_id: string;
  triggered_at: string;
  severity: 'info' | 'warning' | 'critical';
  summary: string;
  payload: Record<string, any>;
  status: 'active' | 'acknowledged' | 'resolved' | 'snoozed';
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

/**
 * Story 10.9 (ADR-0091) — lists alert rules for tenant.
 */
export async function listAlertRules(): Promise<{ rules: AlertRuleItem[] }> {
  const response = await authenticatedCoreFetch('/v1/alerts/rules');
  if (!response.ok) {
    throw new Error(`Failed to list alert rules: ${response.status}`);
  }
  return (await response.json()) as { rules: AlertRuleItem[] };
}

/**
 * Story 10.9 (ADR-0091) — creates an alert rule.
 */
export async function createAlertRule(input: {
  name: string;
  type: string;
  thresholds?: Record<string, any>;
  watchlist_id?: string | null;
  platform_id?: string | null;
  cooldown_minutes?: number;
  channels?: string[];
  enabled?: boolean;
}): Promise<AlertRuleItem> {
  const response = await authenticatedCoreFetch('/v1/alerts/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to create alert rule: ${response.status}`);
  }
  return (await response.json()) as AlertRuleItem;
}

/**
 * Story 10.9 (ADR-0091) — updates an alert rule.
 */
export async function updateAlertRule(
  ruleId: string,
  input: Partial<AlertRuleItem>
): Promise<AlertRuleItem> {
  const response = await authenticatedCoreFetch(`/v1/alerts/rules/${ruleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to update alert rule: ${response.status}`);
  }
  return (await response.json()) as AlertRuleItem;
}

/**
 * Story 10.9 (ADR-0091) — deletes an alert rule.
 */
export async function deleteAlertRule(ruleId: string): Promise<void> {
  const response = await authenticatedCoreFetch(`/v1/alerts/rules/${ruleId}`, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete alert rule: ${response.status}`);
  }
}

/**
 * Story 10.9 (ADR-0091) — lists alerts in inbox.
 */
export async function listTenantAlerts(options?: {
  status?: string;
  limit?: number;
}): Promise<{ alerts: TenantAlertItem[] }> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.limit) params.set('limit', String(options.limit));
  const qs = params.toString() ? `?${params.toString()}` : '';

  const response = await authenticatedCoreFetch(`/v1/alerts/inbox${qs}`);
  if (!response.ok) {
    throw new Error(`Failed to list alerts: ${response.status}`);
  }
  return (await response.json()) as { alerts: TenantAlertItem[] };
}

/**
 * Story 10.9 (ADR-0091) — updates alert triage status.
 */
export async function updateTenantAlertStatus(
  alertId: string,
  status: 'acknowledged' | 'resolved' | 'snoozed'
): Promise<TenantAlertItem> {
  const response = await authenticatedCoreFetch(`/v1/alerts/inbox/${alertId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update alert status: ${response.status}`);
  }
  return (await response.json()) as TenantAlertItem;
}

// ---------------------------------------------------------------------------
// Story 10.11 / 10.12 (ADR-0092) — Webhook Subscriptions & Notifications
// ---------------------------------------------------------------------------

export interface WebhookSubscriptionItem {
  id: string;
  tenant_id: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Story 10.11 (ADR-0092) — lists tenant webhook subscriptions.
 */
export async function listWebhookSubscriptions(): Promise<{ subscriptions: WebhookSubscriptionItem[] }> {
  const response = await authenticatedCoreFetch('/v1/webhooks/subscriptions');
  if (!response.ok) {
    throw new Error(`Failed to list webhooks: ${response.status}`);
  }
  return (await response.json()) as { subscriptions: WebhookSubscriptionItem[] };
}

/**
 * Story 10.11 (ADR-0092) — creates a webhook subscription.
 */
export async function createWebhookSubscription(input: {
  url: string;
  events?: string[];
  secret?: string;
}): Promise<WebhookSubscriptionItem> {
  const response = await authenticatedCoreFetch('/v1/webhooks/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to create webhook: ${response.status}`);
  }
  return (await response.json()) as WebhookSubscriptionItem;
}

/**
 * Story 10.11 (ADR-0092) — deletes a webhook subscription.
 */
export async function deleteWebhookSubscription(id: string): Promise<void> {
  const response = await authenticatedCoreFetch(`/v1/webhooks/subscriptions/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete webhook: ${response.status}`);
  }
}

/**
 * Story 10.11 (ADR-0092) — triggers a test ping delivery.
 */
export async function testWebhookSubscription(id: string): Promise<{ success: boolean; results: any[] }> {
  const response = await authenticatedCoreFetch(`/v1/webhooks/subscriptions/${id}/test`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to test webhook: ${response.status}`);
  }
  return (await response.json()) as { success: boolean; results: any[] };
}

// ---------------------------------------------------------------------------
// Story 10.14 (ADR-0094) — AI Insights Digest
// ---------------------------------------------------------------------------

export interface AiInsightsDigestResponse {
  tenantId: string;
  period: 'daily' | 'weekly';
  generatedAt: string;
  executiveSummary: string;
  sentimentBreakdown: {
    positivePct: number;
    neutralPct: number;
    negativePct: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  topThemes: Array<{
    theme: string;
    postCount: number;
    sentimentScore: number;
  }>;
  strategicRecommendations: string[];
}

/**
 * Story 10.14 (ADR-0094) — gets AI-generated executive intelligence digest.
 */
export async function getAiInsightsDigest(period: 'daily' | 'weekly' = 'daily'): Promise<AiInsightsDigestResponse> {
  const response = await authenticatedCoreFetch(`/v1/analytics/digest?period=${period}`);
  if (!response.ok) {
    throw new Error(`Failed to get AI digest: ${response.status}`);
  }
  return (await response.json()) as AiInsightsDigestResponse;
}

// ---------------------------------------------------------------------------
// Story 11.1 / 11.2 (ADR-0095) — CRM Connector & Case Handoff
// ---------------------------------------------------------------------------

export interface PushCaseToCRMInput {
  crmConnectorId: string;
  entityType: 'lead' | 'opportunity' | 'support';
  assignedTo?: string;
  notes?: string;
  customFields?: Record<string, any>;
  allowDuplicate?: boolean;
  authorId?: string;
}

export interface PushCaseToCRMResponse {
  outboundActivityId: string;
  crmRecordId: string;
  crmRecordUrl: string;
  status: 'success';
}

export interface CRMConnectorStatusItem {
  id: string;
  provider: 'dynamics365' | 'salesforce' | 'hubspot';
  status: {
    isActive: boolean;
    provider: string;
    lastValidatedAt?: string;
  };
}

export interface CRMFieldMappingItem {
  id: string;
  tenantId: string;
  crmConnectorId: string;
  entityType: 'lead' | 'opportunity' | 'support';
  sourceField: string;
  targetField: string;
  isRequired: boolean;
  defaultValue: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Story 11.1 / 11.2 (ADR-0095) — pushes a case/lead to an external CRM.
 */
export async function pushCaseToCRM(id: string, payload: PushCaseToCRMInput): Promise<Response> {
  return authenticatedCoreFetch(`/v1/inbox/items/${id}/case`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * Story 11.1 / 11.2 (ADR-0095) — lists available CRM connectors.
 */
export async function listCRMConnectors(): Promise<CRMConnectorStatusItem[]> {
  const response = await authenticatedCoreFetch('/v1/crm/connectors');
  if (!response.ok) {
    throw new Error(`Failed to list CRM connectors: ${response.status}`);
  }
  return (await response.json()) as CRMConnectorStatusItem[];
}

/**
 * Story 11.1 / 11.2 (ADR-0095) — lists custom CRM field mappings.
 */
export async function listCRMFieldMappings(crmConnectorId?: string, entityType?: string): Promise<CRMFieldMappingItem[]> {
  const params = new URLSearchParams();
  if (crmConnectorId) params.append('crmConnectorId', crmConnectorId);
  if (entityType) params.append('entityType', entityType);
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await authenticatedCoreFetch(`/v1/crm/field-mappings${query}`);
  if (!response.ok) {
    throw new Error(`Failed to list CRM field mappings: ${response.status}`);
  }
  return (await response.json()) as CRMFieldMappingItem[];
}

/**
 * Story 11.1 / 11.2 (ADR-0095) — creates or updates custom CRM field mapping.
 */
export async function upsertCRMFieldMapping(mapping: {
  crmConnectorId: string;
  entityType: 'lead' | 'opportunity' | 'support';
  sourceField: string;
  targetField: string;
  isRequired?: boolean;
  defaultValue?: string | null;
}): Promise<CRMFieldMappingItem> {
  const response = await authenticatedCoreFetch('/v1/crm/field-mappings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapping),
  });
  if (!response.ok) {
    throw new Error(`Failed to upsert CRM field mapping: ${response.status}`);
  }
  return (await response.json()) as CRMFieldMappingItem;
}

/**
 * Story 11.1 / 11.2 (ADR-0095) — deletes custom CRM field mapping.
 */
export async function deleteCRMFieldMapping(id: string): Promise<boolean> {
  const response = await authenticatedCoreFetch(`/v1/crm/field-mappings/${id}`, {
    method: 'DELETE',
  });
  return response.ok;
}

// ---------------------------------------------------------------------------
// Story 11.3 / 11.4 (ADR-0096) — Daily Digest Email
// ---------------------------------------------------------------------------

export interface UserDigestPreferences {
  id: string;
  tenantId: string;
  userId: string;
  isEnabled: boolean;
  sendAtLocal: string;
  timezone: string;
  watchlistIds: string[];
  includeAiSummary: boolean;
  includeTopPosts: boolean;
  includeTopicBreakdown: boolean;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DigestPreviewResponse {
  data: {
    tenantName: string;
    recipientName: string;
    recipientEmail: string;
    dateRangeLabel: string;
    totalMentions: number;
    sentimentDistribution: {
      positive: number;
      neutral: number;
      negative: number;
      mixed: number;
    };
    topTopics: Array<{ topic: string; count: number; deltaPercentage?: number }>;
    topPlatforms: Array<{ platform: string; count: number }>;
    notablePosts: Array<{
      postId: string;
      platform: string;
      authorName: string;
      authorHandle?: string;
      excerpt: string;
      publishedAt: string;
      url?: string;
      impactScore: number;
    }>;
    aiSummary?: {
      narrative: string;
      keyThemes: string[];
      sentimentTrend: string;
    };
    unsubscribeUrl: string;
  };
  rendered: {
    subject: string;
    html: string;
    text: string;
  };
}

/**
 * Story 11.3 / 11.4 (ADR-0096) — gets current user's daily digest preferences.
 */
export async function getUserDigestPreferences(): Promise<UserDigestPreferences> {
  const response = await authenticatedCoreFetch('/v1/users/me/digest-preferences');
  if (!response.ok) {
    throw new Error(`Failed to get digest preferences: ${response.status}`);
  }
  return (await response.json()) as UserDigestPreferences;
}

/**
 * Story 11.3 / 11.4 (ADR-0096) — updates current user's daily digest preferences.
 */
export async function upsertUserDigestPreferences(
  input: Partial<UserDigestPreferences>
): Promise<UserDigestPreferences> {
  const response = await authenticatedCoreFetch('/v1/users/me/digest-preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to update digest preferences: ${response.status}`);
  }
  return (await response.json()) as UserDigestPreferences;
}

/**
 * Story 11.3 / 11.4 (ADR-0096) — generates a one-off preview of the daily digest.
 */
export async function previewDailyDigest(
  customPreferences?: Partial<UserDigestPreferences>
): Promise<DigestPreviewResponse> {
  const response = await authenticatedCoreFetch('/v1/users/me/digest-previews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customPreferences || {}),
  });
  if (!response.ok) {
    throw new Error(`Failed to preview daily digest: ${response.status}`);
  }
  return (await response.json()) as DigestPreviewResponse;
}

// ---------------------------------------------------------------------------
// Story 11.5 / 11.6 (ADR-0097) — Topic Evolution Timeline
// ---------------------------------------------------------------------------

export interface TopicEvolutionPoint {
  date: string;
  mentionCount: number;
  uniqueAuthors: number;
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
  topAuthors: Array<{ authorId: string; authorName: string; count: number }>;
  topKeywords: Array<{ keyword: string; count: number }>;
  trend: 'rising' | 'stable' | 'falling';
}

export interface TopicEvolutionResponse {
  topicId: string;
  topicName: string;
  startDate: string;
  endDate: string;
  granularity: 'day' | 'week' | 'month';
  points: TopicEvolutionPoint[];
  previousPeriodPoints?: Array<{
    date: string;
    mentionCount: number;
    uniqueAuthors: number;
  }>;
}

/**
 * Story 11.5 / 11.6 (ADR-0097) — queries topic evolution longitudinal time-series data.
 */
export async function getTopicEvolution(options: {
  topic?: string;
  topicId?: string;
  topicName?: string;
  start?: string;
  end?: string;
  granularity?: 'day' | 'week' | 'month';
  compareToPrevious?: boolean;
}): Promise<TopicEvolutionResponse> {
  const params = new URLSearchParams();
  if (options.topic) params.set('topic', options.topic);
  if (options.topicId) params.set('topicId', options.topicId);
  if (options.topicName) params.set('topicName', options.topicName);
  if (options.start) params.set('start', options.start);
  if (options.end) params.set('end', options.end);
  if (options.granularity) params.set('granularity', options.granularity);
  if (options.compareToPrevious) params.set('compareToPrevious', 'true');

  const response = await authenticatedCoreFetch(`/v1/topics/evolution?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch topic evolution: ${response.status}`);
  }
  return (await response.json()) as TopicEvolutionResponse;
}

export interface OutboundPostAsset {
  type: 'image' | 'video' | 'link-card';
  url?: string;
  alt?: string;
  target?: string;
}

export interface PublishOutboundPostInput {
  text: string;
  assets?: OutboundPostAsset[];
  targetPlatforms: string[];
  scheduledFor?: string | null;
  assetTargets?: Record<string, string>;
  perPlatformOverrides?: Record<string, string>;
}

export interface PublishOutboundPostResult {
  activityIds: string[];
  scheduledFor: string | null;
}

export interface OutboundActivityItem {
  id: string;
  tenantId: string;
  userId: string;
  providerId: string;
  targetAssetId?: string | null;
  targetAssetType?: string | null;
  activityType: string;
  body: string;
  status: 'scheduled' | 'publishing' | 'published' | 'pending' | 'sent' | 'failed' | 'cancelled';
  externalId?: string | null;
  externalUrl?: string | null;
  errorCode?: string | null;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  sentAt?: string | null;
  failedAt?: string | null;
  cancelledAt?: string | null;
}

export interface ConnectorTargetItem {
  id: string;
  name: string;
  type: string;
}

/**
 * Story 11.7 / 11.8 (ADR-0098) — creates immediate or scheduled outbound posts across platforms.
 */
export async function publishOutboundPost(input: PublishOutboundPostInput): Promise<PublishOutboundPostResult> {
  const response = await authenticatedCoreFetch('/v1/outbound/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to publish outbound post: ${response.status}`);
  }
  return (await response.json()) as PublishOutboundPostResult;
}

/**
 * Story 11.7 / 11.8 (ADR-0098) — lists outbound posts queue with optional status filter.
 */
export async function listOutboundPosts(options?: {
  status?: string;
  providerId?: string;
  limit?: number;
}): Promise<{ posts: OutboundActivityItem[]; count: number }> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.providerId) params.set('providerId', options.providerId);
  if (options?.limit) params.set('limit', String(options.limit));

  const response = await authenticatedCoreFetch(`/v1/outbound/posts?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to list outbound posts: ${response.status}`);
  }
  return (await response.json()) as { posts: OutboundActivityItem[]; count: number };
}

/**
 * Story 11.7 / 11.8 (ADR-0098) — cancels a scheduled outbound post.
 */
export async function cancelOutboundActivity(activityId: string): Promise<OutboundActivityItem> {
  const response = await authenticatedCoreFetch(`/v1/outbound/activities/${encodeURIComponent(activityId)}/cancel`, {
    method: 'PATCH',
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to cancel outbound activity: ${response.status}`);
  }
  return (await response.json()) as OutboundActivityItem;
}

/**
 * Story 11.7 / 11.8 (ADR-0098) — reschedules a scheduled outbound post.
 */
export async function rescheduleOutboundActivity(
  activityId: string,
  scheduledFor: string
): Promise<OutboundActivityItem> {
  const response = await authenticatedCoreFetch(`/v1/outbound/activities/${encodeURIComponent(activityId)}/reschedule`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduledFor }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to reschedule outbound activity: ${response.status}`);
  }
  return (await response.json()) as OutboundActivityItem;
}

/**
 * Story 11.7 / 11.8 (ADR-0098) — gets available targets for an asset-targeting platform.
 */
export async function getConnectorTargets(platformId: string): Promise<ConnectorTargetItem[]> {
  const response = await authenticatedCoreFetch(`/v1/connectors/${encodeURIComponent(platformId)}/targets`);
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as { targets?: ConnectorTargetItem[] };
  return Array.isArray(payload.targets) ? payload.targets : [];
}

export type AdminInboxStatus = 'open' | 'assigned' | 'snoozed' | 'resolved';
export type AdminInboxPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface AdminInboxItem {
  id: string;
  tenantId: string;
  postId: string;
  watchlistId?: string | null;
  providerId: string;
  status: AdminInboxStatus;
  priority: AdminInboxPriority;
  assignedTo?: string | null;
  snoozedUntil?: string | null;
  notes?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  post?: {
    id: string;
    rawPayload?: any;
    publishedAt?: string;
    sentiment?: string;
    reach?: number;
  };
}

export interface ListInboxItemsOptions {
  status?: string;
  priority?: string;
  assignedTo?: string;
  providerId?: string;
  watchlistId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Story 11.9 / 11.10 (ADR-0099) — lists triage inbox items with filters.
 */
export async function listInboxItems(
  options?: ListInboxItemsOptions
): Promise<{ items: AdminInboxItem[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.priority) params.set('priority', options.priority);
  if (options?.assignedTo) params.set('assignedTo', options.assignedTo);
  if (options?.providerId) params.set('providerId', options.providerId);
  if (options?.watchlistId) params.set('watchlistId', options.watchlistId);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));

  const response = await authenticatedCoreFetch(`/v1/inbox?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to list inbox items: ${response.status}`);
  }
  return (await response.json()) as { items: AdminInboxItem[]; total: number };
}

/**
 * Story 11.9 / 11.10 (ADR-0099) — gets a single inbox item.
 */
export async function getInboxItem(id: string): Promise<AdminInboxItem> {
  const response = await authenticatedCoreFetch(`/v1/inbox/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error(`Failed to get inbox item: ${response.status}`);
  }
  return (await response.json()) as AdminInboxItem;
}

/**
 * Story 11.9 / 11.10 (ADR-0099) — updates notes/tags/priority on an inbox item.
 */
export async function updateInboxItem(
  id: string,
  updates: { notes?: string; tags?: string[]; priority?: AdminInboxPriority }
): Promise<AdminInboxItem> {
  const response = await authenticatedCoreFetch(`/v1/inbox/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error(`Failed to update inbox item: ${response.status}`);
  }
  return (await response.json()) as AdminInboxItem;
}

/**
 * Story 11.9 / 11.10 (ADR-0099) — assigns an inbox item.
 */
export async function assignInboxItem(id: string, assignedTo: string | null): Promise<AdminInboxItem> {
  const response = await authenticatedCoreFetch(`/v1/inbox/${encodeURIComponent(id)}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignedTo }),
  });
  if (!response.ok) {
    throw new Error(`Failed to assign inbox item: ${response.status}`);
  }
  return (await response.json()) as AdminInboxItem;
}

/**
 * Story 11.9 / 11.10 (ADR-0099) — snoozes an inbox item.
 */
export async function snoozeInboxItem(id: string, snoozedUntil: string): Promise<AdminInboxItem> {
  const response = await authenticatedCoreFetch(`/v1/inbox/${encodeURIComponent(id)}/snooze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snoozedUntil }),
  });
  if (!response.ok) {
    throw new Error(`Failed to snooze inbox item: ${response.status}`);
  }
  return (await response.json()) as AdminInboxItem;
}

/**
 * Story 11.9 / 11.10 (ADR-0099) — marks an inbox item resolved.
 */
export async function resolveInboxItem(id: string, notes?: string): Promise<AdminInboxItem> {
  const response = await authenticatedCoreFetch(`/v1/inbox/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  if (!response.ok) {
    throw new Error(`Failed to resolve inbox item: ${response.status}`);
  }
  return (await response.json()) as AdminInboxItem;
}

/**
 * Story 11.9 / 11.10 (ADR-0099) — replies to an inbox item and marks it resolved.
 */
export async function replyToInboxItem(
  id: string,
  body: string
): Promise<{ activityId: string; externalId: string | null; externalUrl: string | null; status: 'resolved' }> {
  const response = await authenticatedCoreFetch(`/v1/inbox/${encodeURIComponent(id)}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to reply to inbox item: ${response.status}`);
  }
  return (await response.json()) as { activityId: string; externalId: string | null; externalUrl: string | null; status: 'resolved' };
}

export interface MentionSuggestionItem {
  authorId: string;
  authorName: string;
  platformId: string;
  handle: string;
  reason: string;
  matchSource: 'topic' | 'rag' | 'keyword';
  confidence: number;
}

export interface GetMentionSuggestionsParams {
  text: string;
  targetPlatforms: string[];
  watchlistId?: string;
  maxSuggestions?: number;
}

/**
 * Story 11.11 / 11.12 (ADR-0100) — gets author mention suggestions for composer drafts.
 */
export async function getMentionSuggestions(
  params: GetMentionSuggestionsParams
): Promise<MentionSuggestionItem[]> {
  const response = await authenticatedCoreFetch(`/v1/composer/mention-suggestions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as { suggestions?: MentionSuggestionItem[] };
  return Array.isArray(payload.suggestions) ? payload.suggestions : [];
}

export interface SocialConnectorCapabilities {
  sourceType: 'social' | 'news' | 'forum' | 'review' | 'broadcast' | 'blog' | 'wiki';
  poll: boolean | { cadenceMs: number; supportsTimeWindow: boolean };
  count?: { supportsExactCount: boolean };
  publish?: { supportsScheduling: boolean; supportedAssetTypes: string[] };
  reply?: boolean;
  backfill?: { supportsHistorical: boolean; maxLookbackDays: number };
}

export interface ConnectorCapabilitySummary {
  platformId: string;
  name: string;
  authMode: 'oauth' | 'api_key' | 'none';
  capabilities: SocialConnectorCapabilities;
}

/**
 * Story 12.1 / 12.2 (ADR-0101) — gets dynamic capability matrix for all connectors.
 */
export async function getConnectorCapabilities(): Promise<{ connectors: ConnectorCapabilitySummary[] }> {
  const response = await authenticatedCoreFetch('/v1/connectors/capabilities', { method: 'GET' });
  if (!response.ok) {
    return { connectors: [] };
  }
  const payload = (await response.json()) as { connectors?: ConnectorCapabilitySummary[] };
  return { connectors: Array.isArray(payload.connectors) ? payload.connectors : [] };
}














