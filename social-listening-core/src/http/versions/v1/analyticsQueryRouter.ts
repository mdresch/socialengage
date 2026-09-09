import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { executeAdHocQuery, AdHocQueryRequest } from '../../../analytics/adHocQueryEngine';

export const analyticsQueryRouter = Router();

// POST /v1/analytics/query
analyticsQueryRouter.post('/query', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const queryRequest: AdHocQueryRequest = req.body || {};

  try {
    const result = await executeAdHocQuery(identity.tenantId, identity.userId, queryRequest);

    if (queryRequest.format === 'csv' && result.csv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics-query-export.csv"');
      res.send(result.csv);
      return;
    }

    res.json(result);
  } catch (err: any) {
    if (
      err.message?.includes('Invalid dimension') ||
      err.message?.includes('Invalid metric') ||
      err.message?.includes('Invalid time grain')
    ) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err?.message || 'Failed to execute query.' });
  }
});
