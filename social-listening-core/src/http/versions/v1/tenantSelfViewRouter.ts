import { Router } from 'express';
import { requireTenantUser, requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import {
  getOwnTenant,
  getTenantFeatureGates,
  updateTenantFeatureGates,
} from '../../../tenants/tenantStore';

export const tenantSelfViewRouter = Router();

/**
 * GET /v1/tenants/me (Story 1.8, ADR-0031) — returns the caller's own
 * tenant's settings. Reads via the ordinary withTenant() / app_user path
 * (ADR-0015) — never platform_admin_role. Platform Admin gets 403 here;
 * their equivalent is GET /v1/admin/tenants (Story 5.12).
 * See .claude/skills/tenants/SKILL.md.
 */
tenantSelfViewRouter.get('/', async (req, res) => {
  const tenantId = requireTenantUser(req as RequestWithIdentity, res);
  if (!tenantId) return; // 403 already sent

  const tenant = await getOwnTenant(tenantId);
  if (!tenant) {
    // RLS would have hidden the row if it doesn't belong to this tenant;
    // a missing row at this point means the tenant was deleted mid-request.
    res.status(404).json({ error: 'Tenant not found.' });
    return;
  }

  res.json(tenant);
});

/**
 * GET /v1/tenants/me/features (Story 12.13, ADR-0107) — returns the caller's own
 * tenant's active feature gates.
 */
tenantSelfViewRouter.get('/features', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const featureGates = await getTenantFeatureGates(identity.tenantId);
    res.json({ featureGates });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get feature gates.' });
  }
});

/**
 * PATCH /v1/tenants/me/features (Story 12.13, ADR-0107) — updates the caller's own
 * tenant's feature gates. Restricted to tenant_admin.
 */
tenantSelfViewRouter.patch('/features', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (identity.role !== 'tenant_admin') {
    res.status(403).json({ error: 'Only tenant_admin may update feature gates.' });
    return;
  }

  const { featureGates } = req.body || {};
  if (!featureGates || typeof featureGates !== 'object') {
    res.status(400).json({ error: 'featureGates object is required.' });
    return;
  }

  try {
    const updated = await updateTenantFeatureGates(identity.tenantId, featureGates);
    res.json({ featureGates: updated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update feature gates.' });
  }
});
