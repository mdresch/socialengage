import { Router } from 'express';
import { requireTenantUser } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { getTenantPlan } from '../../../tenants/tenantStore';

export const tenantPlanRouter = Router();

/**
 * GET /v1/tenants/plan (Story 13.5, ADR-0112) — returns the caller's own
 * tenant's plan tier, effective max_seats, used seats, and effective
 * feature gates. Mounted at /v1/tenants/plan in router.ts.
 */
tenantPlanRouter.get('/', async (req, res) => {
  const tenantId = requireTenantUser(req as RequestWithIdentity, res);
  if (!tenantId) return;

  const plan = await getTenantPlan(tenantId);
  if (!plan) {
    res.status(404).json({ error: 'Tenant not found.' });
    return;
  }

  res.json(plan);
});
