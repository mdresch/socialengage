import { Router } from 'express';
import { requirePlatformAdmin } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { createTenant, updateTenantAdmin, listTenants } from '../../../tenants/tenantStore';

export const adminTenantsRouter = Router();

/**
 * GET /v1/admin/tenants (Story 5.12) — every tenant, Platform Admin only.
 * See .claude/skills/platform-admin-tenant-management/SKILL.md.
 */
adminTenantsRouter.get('/', async (req, res) => {
  const identity = requirePlatformAdmin(req as RequestWithIdentity, res);
  if (!identity) return;

  const tenants = await listTenants();
  res.json({ tenants });
});

/**
 * POST /v1/admin/tenants (Story 5.12) — creates via tenantStore.ts's
 * existing createTenant(), which already runs under platform_admin_role and
 * already calls logPlatformAdminAction() — this route adds no new logic
 * beyond gating the caller and forwarding the body.
 */
adminTenantsRouter.post('/', async (req, res) => {
  const identity = requirePlatformAdmin(req as RequestWithIdentity, res);
  if (!identity) return;

  const { name, licenseSeatCount, domain } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name (string) is required.' });
    return;
  }
  if (typeof licenseSeatCount !== 'number') {
    res.status(400).json({ error: 'licenseSeatCount (number) is required.' });
    return;
  }

  const tenant = await createTenant(identity.adminId, { name, licenseSeatCount, domain });
  res.status(201).json(tenant);
});

/**
 * PATCH /v1/admin/tenants/:id (Story 5.12) — status/licenseSeatCount/domain/name
 * only. activeSeatCount is rejected here as a caller-facing signal;
 * platform_admin_role is DB-level denied from writing it regardless
 * (migrations/0017) — this check is not the real enforcement boundary.
 */
adminTenantsRouter.patch('/:id', async (req, res) => {
  const identity = requirePlatformAdmin(req as RequestWithIdentity, res);
  if (!identity) return;

  if (Object.prototype.hasOwnProperty.call(req.body, 'activeSeatCount')) {
    res.status(400).json({ error: 'activeSeatCount cannot be set via this endpoint.' });
    return;
  }

  const { status, licenseSeatCount, domain, name } = req.body;
  const tenant = await updateTenantAdmin(identity.adminId, req.params.id, { status, licenseSeatCount, domain, name });
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found, or no fields provided to update.' });
    return;
  }
  res.json(tenant);
});

// Story 3.7's export/delete routes (Platform-Admin-gated) lived here briefly
// the night of 2026-08-06/07 and were retired before ever being committed —
// ADR-0039 Decision §1 (superseded 2026-08-07) and ADR-0043 (as amended)
// both record why: platform_admin_role has zero access to any tenant-content
// table, no exception carved out for deletion. Tenant offboarding is now
// tenant_admin-initiated, self-service, own-tenant-only — see
// selfServiceTenantDeletionRouter.ts and
// .claude/skills/self-service-tenant-deletion/SKILL.md.
