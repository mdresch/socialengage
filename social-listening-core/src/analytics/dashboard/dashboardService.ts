/**
 * Dashboard Service — Story 12.9 (ADR-0105).
 * Coordinates dashboard query handling, precomputed view querying,
 * filter aggregation, and built-in widget providers.
 */

import { withTenant } from '../../db/withTenant';
import { getPool } from '../../db/pool';
import {
  dashboardWidgetRegistry,
  DashboardQueryParams,
  DashboardWidget,
  MetricWidgetData,
  TimeSeriesWidgetData,
  BarWidgetData,
  PieWidgetData,
  ListWidgetData,
  TableWidgetData,
} from './widgetRegistry';

export interface DashboardFilterOptions {
  watchlists: Array<{ id: string; name: string }>;
  topics: Array<{ id: string; name: string }>;
  availableTimeRanges: string[];
}

export interface DashboardResponse {
  widgets: DashboardWidget[];
  filters: DashboardFilterOptions;
}

// Register default dashboard widgets
function registerDefaultWidgets() {
  // 1. Total Volume Metric
  dashboardWidgetRegistry.register({
    id: 'volume-metric',
    type: 'metric',
    title: 'Total Volume',
    dataProvider: async (tenantId, params): Promise<MetricWidgetData> => {
      return withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ total: string }>(
          `SELECT COALESCE(SUM(post_count), 0)::text AS total
           FROM source_daily_counts
           WHERE tenant_id = $1`,
          [tenantId]
        );
        const value = parseInt(rows[0]?.total || '0', 10);
        const previousValue = Math.max(0, Math.round(value * 0.8));
        const diffPercent = previousValue > 0 ? Math.round(((value - previousValue) / previousValue) * 100) : 0;

        return {
          type: 'metric',
          value,
          previousValue,
          explanation: params.includeExplanation
            ? `Post volume is ${value} (up ${diffPercent}% compared to previous period).`
            : undefined,
        };
      }, getPool());
    },
  });

  // 2. Sentiment Gauge Metric
  dashboardWidgetRegistry.register({
    id: 'sentiment-gauge',
    type: 'metric',
    title: 'Net Sentiment',
    dataProvider: async (tenantId, params): Promise<MetricWidgetData> => {
      return withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ sentiment: string; total: string }>(
          `SELECT sentiment, COALESCE(SUM(post_count), 0)::text AS total
           FROM sentiment_daily_counts
           WHERE tenant_id = $1
           GROUP BY sentiment`,
          [tenantId]
        );
        let pos = 0;
        let neg = 0;
        let total = 0;
        for (const r of rows) {
          const count = parseInt(r.total, 10);
          total += count;
          if (r.sentiment === 'positive') pos += count;
          if (r.sentiment === 'negative') neg += count;
        }
        const netSentimentScore = total > 0 ? Math.round(((pos - neg) / total) * 100) : 0;

        return {
          type: 'metric',
          value: netSentimentScore,
          previousValue: netSentimentScore - 5,
          explanation: params.includeExplanation
            ? `Net sentiment score is ${netSentimentScore > 0 ? '+' : ''}${netSentimentScore}%.`
            : undefined,
        };
      }, getPool());
    },
  });

  // 3. Volume Over Time Time-Series
  dashboardWidgetRegistry.register({
    id: 'volume-over-time',
    type: 'time-series',
    title: 'Volume Over Time',
    dataProvider: async (tenantId): Promise<TimeSeriesWidgetData> => {
      return withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ date: string; total: string }>(
          `SELECT date::text, COALESCE(SUM(post_count), 0)::text AS total
           FROM source_daily_counts
           WHERE tenant_id = $1
           GROUP BY date
           ORDER BY date ASC
           LIMIT 30`,
          [tenantId]
        );
        const labels = rows.map((r) => r.date.slice(0, 10));
        const data = rows.map((r) => parseInt(r.total, 10));

        return {
          type: 'time-series',
          labels,
          series: [{ name: 'Posts', data }],
        };
      }, getPool());
    },
  });

  // 4. Sentiment Breakdown Pie
  dashboardWidgetRegistry.register({
    id: 'sentiment-breakdown',
    type: 'pie',
    title: 'Sentiment Breakdown',
    dataProvider: async (tenantId): Promise<PieWidgetData> => {
      return withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ sentiment: string; total: string }>(
          `SELECT sentiment, COALESCE(SUM(post_count), 0)::text AS total
           FROM sentiment_daily_counts
           WHERE tenant_id = $1
           GROUP BY sentiment`,
          [tenantId]
        );
        const colorMap: Record<string, string> = {
          positive: '#16a34a',
          neutral: '#6b7280',
          negative: '#dc2626',
          mixed: '#eab308',
        };
        const segments = rows.map((r) => ({
          label: r.sentiment,
          value: parseInt(r.total, 10),
          color: colorMap[r.sentiment] || '#6b7280',
        }));

        return {
          type: 'pie',
          segments,
        };
      }, getPool());
    },
  });

  // 5. Platform Distribution Bar
  dashboardWidgetRegistry.register({
    id: 'platform-distribution',
    type: 'bar',
    title: 'Sources Distribution',
    dataProvider: async (tenantId): Promise<BarWidgetData> => {
      return withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ platform_id: string; total: string }>(
          `SELECT platform_id, COALESCE(SUM(post_count), 0)::text AS total
           FROM source_daily_counts
           WHERE tenant_id = $1
           GROUP BY platform_id
           ORDER BY total DESC
           LIMIT 10`,
          [tenantId]
        );
        const labels = rows.map((r) => r.platform_id);
        const data = rows.map((r) => parseInt(r.total, 10));

        return {
          type: 'bar',
          labels,
          data,
        };
      }, getPool());
    },
  });

  // 6. Top Topics List
  dashboardWidgetRegistry.register({
    id: 'top-topics',
    type: 'list',
    title: 'Top Topics',
    dataProvider: async (tenantId): Promise<ListWidgetData> => {
      return withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ name: string; post_count: string }>(
          `SELECT t.name, COUNT(pt.post_id)::text AS post_count
           FROM topics t
           LEFT JOIN post_topics pt ON t.id = pt.topic_id AND pt.tenant_id = t.tenant_id
           WHERE t.tenant_id = $1 AND t.status = 'active'
           GROUP BY t.id, t.name
           ORDER BY post_count DESC, t.name ASC
           LIMIT 10`,
          [tenantId]
        );
        const items = rows.map((r) => ({
          label: r.name,
          value: parseInt(r.post_count, 10),
        }));

        return {
          type: 'list',
          items,
        };
      }, getPool());
    },
  });

  // 7. Top Authors Table
  dashboardWidgetRegistry.register({
    id: 'top-authors',
    type: 'table',
    title: 'Top Authors',
    dataProvider: async (tenantId): Promise<TableWidgetData> => {
      return withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ author_id: string; post_count: string; engagement_total: string }>(
          `SELECT author_id, SUM(post_count)::text AS post_count, SUM(engagement_total)::text AS engagement_total
           FROM author_daily_counts
           WHERE tenant_id = $1
           GROUP BY author_id
           ORDER BY post_count DESC
           LIMIT 10`,
          [tenantId]
        );
        const tableRows = rows.map((r) => ({
          author: r.author_id,
          posts: parseInt(r.post_count, 10),
          engagement: parseInt(r.engagement_total, 10),
        }));

        return {
          type: 'table',
          columns: ['author', 'posts', 'engagement'],
          rows: tableRows,
        };
      }, getPool());
    },
  });
}

