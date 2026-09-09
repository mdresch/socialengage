import { RequestHandler } from 'express';
import { RequestWithIdentity } from './requestIdentity';
import { isFeatureEnabled } from '../../tenants/featureGates';
import { getTenantFeatureGates } from '../../tenants/tenantStore';

/**
 * Story 13.5 (ADR-0112): route-level middleware that returns 403
 * `FEATURE_NOT_AVAILABLE` when the requested feature is disabled for the
 * caller's tenant. Missing feature keys are treated as enabled to avoid
 * breaking existing test fixtures and pre-13.5 tenants.
 */
export function requireFeatureGate(feature: string): RequestHandler {
  return async (req, res, next): Promise<void> => {
    const identity = (req as RequestWithIdentity).identity;
    if (!identity || identity.type !== 'tenant_user') {
      res.status(403).json({ error: 'This route requires a tenant user identity.' });
      return;
    }

    const featureGates = await getTenantFeatureGates(identity.tenantId);
    if (!isFeatureEnabled(featureGates, feature)) {
      res.status(403).json({
        error: `Feature '${feature}' is not available on this tenant's plan.`,
        code: 'FEATURE_NOT_AVAILABLE',
      });
      return;
    }

    next();
  };
}
