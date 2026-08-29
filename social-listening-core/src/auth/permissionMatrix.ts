/**
 * RBAC Permission Matrix — Story 12.13 (ADR-0107).
 * Defines per-role capability scopes for users, connectors, watchlists, alerts, etc.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { RequestWithIdentity } from '../http/auth/requestIdentity';
import { requireTenantUserIdentity } from '../http/auth/requireTenantUser';

export type Resource =
  | 'users'
  | 'connectors'
  | 'watchlists'
  | 'alerts'
  | 'posts'
  | 'analytics'
  | 'settings'
  | 'exports'
  | 'dsr';

export type Action =
  | 'read'
  | 'read_all'
  | 'manage'
  | 'manage_all'
  | 'own'
  | 'activate_own'
  | 'create_own'
  | 'read_shared'
  | 'none';

export const PERMISSIONS: Record<string, Record<Resource, string>> = {
  tenant_admin: {
    users: 'manage',
    connectors: 'manage',
    watchlists: 'manage_all',
    alerts: 'manage_all',
    posts: 'read_all',
    analytics: 'read_all',
    settings: 'manage',
    exports: 'manage',
    dsr: 'manage',
  },
  tenant_user: {
    users: 'none',
    connectors: 'activate_own',
    watchlists: 'own',
    alerts: 'own',
    posts: 'read',
    analytics: 'read',
    settings: 'read',
    exports: 'own',
    dsr: 'create_own',
  },
  analyst: {
    users: 'none',
    connectors: 'none',
    watchlists: 'read_shared',
    alerts: 'none',
    posts: 'read',
    analytics: 'read',
    settings: 'read',
    exports: 'own',
    dsr: 'create_own',
  },
};

/**
 * Checks if a given role possesses the requested action on a resource.
 */
export function hasPermission(role: string, resource: Resource, action: Action): boolean {
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) return false;

  const roleCapability = rolePermissions[resource];
  if (!roleCapability || roleCapability === 'none') return false;

  // Exact capability match
  if (roleCapability === action) return true;

  // Hierarchical grants: manage / manage_all implies read, read_all, own, etc.
  if (roleCapability === 'manage_all' || roleCapability === 'manage') {
    return true;
  }
  if (roleCapability === 'read_all' && (action === 'read' || action === 'read_shared')) {
    return true;
  }
  if (roleCapability === 'own' && action === 'read') {
    return true;
  }
  if (roleCapability === 'activate_own' && action === 'activate_own') {
    return true;
  }

  return false;
}

/**
 * Middleware ensuring caller identity satisfies permission requirements.
 */
export function requirePermission(resource: Resource, action: Action): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
    if (!identity) return;

    if (!hasPermission(identity.role, resource, action)) {
      res.status(403).json({
        error: `Permission denied: role '${identity.role}' lacks '${action}' on '${resource}'.`,
        code: 'PERMISSION_DENIED',
      });
      return;
    }

    next();
  };
}