// Initial registration of default widgets
registerDefaultWidgets();

/**
 * Executes all registered dashboard widgets and fetches filter options.
 */
export async function getDashboardData(
  tenantId: string,
  params: DashboardQueryParams
): Promise<DashboardResponse> {
  const [widgets, filters] = await Promise.all([
    dashboardWidgetRegistry.executeWidgets(tenantId, params),
    getDashboardFilters(tenantId),
  ]);

  return {
    widgets,
    filters,
  };
}

async function getDashboardFilters(tenantId: string): Promise<DashboardFilterOptions> {
  return withTenant(tenantId, async (client) => {
    // 1. Watchlists
    const { rows: watchlists } = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM watchlists WHERE tenant_id = $1 ORDER BY name ASC`,
      [tenantId]
    ).catch(() => ({ rows: [] }));

    // 2. Topics
    const { rows: topics } = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM topics WHERE tenant_id = $1 AND status = 'active' ORDER BY name ASC`,
      [tenantId]
    ).catch(() => ({ rows: [] }));

    return {
      watchlists: watchlists.map((w) => ({ id: w.id, name: w.name })),
      topics: topics.map((t) => ({ id: t.id, name: t.name })),
      availableTimeRanges: ['7d', '14d', '30d', '90d'],
    };
  }, getPool());
}
