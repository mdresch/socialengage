export type AdminRole = 'tenant_admin' | 'tenant_user' | 'platform_admin';

export type RoleShell = 'tenant' | 'platform-admin';

/**
 * Mirrors social-listening-core/src/identity/identityResolution.ts's own ResolvedIdentity
 * type exactly — a discriminated union, NOT a flat `{ role }` shape. This distinction is
 * load-bearing: a real platform_admin identity has no `role` field at all (see this
 * component's own SKILL.md Load-bearing constraint — a flat `{role}` cast onto this shape
 * was exactly the bug healed 2026-08-06).
 */
export type ResolvedIdentity =
  | { type: 'tenant_user'; tenantId: string; userId: string; role: string }
  | { type: 'platform_admin'; adminId: string };

/**
 * `session.identity` crosses an untyped JSON boundary (core's GET /v1/me response,
 * stored as `unknown` in SessionTokens) — this is the one place that boundary gets
 * validated into the real discriminated shape, rather than blindly cast.
 */
export function isResolvedIdentity(value: unknown): value is ResolvedIdentity {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.type === 'platform_admin') return typeof v.adminId === 'string';
  if (v.type === 'tenant_user') {
    return typeof v.tenantId === 'string' && typeof v.userId === 'string' && typeof v.role === 'string';
  }
  return false;
}

/**
 * Returns `null` for a `null` identity — a genuinely unresolved caller (a real Entra
 * sign-in with no matching `users`/`platform_admins` row anywhere) gets no shell at all,
 * never a default. See this file's own SKILL.md "Load-bearing constraints" — this used to
 * default to `'tenant'`, healed 2026-08-12 after live testing found an unresolved identity
 * could render the full tenant shell (Menno's explicit sign-off; see docs/implementation-log.md).
 */
export function getRoleShell(identity: ResolvedIdentity | null): RoleShell | null {
  if (!identity) return null;
  return identity.type === 'platform_admin' ? 'platform-admin' : 'tenant';
}

export function getTenantShellActions(identity: ResolvedIdentity | null): string[] {
  const actions = ['Connect a platform', 'Manage watchlists', 'View connector status'];
  if (identity?.type === 'tenant_user' && identity.role === 'tenant_admin') {
    actions.push('Tenant-wide connect');
  }
  return actions;
}

/**
 * The actual AC2 enforcement point: is a session with this identity allowed to render
 * the given shell? Story 6.2's own AC2 requires this proven directly — "not just by the
 * absence of a visible link" — so this return value is what a route's own page component
 * must act on (redirect when false), not merely which link the home page happens to show.
 */
export function isShellAllowed(identity: ResolvedIdentity | null, shell: RoleShell): boolean {
  return getRoleShell(identity) === shell;
}
