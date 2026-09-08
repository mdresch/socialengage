import { getAdminPool } from '../db/adminPool';
import { getPool } from '../db/pool';
import { MetricSample } from './azureMetricsClient';
import {
  TenantQuotaBurnProjection,
  getTenantQuotaBurnProjections,
} from './quotaBurnRatePredictor';

export interface PlatformDashboardSummary {
  throughputPostsSec: number;
  avgIngestionLagSec: number;
  errorRateLast24hPct: number;
  totalTokensLast30d: number;
  estimatedCostLast30dUsd: number;
  connectors: Array<{
    platformId: string;
    status: 'healthy' | 'degraded' | 'error' | 'disconnected';
    errorCountLast24h: number;
    lastSuccessAt: string | null;
  }>;
  timeSeries: Array<{
    timestamp: string;
    ingestionVolume: number;
    errorCount: number;
  }>;
  tenantQuotaBurnProjections: TenantQuotaBurnProjection[];
}

export interface PlatformMetricInsertInput {
  metric_name: string;
  granularity: 'hour' | 'day';
  timestamp: Date;
  value: number;
  unit: string;
  dimensions: Record<string, unknown>;
  source: string;
}

let cachedDashboard: { data: PlatformDashboardSummary; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export function resetPlatformDashboardCache(): void {
  cachedDashboard = null;
}

export async function recordPlatformMetric(input: PlatformMetricInsertInput): Promise<void> {
  const pool = getAdminPool();
  await pool.query(
    `INSERT INTO platform_metrics (metric_name, granularity, timestamp, value, unit, dimensions, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (metric_name, granularity, timestamp, source, dimensions)
     DO UPDATE SET value = EXCLUDED.value, unit = EXCLUDED.unit, created_at = now()`,
    [
      input.metric_name,
      input.granularity,
      input.timestamp.toISOString(),
      input.value,
      input.unit,
      JSON.stringify(input.dimensions),
      input.source,
    ]
  );
}

export async function recordMetricSamples(samples: MetricSample[]): Promise<void> {
  for (const sample of samples) {
    await recordPlatformMetric({
      metric_name: sample.metric_name,
      granularity: sample.granularity,
      timestamp: sample.timestamp,
      value: sample.value,
      unit: sample.unit,
      dimensions: sample.dimensions,
      source: sample.source,
    });
  }
}

export async function prunePlatformMetrics(): Promise<{ hourDeleted: number; dayDeleted: number }> {
  const pool = getAdminPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{
      hour_deleted: string;
      day_deleted: string;
    }>(
      `WITH deleted_hours AS (
         DELETE FROM platform_metrics
         WHERE granularity = 'hour' AND timestamp < now() - interval '7 days'
         RETURNING 1
       ),
       deleted_days AS (
         DELETE FROM platform_metrics
         WHERE granularity = 'day' AND timestamp < now() - interval '365 days'
         RETURNING 1
       )
       SELECT
         (SELECT count(*) FROM deleted_hours) AS hour_deleted,
         (SELECT count(*) FROM deleted_days) AS day_deleted`
    );
    return {
      hourDeleted: parseInt(rows[0]?.hour_deleted || '0', 10),
      dayDeleted: parseInt(rows[0]?.day_deleted || '0', 10),
    };
  } finally {
    client.release();
  }
}

export interface QueryPlatformMetricsFilters {
  metricName?: string;
  granularity?: string;
  from?: Date;
  to?: Date;
}

export interface AggregatedMetricRow {
  metric_name: string;
  granularity: string;
  unit: string;
  value: number;
  points: number;
}

export async function queryPlatformMetricsAggregated(
  filters: QueryPlatformMetricsFilters
): Promise<AggregatedMetricRow[]> {
  const pool = getAdminPool();
  const client = await pool.connect();
  try {
    const conditions: string[] = ["1 = 1"];
    const values: (string | number)[] = [];
    let paramIdx = 1;

    if (filters.metricName) {
      conditions.push(`metric_name = $${paramIdx++}`);
      values.push(filters.metricName);
    }
    if (filters.granularity) {
      conditions.push(`granularity = $${paramIdx++}`);
      values.push(filters.granularity);
    }
    if (filters.from) {
      conditions.push(`timestamp >= $${paramIdx++}`);
      values.push(filters.from.toISOString());
    }
    if (filters.to) {
      conditions.push(`timestamp < $${paramIdx++}`);
      values.push(filters.to.toISOString());
    }

    // Aggregation rules from ADR-0114: counts/costs are summed, percentages are averaged.
    const { rows } = await client.query<{
      metric_name: string;
      granularity: string;
      unit: string;
      value: number;
      points: number;
    }>(
      `SELECT
         metric_name,
         granularity,
         MAX(unit) AS unit,
         CASE WHEN MAX(unit) = 'percent' THEN round(avg(value), 4)::float
              ELSE round(sum(value), 4)::float
         END AS value,
         count(*)::int AS points
       FROM platform_metrics
       WHERE ${conditions.join(' AND ')}
       GROUP BY metric_name, granularity
       ORDER BY metric_name, granularity`,
      values
    );

    return rows;
  } finally {
    client.release();
  }
}

