import { Router } from 'express';
import { requireTenantUser } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { getOwnTenant } from '../../../tenants/tenantStore';

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
