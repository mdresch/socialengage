import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { withTenant } from '../../../db/withTenant';
import { getPool } from '../../../db/pool';
import { PoolClient } from 'pg';

import { executeAdHocQuery, AdHocQueryRequest } from '../../../analytics/adHocQueryEngine';
import { generateAiInsightsDigest } from '../../../analytics/aiDigestGenerator';
import { getDashboardData } from '../../../analytics/dashboard/dashboardService';
import { DashboardQueryParams } from '../../../analytics/dashboard/widgetRegistry';

export const analyticsViewsRouter = Router();

// GET /v1/analytics/dashboard (Story 12.9, ADR-0105)
analyticsViewsRouter.get('/dashboard', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const { watchlistId, selectedTopic, granularity, includeExplanation } = req.query;

    let timeRange: { start?: string; end?: string } | undefined;
    if (typeof req.query.timeRange === 'object' && req.query.timeRange !== null) {
      const tr = req.query.timeRange as Record<string, any>;
      timeRange = { start: tr.start, end: tr.end };
    } else if (req.query.start_date || req.query.end_date) {
      timeRange = {
        start: req.query.start_date as string | undefined,
        end: req.query.end_date as string | undefined,
      };
    }

    const params: DashboardQueryParams = {
      watchlistId: typeof watchlistId === 'string' ? watchlistId : undefined,
      selectedTopic: typeof selectedTopic === 'string' ? selectedTopic : undefined,
      granularity: (granularity as any) || 'day',
      includeExplanation: includeExplanation === 'true' || includeExplanation === '1',
      timeRange,
    };

    const dashboard = await getDashboardData(identity.tenantId, params);
    res.json(dashboard);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve analytics dashboard data.' });
  }
});


// GET /v1/analytics/digest (Story 10.14, ADR-0094)
analyticsViewsRouter.get('/digest', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const period = req.query.period === 'weekly' ? 'weekly' : 'daily';

  try {
    const digest = await generateAiInsightsDigest(identity.tenantId, identity.userId, period);
    res.json(digest);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate AI insights digest.' });
  }
});

// POST /v1/analytics/query (Story 10.4, ADR-0088)
analyticsViewsRouter.post('/query', async (req, res) => {
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

const VALID_VIEWS = ['sources', 'authors', 'sentiments', 'watchlists'] as const;
type ViewName = typeof VALID_VIEWS[number];

function parseDateRange(query: Record<string, any>): { startDate: string; endDate: string } {
  const endDate = query.end_date || new Date().toISOString().slice(0, 10);
  const startDate = query.start_date || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  return { startDate, endDate };
}

/**
 * Story 10.3 (ADR-0087) — GET /v1/analytics/:view
 * Returns precomputed daily count aggregates for the requested dimension.
 */
analyticsViewsRouter.get('/:view', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const view = req.params.view as ViewName;
  if (!VALID_VIEWS.includes(view)) {
    res.status(400).json({
      error: `Invalid view '${view}'. Must be one of: ${VALID_VIEWS.join(', ')}`,
    });
    return;
  }

  const { startDate, endDate } = parseDateRange(req.query as Record<string, any>);

  try {
    const rows = await withTenant<any[]>(
      identity.tenantId,
      async (client: PoolClient) => {
        let query: string;
        const params = [identity.tenantId, startDate, endDate];

        switch (view) {
          case 'sources':
            query = `
              SELECT date, platform_id, post_count, positive_count, neutral_count, negative_count, updated_at
              FROM source_daily_counts
              WHERE tenant_id = $1 AND date >= $2::date AND date <= $3::date
              ORDER BY date DESC, post_count DESC`;
            break;
          case 'authors':
            query = `
              SELECT date, author_id, post_count, engagement_total, updated_at
              FROM author_daily_counts
              WHERE tenant_id = $1 AND date >= $2::date AND date <= $3::date
              ORDER BY date DESC, post_count DESC`;
            break;
          case 'sentiments':
            query = `
              SELECT date, sentiment, post_count, updated_at
              FROM sentiment_daily_counts
              WHERE tenant_id = $1 AND date >= $2::date AND date <= $3::date
              ORDER BY date DESC, post_count DESC`;
            break;
          case 'watchlists':
            query = `
              SELECT date, watchlist_id, post_count, positive_count, neutral_count, negative_count, updated_at
              FROM watchlist_daily_counts
              WHERE tenant_id = $1 AND date >= $2::date AND date <= $3::date
              ORDER BY date DESC, post_count DESC`;
            break;
          default:
            return [];
        }

        const { rows: result } = await client.query(query, params);
        return result;
      },
      getPool()
    );

    res.json({
      view,
      startDate,
      endDate,
      rowCount: rows.length,
      rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve analytics view.' });
  }
});
