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
