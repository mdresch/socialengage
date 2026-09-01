import { Router } from 'express';
import { requirePlatformAdmin } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { queryPlatformMetricsAggregated } from '../../../platform/platformMetricsStore';

export const adminPlatformMetricsRouter = Router();

// GET /v1/admin/platform-metrics?metricName=&granularity=&from=&to= (Story 13.8, ADR-0114)
adminPlatformMetricsRouter.get('/platform-metrics', async (req, res) => {
  const identity = requirePlatformAdmin(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const metricName = typeof req.query.metricName === 'string' ? req.query.metricName : undefined;
    const granularity = typeof req.query.granularity === 'string' ? req.query.granularity : undefined;
    const from = typeof req.query.from === 'string' ? new Date(req.query.from) : undefined;
    const to = typeof req.query.to === 'string' ? new Date(req.query.to) : undefined;

    if ((req.query.from && (from == null || isNaN(from.getTime()))) ||
        (req.query.to && (to == null || isNaN(to.getTime())))) {
      res.status(400).json({ error: 'Invalid date format for from or to.' });
      return;
    }

    const metrics = await queryPlatformMetricsAggregated({
      metricName,
      granularity,
      from,
      to,
    });

    res.status(200).json({ metrics });
  } catch (err: any) {
    console.error('Error in GET /v1/admin/platform-metrics:', err);
    res.status(500).json({ error: err?.message || 'Failed to retrieve platform metrics.' });
  }
});
