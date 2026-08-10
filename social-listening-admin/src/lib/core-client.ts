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

/**
 * Story 6.6 / Story 5.12 — create tenant via Platform Admin endpoint.
 */
export async function createAdminTenant(input: {
  name: string;
  licenseSeatCount: number;
  domain?: string | null;
}): Promise<AdminTenant> {
  const response = await authenticatedCoreFetch('/v1/admin/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to create tenant: ${response.status}`);
  }
  return (await response.json()) as AdminTenant;
}

/**
 * Story 6.6 / Story 5.12 — update tenant administrative metadata.
 */
export async function updateAdminTenant(
  tenantId: string,
  input: { status?: 'active' | 'suspended'; licenseSeatCount?: number; domain?: string | null }
): Promise<AdminTenant> {
  const response = await authenticatedCoreFetch(`/v1/admin/tenants/${encodeURIComponent(tenantId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to update tenant: ${response.status}`);
  }
  return (await response.json()) as AdminTenant;
}

/**
 * Story 6.6 / Story 5.13 — record a break-glass request.
 */
export async function requestBreakGlassReset(input: {
  tenantId: string;
  targetUserId: string;
}): Promise<unknown> {
  const response = await authenticatedCoreFetch(
    `/v1/admin/tenants/${encodeURIComponent(input.tenantId)}/break-glass/request`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: input.targetUserId }),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to request break-glass reset: ${response.status}`);
  }
  return await response.json();
}

/**
 * Story 6.6 / Story 5.13 — execute an existing break-glass request.
 */
export async function executeBreakGlassRequest(input: {
  tenantId: string;
  requestId: string;
}): Promise<unknown> {
  const response = await authenticatedCoreFetch(
    `/v1/admin/tenants/${encodeURIComponent(input.tenantId)}/break-glass/requests/${encodeURIComponent(input.requestId)}/execute`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to execute break-glass request: ${response.status}`);
  }
  return await response.json();
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