export async function getPlatformDashboardData(): Promise<PlatformDashboardSummary> {
  const now = Date.now();
  if (cachedDashboard && now - cachedDashboard.timestamp < CACHE_TTL_MS) {
    return cachedDashboard.data;
  }

  const adminPool = getAdminPool();
  const client = await adminPool.connect();
  try {
    // 1. Internal platform metrics for the last 24 hours.
    const { rows: metric24h } = await client.query<{
      hour: Date;
      posts: number;
      errors: number;
      runs: number;
    }>(
      `SELECT
         date_trunc('hour', timestamp) AS hour,
         COALESCE(SUM(value) FILTER (WHERE metric_name = 'posts_ingested'), 0) AS posts,
         COALESCE(SUM(value) FILTER (WHERE metric_name = 'ingestion_failures'), 0) AS errors,
         COALESCE(SUM(value) FILTER (WHERE metric_name = 'ingestion_runs'), 0) AS runs
       FROM platform_metrics
       WHERE granularity = 'hour'
         AND timestamp >= now() - interval '24 hours'
       GROUP BY 1
       ORDER BY 1 ASC`
    );

    const timeSeries = metric24h.map((r) => ({
      timestamp: r.hour.toISOString(),
      ingestionVolume: Number(r.posts) || 0,
      errorCount: Number(r.errors) || 0,
    }));

    const posts24h = timeSeries.reduce((sum, p) => sum + p.ingestionVolume, 0);
    const throughputPostsSec = parseFloat((posts24h / 86400).toFixed(4));

    const totalRuns24h = metric24h.reduce((sum, r) => sum + Number(r.runs), 0);
    const totalErrors24h = timeSeries.reduce((sum, p) => sum + p.errorCount, 0);
    const errorRateLast24hPct =
      totalRuns24h > 0 ? parseFloat(((totalErrors24h / totalRuns24h) * 100).toFixed(2)) : 0;

    // 2. Connector status rollup (kept from Story 10.6; ADR-0114 only changes the data source, not the shape).
    const { rows: activations } = await client.query<{
      platform_id: string;
      is_active: boolean;
    }>(`SELECT DISTINCT platform_id, is_active FROM connector_activations`);

    const knownPlatforms = ['gnews', 'newswire', 'wikipedia', 'facebook', 'azure-ai-language', 'azure-openai'];
    const connectors = knownPlatforms.map((p) => {
      const match = activations.find((a) => a.platform_id === p);
      return {
        platformId: p,
        status: (match?.is_active ? 'healthy' : 'disconnected') as any,
        errorCountLast24h: 0,
        lastSuccessAt: new Date().toISOString(),
      };
    });

    // 3. 30-day token/cost estimate. Prefer Azure cost metric when present, otherwise fall back to the
    //    estimate the platform dashboard has used since Story 10.6.
    const appPool = getPool();
    const appClient = await appPool.connect();
    let posts30d: number;
    try {
      const { rows: postStats } = await appClient.query<{ count_30d: string }>(
        `SELECT COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') AS count_30d FROM social_posts`
      );
      posts30d = parseInt(postStats[0]?.count_30d || '0', 10);
    } finally {
      appClient.release();
    }

    const { rows: costRows } = await client.query<{ cost: number }>(
      `SELECT COALESCE(SUM(value), 0) AS cost
       FROM platform_metrics
       WHERE metric_name = 'estimated_total_cost'
         AND unit = 'usd'
         AND granularity = 'day'
         AND timestamp >= now() - interval '30 days'`
    );
    const costFromMetrics = Number(costRows[0]?.cost) || null;

    const totalTokensLast30d = posts30d * 850; // avg ~850 tokens per enriched post
    const estimatedCostFromTokens = parseFloat(((totalTokensLast30d / 1000) * 0.0015).toFixed(2));
    const estimatedCostLast30dUsd = costFromMetrics ?? estimatedCostFromTokens;

    const tenantQuotaBurnProjections = await getTenantQuotaBurnProjections();

    const summary: PlatformDashboardSummary = {
      throughputPostsSec,
      avgIngestionLagSec: 4.2,
      errorRateLast24hPct,
      totalTokensLast30d,
      estimatedCostLast30dUsd,
      connectors,
      timeSeries,
      tenantQuotaBurnProjections,
    };

    cachedDashboard = { data: summary, timestamp: now };
    return summary;
  } finally {
    client.release();
  }
}
