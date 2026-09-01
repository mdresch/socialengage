/**
 * Story 13.8 (ADR-0114): Hourly worker that writes internal ingestion counters
 * and Azure-sourced metrics to `platform_metrics`.
 */

import { getAdminPool } from '../db/adminPool';
import { fetchAzureMetrics, MetricSample } from './azureMetricsClient';
import { recordPlatformMetric, prunePlatformMetrics } from './platformMetricsStore';

let workerTimer: NodeJS.Timeout | null = null;

function previousHourBoundary(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() - 1);
  return d;
}

function nextHourBoundary(hour: Date): Date {
  return new Date(hour.getTime() + 60 * 60 * 1000);
}

export async function runPlatformMetricsWorker(): Promise<void> {
  const hour = previousHourBoundary();
  const nextHour = nextHourBoundary(hour);

  const pool = getAdminPool();
  const client = await pool.connect();
  try {
    // Internal counters for the previous hour. `ingestion_runs` is the source;
    // `platform_metrics` is a derived, time-bucketed roll-up for fast dashboard reads.
    const { rows: internalRows } = await client.query<{
      posts_ingested: number;
      ingestion_runs: number;
      ingestion_failures: number;
      connector_health_changed: number;
    }>(
      `SELECT
         COALESCE(SUM(posts_ingested), 0) AS posts_ingested,
         COUNT(*) AS ingestion_runs,
         COUNT(*) FILTER (WHERE status = 'failed') AS ingestion_failures,
         COUNT(DISTINCT platform_id) FILTER (WHERE status = 'failed') AS connector_health_changed
       FROM ingestion_runs
       WHERE started_at >= $1 AND started_at < $2 AND status != 'running'`,
      [hour.toISOString(), nextHour.toISOString()]
    );

    const row = internalRows[0] || {
      posts_ingested: 0,
      ingestion_runs: 0,
      ingestion_failures: 0,
      connector_health_changed: 0,
    };

    const internalMetrics: MetricSample[] = [
      {
        metric_name: 'posts_ingested',
        value: Number(row.posts_ingested),
        unit: 'count',
        dimensions: {},
        source: 'internal',
        timestamp: hour,
        granularity: 'hour',
      },
      {
        metric_name: 'ingestion_runs',
        value: Number(row.ingestion_runs),
        unit: 'count',
        dimensions: {},
        source: 'internal',
        timestamp: hour,
        granularity: 'hour',
      },
      {
        metric_name: 'ingestion_failures',
        value: Number(row.ingestion_failures),
        unit: 'count',
        dimensions: {},
        source: 'internal',
        timestamp: hour,
        granularity: 'hour',
      },
      {
        metric_name: 'connector_health_changed',
        value: Number(row.connector_health_changed),
        unit: 'count',
        dimensions: {},
        source: 'internal',
        timestamp: hour,
        granularity: 'hour',
      },
    ];

    for (const metric of internalMetrics) {
      await recordPlatformMetric(metric);
    }

    // Azure Monitor / Cost Management metrics for the same hour.
    const azureSamples = await fetchAzureMetrics(hour);
    for (const sample of azureSamples) {
      await recordPlatformMetric({
        metric_name: sample.metric_name,
        granularity: 'hour',
        timestamp: sample.timestamp,
        value: sample.value,
        unit: sample.unit,
        dimensions: sample.dimensions,
        source: sample.source,
      });
    }

    await prunePlatformMetrics();
  } finally {
    client.release();
  }
}

export function startPlatformMetricsWorker(): void {
  if (workerTimer !== null) return;

  console.log('[platformMetricsWorker] Starting hourly refresh cycle');

  // Run once immediately on startup so the dashboard has data as soon as the scheduler starts.
  runPlatformMetricsWorker().catch((err) => {
    console.error('[platformMetricsWorker] Initial run failed:', err);
  });

  workerTimer = setInterval(() => {
    runPlatformMetricsWorker().catch((err) => {
      console.error('[platformMetricsWorker] Scheduled run failed:', err);
    });
  }, 60 * 60 * 1000);
}

export function stopPlatformMetricsWorker(): void {
  if (workerTimer !== null) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
