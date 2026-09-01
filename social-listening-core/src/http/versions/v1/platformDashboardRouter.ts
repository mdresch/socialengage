import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { getPlatformDashboardData } from '../../../platform/platformMetricsStore';

export const platformDashboardRouter = Router();

// GET /v1/admin/platform-dashboard (Story 10.6, ADR-0089)
platformDashboardRouter.get('/platform-dashboard', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const data = await getPlatformDashboardData();
    res.json(data);
  } catch (err: any) {
    console.error('Error in GET /v1/admin/platform-dashboard:', err);
    res.status(500).json({ error: err?.message || 'Failed to retrieve platform dashboard.' });
  }
});
