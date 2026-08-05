import { Response } from 'express';
import { RequestWithIdentity } from './requestIdentity';
import { ResolvedIdentity } from '../../identity/identityResolution';

export interface TenantUserIdentity {
  tenantId: string;
  userId: string;
  role: string;
}

function requireTenantUserIdentityInternal(req: RequestWithIdentity, res: Response): TenantUserIdentity | null {
  const identity = req.identity;
  if (!identity || identity.type !== 'tenant_user') {
    res.status(403).json({ error: 'This route requires a tenant user identity.' });
    return null;
  }
  return { tenantId: identity.tenantId, userId: identity.userId, role: identity.role };
}

/**
 * The sanctioned way for a tenant-content route to get tenantId, since
 * Story 5.10 (ADR-0033). Replaces every prior `req.header('X-Tenant-Id')`
 * read. Returns the resolved tenantId, or sends 403 and returns null if
 * the caller's resolved identity isn't a tenant user (e.g. a Platform
 * Admin, which has zero access to tenant-content routes by design — ADR-
 * 0030 §2). See .claude/skills/tenant-auth-middleware/SKILL.md.
 */
export function requireTenantUser(req: RequestWithIdentity, res: Response): string | null {
  const identity = requireTenantUserIdentityInternal(req, res);
  return identity ? identity.tenantId : null;
}

/**
 * Story 1.7 (ADR-0034): for routes whose authorization depends on the
 * caller's role/userId, not just tenantId — e.g. connect/disconnect's
 * ownership-tier checks. Same rejection behavior as requireTenantUser()
 * (403 for a non-tenant-user identity); returns the full resolved shape
 * instead of discarding userId/role. See
 * .claude/skills/connector-connect-disconnect/SKILL.md.
 */
export function requireTenantUserIdentity(req: RequestWithIdentity, res: Response): TenantUserIdentity | null {
  return requireTenantUserIdentityInternal(req, res);
}

/**
 * Story 5.11 (ADR-0036 §5): the one route (GET /v1/me) that needs the
 * caller's raw resolved identity regardless of shape — tenant_user or
 * platform_admin alike — rather than requiring one specific kind the way
 * requireTenantUser()/requireTenantUserIdentity() do. Safe to read
 * req.identity directly here, in this one centralized accessor, only because
 * createTenantAuthMiddleware() already guarantees it's set by the time any
 * route handler runs — a null resolveIdentity() result is already rejected
 * 403 before next() is ever called. Never re-derives or overrides it; a new
 * route should call this (or one of the two above), not read req.identity
 * inline as a shortcut — see .claude/skills/tenant-auth-middleware/SKILL.md.
 */
export function getResolvedIdentity(req: RequestWithIdentity): ResolvedIdentity {
  return req.identity as ResolvedIdentity;
}
