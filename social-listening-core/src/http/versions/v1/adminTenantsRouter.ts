import { Router } from 'express';
import { requirePlatformAdmin } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { createTenant, updateTenantAdmin, listTenants, getAdminTenantPlan } from '../../../tenants/tenantStore';

export const adminTenantsRouter = Router();

/**
 * GET /v1/admin/tenants (Story 5.12) — every tenant, Platform Admin only.
 */
adminTenantsRouter.get('/', async (req, res) => {
  const identity = requirePlatformAdmin(req as RequestWithIdentity, res);
  if (!identity) return;

  const tenants = await listTenants();
  res.json({ tenants });
});

/**
 * GET /v1/admin/tenants/:id/plan (Story 13.6, ADR-0112) — read a single tenant's
 * plan tier, effective max_seats, used seats, and effective feature gates.
 */
adminTenantsRouter.get('/:id/plan', async (req, res) => {
  const identity = requirePlatformAdmin(req as RequestWithIdentity, res);
  if (!identity) return;

  const plan = await getAdminTenantPlan(req.params.id);
  if (!plan) {
    res.status(404).json({ error: 'Tenant not found.' });
    return;
  }

  res.json(plan);
});

/**
 * POST /v1/admin/tenants (Story 5.12, Story 13.5 ADR-0112) — creates a tenant.
 * Story 13.5 adds `plan` and `featureGates`; `plan` defaults to 'starter'.
 */
adminTenantsRouter.post('/', async (req, res) => {
  const identity = requirePlatformAdmin(req as RequestWithIdentity, res);
  if (!identity) return;

  const { name, licenseSeatCount, domain, plan, featureGates } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name (string) is required.' });
    return;
  }
  if (typeof licenseSeatCount !== 'number') {
    res.status(400).json({ error: 'licenseSeatCount (number) is required.' });
    return;
  }

  const tenant = await createTenant(identity.adminId, {
    name,
    licenseSeatCount,
    domain,
    plan,
    featureGates,
  });
  res.status(201).json(tenant);
});

/**
 * PATCH /v1/admin/tenants/:id (Story 5.12, Story 13.5 ADR-0112) —
 * status/licenseSeatCount/domain/name/plan/featureGates. activeSeatCount is
 * rejected as a caller-facing signal; platform_admin_role is DB-level denied
 * from writing it regardless.
 */
adminTenantsRouter.patch('/:id', async (req, res) => {
  const identity = requirePlatformAdmin(req as RequestWithIdentity, res);
  if (!identity) return;

  if (Object.prototype.hasOwnProperty.call(req.body, 'activeSeatCount')) {
    res.status(400).json({ error: 'activeSeatCount cannot be set via this endpoint.' });
    return;
  }

  const { status, licenseSeatCount, domain, name, plan, featureGates } = req.body;
  const tenant = await updateTenantAdmin(identity.adminId, req.params.id, {
    status,
    licenseSeatCount,
    domain,
    name,
    plan,
    featureGates,
  });
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found, or no fields provided to update.' });
    return;
  }
  res.json(tenant);
});
