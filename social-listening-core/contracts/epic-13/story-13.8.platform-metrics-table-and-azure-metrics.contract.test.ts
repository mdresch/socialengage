/**
 * Contract: Story 13.8 (ADR-0114, BRD-0114, FDD-0114) — Platform metrics table
 * and Azure Metrics integration.
 * See docs/user-stories/epic-13-adr-0109-to-0117.md#story-138
 *
 * Intent:
 *   Add a global, tenant-content-free `platform_metrics` table with `hour` and
 *   `day` granularity, an hourly `PlatformMetricsWorker` that derives internal
 *   ingestion counters and pulls Azure Monitor / Cost Management telemetry
 *   through a swappable provider, retention pruning, and admin REST endpoints
 *   that read from `platform_metrics` instead of live Azure APIs.
 *
 * Scope:
 *   - social-listening-core/migrations/0068_align_platform_metrics_granularity_and_indexes.sql
 *   - social-listening-core/src/platform/platformMetricsStore.ts (update)
 *   - social-listening-core/src/platform/azureMetricsClient.ts (new)
 *   - social-listening-core/src/platform/platformMetricsWorker.ts (new)
 *   - social-listening-core/src/http/versions/v1/platformDashboardRouter.ts (update)
 *   - social-listening-core/src/http/versions/v1/adminPlatformMetricsRouter.ts (new)
 *   - social-listening-core/src/http/versions/v1/router.ts
 *   - social-listening-core/src/http/server.ts
 *   - social-listening-core/.claude/skills/platform-metrics/SKILL.md
 *
 * Contract to encode:
 *   (1) `platform_metrics` exists with the columns ADR-0114 requires and the
 *       `hour`/`day` granularity values used by this story; `dimensions` never
 *       stores tenant post content, watchlist queries, or user PII.
 *   (2) `runPlatformMetricsWorker()` writes `posts_ingested`, `ingestion_runs`,
 *       and `connector_health_changed` counters derived from `ingestion_runs`.
 *   (3) `runPlatformMetricsWorker()` calls the live Azure metrics provider and
 *       writes `estimated_total_cost`, `container_cpu`, `container_memory`,
 *       `servicebus_active_messages`, `dead_letter_messages`, and
 *       `blob_storage_bytes` at `hour` granularity with `source='azure_metrics'`.
 *   (4) `GET /v1/admin/platform-dashboard` returns time-series and summary data
 *       sourced from `platform_metrics`.
 *   (5) `GET /v1/admin/platform-metrics` is gated to `platform_admin` and returns
 *       aggregated metric rows for a time window and granularity.
 *   (6) `prunePlatformMetrics()` deletes `hour` rows older than 7 days and `day`
 *       rows older than 365 days while keeping newer rows.
 *
 * Explicitly out of scope:
 *   - Full, live Azure Monitor / Cost Management API implementation; the live
 *     provider is wired but requires Azure env vars and is exercised here through
 *     a test double.
 *   - A tenant-filtered metrics view for `Tenant-Admin` (reserved by ADR-0114).
 *   - Archiving deleted rows to Blob (ADR-0114 mentions it as a future option).
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closePool, getPool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { prunePlatformMetrics, recordPlatformMetric, resetPlatformDashboardCache } from '../../src/platform/platformMetricsStore';
import { runPlatformMetricsWorker } from '../../src/platform/platformMetricsWorker';
import { setAzureMetricsProvider, MetricSample, AzureMetricsProvider } from '../../src/platform/azureMetricsClient';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

function platformAdminHeader(adminId?: string): string {
  return JSON.stringify({ type: 'platform_admin', adminId: adminId ?? randomUUID() });
}

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

async function seedIngestionRuns(tenantId: string, when: Date) {
  return withTenant(tenantId, async (client) => {
    await client.query(
      `INSERT INTO ingestion_runs
         (tenant_id, platform_id, trigger_type, connector_version, status, started_at, completed_at, posts_ingested, posts_skipped)
       VALUES
         ($1, 'gnews', 'poll', '1.0.0', 'succeeded', $2, $2, 5, 0),
         ($1, 'newswire', 'poll', '1.0.0', 'failed', $2, $2, 0, 0)`,
      [tenantId, when.toISOString()]
    );
  });
}

async function seedHourMetric(sample: Partial<MetricSample> & { metric_name: string; value: number; timestamp: Date }) {
  await recordPlatformMetric({
    metric_name: sample.metric_name,
    granularity: 'hour',
    timestamp: sample.timestamp,
    value: sample.value,
    unit: sample.unit ?? 'count',
    dimensions: sample.dimensions ?? {},
    source: sample.source ?? 'internal',
  });
}

async function dbNow(): Promise<Date> {
  const { rows } = await getAdminPool().query<{ n: Date }>('SELECT now() AS n');
  return new Date(rows[0].n);
}

async function seedDayMetric(sample: Partial<MetricSample> & { metric_name: string; value: number; timestamp: Date }) {
  await recordPlatformMetric({
    metric_name: sample.metric_name,
    granularity: 'day',
    timestamp: sample.timestamp,
    value: sample.value,
    unit: sample.unit ?? 'count',
    dimensions: sample.dimensions ?? {},
    source: sample.source ?? 'internal',
  });
}

describe('Story 13.8 — Platform metrics table and Azure Metrics', () => {
  const app = createApp();

  it('AC1: platform_metrics table supports ADR-0114 columns and hour/day granularity and never stores tenant content', async () => {
    const tenant = await createTenantFixture(`T-13.8-schema-${randomUUID()}`);
    const pool = getAdminPool();

    const columns = await pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'platform_metrics' AND table_schema = 'public'
       ORDER BY column_name`
    );
    const names = columns.rows.map((r) => r.column_name);
    expect(names).toEqual(
      expect.arrayContaining([
        'id',
        'metric_name',
        'granularity',
        'timestamp',
        'value',
        'unit',
        'dimensions',
        'source',
        'created_at',
      ])
    );

    await pool.query(
      `INSERT INTO platform_metrics
         (metric_name, granularity, timestamp, value, unit, dimensions, source)
       VALUES ($1, 'hour', now(), 1.0, 'count', $2, 'internal')`,
      ['ingestion_runs', JSON.stringify({ platform_id: 'gnews' })]
    );

    await pool.query(
      `INSERT INTO platform_metrics
         (metric_name, granularity, timestamp, value, unit, dimensions, source)
       VALUES ($1, 'day', now(), 1.0, 'count', $2, 'internal')`,
      ['posts_ingested', JSON.stringify({ platform_id: 'newswire' })]
    );

    const { rows } = await pool.query<{ dimensions: Record<string, unknown> }>(
      `SELECT dimensions FROM platform_metrics WHERE metric_name = 'ingestion_runs' AND granularity = 'hour'`,
      []
    );
    expect(rows.length).toBe(1);
    expect(rows[0].dimensions).not.toHaveProperty('body');
    expect(rows[0].dimensions).not.toHaveProperty('query');
    expect(rows[0].dimensions).not.toHaveProperty('email');

    const pii = await pool.query(
      `SELECT 1 FROM platform_metrics
       WHERE dimensions::text ILIKE '%post body%'
          OR dimensions::text ILIKE '%watchlist%'
          OR dimensions::text ILIKE '%@%.com%'`
    );
    expect(pii.rows.length).toBe(0);

    expect(tenant.id).toBeDefined();
  });

  it('AC2: the hourly worker writes internal ingestion counters from ingestion_runs', async () => {
    const tenant = await createTenantFixture(`T-13.8-internal-${randomUUID()}`);
    const admin = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com`, role: 'tenant_admin' });

    // Seed a run in the previous completed hour so the worker includes it.
    const now = await dbNow();
    const previousHour = new Date(now);
    previousHour.setMinutes(0, 0, 0);
    previousHour.setHours(previousHour.getHours() - 1);
    const runAt = new Date(previousHour.getTime() + 5 * 60 * 1000);
    await seedIngestionRuns(tenant.id, runAt);

    // Reset provider to the default (no Azure metrics) so only internal counters run.
    setAzureMetricsProvider({
      fetchMetrics: async () => [],
    });

    await runPlatformMetricsWorker();

    const pool = getAdminPool();
    const { rows } = await pool.query<{
      metric_name: string;
      value: number;
      dimensions: Record<string, unknown>;
    }>(
      `SELECT metric_name, value::float AS value, dimensions
       FROM platform_metrics
       WHERE source = 'internal' AND granularity = 'hour'
         AND timestamp >= date_trunc('hour', $1::timestamptz)
         AND timestamp < date_trunc('hour', $1::timestamptz) + interval '1 hour'`,
      [previousHour.toISOString()]
    );

    const byName = Object.fromEntries(rows.map((r) => [r.metric_name, r]));
    expect(byName['posts_ingested']).toBeDefined();
    expect(byName['ingestion_runs']).toBeDefined();
    expect(byName['connector_health_changed']).toBeDefined();

    expect(byName['posts_ingested'].value).toBe(5);
    expect(byName['ingestion_runs'].value).toBe(2);
    expect(byName['connector_health_changed'].value).toBeGreaterThanOrEqual(1);

    for (const r of rows) {
      expect(r.dimensions).not.toHaveProperty('body');
      expect(r.dimensions).not.toHaveProperty('query');
      expect(r.dimensions).not.toHaveProperty('email');
    }

    expect(admin.id).toBeDefined();
  });

  it('AC3: the hourly worker calls the Azure metrics provider and writes Azure-sourced samples', async () => {
    const now = await dbNow();
    const previousHour = new Date(now);
    previousHour.setMinutes(0, 0, 0);
    previousHour.setHours(previousHour.getHours() - 1);
    const azureSamples: MetricSample[] = [
      { metric_name: 'estimated_total_cost', value: 12.34, unit: 'usd', dimensions: { resource_group: 'rg-01' }, source: 'azure_metrics' },
      { metric_name: 'container_cpu', value: 45.2, unit: 'percent', dimensions: { container: 'app' }, source: 'azure_metrics' },
      { metric_name: 'container_memory', value: 62.1, unit: 'percent', dimensions: { container: 'app' }, source: 'azure_metrics' },
      { metric_name: 'servicebus_active_messages', value: 3, unit: 'count', dimensions: { namespace: 'bus' }, source: 'azure_metrics' },
      { metric_name: 'dead_letter_messages', value: 0, unit: 'count', dimensions: { namespace: 'bus' }, source: 'azure_metrics' },
      { metric_name: 'blob_storage_bytes', value: 1_024_000, unit: 'bytes', dimensions: { account: 'store' }, source: 'azure_metrics' },
    ].map((s) => ({ ...s, timestamp: previousHour, granularity: 'hour' as const }));

    const testProvider: AzureMetricsProvider = {
      fetchMetrics: async () => azureSamples,
    };
    setAzureMetricsProvider(testProvider);

    await runPlatformMetricsWorker();

    const pool = getAdminPool();
    const { rows } = await pool.query<{ metric_name: string; value: number }>(
      `SELECT metric_name, value::float AS value
       FROM platform_metrics
       WHERE source = 'azure_metrics' AND granularity = 'hour'
         AND timestamp >= date_trunc('hour', $1::timestamptz)
         AND timestamp < date_trunc('hour', $1::timestamptz) + interval '1 hour'`,
      [previousHour.toISOString()]
    );

    const byName = Object.fromEntries(rows.map((r) => [r.metric_name, r.value]));
    expect(byName['estimated_total_cost']).toBe(12.34);
    expect(byName['container_cpu']).toBe(45.2);
    expect(byName['container_memory']).toBe(62.1);
    expect(byName['servicebus_active_messages']).toBe(3);
    expect(byName['dead_letter_messages']).toBe(0);
    expect(byName['blob_storage_bytes']).toBe(1_024_000);
  });

  it('AC4: GET /v1/admin/platform-dashboard reads time-series from platform_metrics', async () => {
    const tenant = await createTenantFixture(`T-13.8-dash-${randomUUID()}`);
    const admin = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com`, role: 'tenant_admin' });

    resetPlatformDashboardCache();

    // Seed an hour bucket within the last 24 hours.
    const dbNowValue = await dbNow();
    const recent = new Date(dbNowValue);
    recent.setMinutes(0, 0, 0);
    recent.setHours(recent.getHours() - 2);
    await seedHourMetric({
      metric_name: 'posts_ingested',
      value: 42,
      timestamp: recent,
      unit: 'count',
      source: 'internal',
    });
    await seedHourMetric({
      metric_name: 'ingestion_runs',
      value: 5,
      timestamp: recent,
      unit: 'count',
      source: 'internal',
    });
    await seedHourMetric({
      metric_name: 'ingestion_runs',
      value: 2,
      timestamp: recent,
      unit: 'count',
      source: 'internal',
      dimensions: { status: 'failed' },
    });

    const res = await request(app)
      .get('/v1/admin/platform-dashboard')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'tenant_admin' }));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      throughputPostsSec: expect.any(Number),
      avgIngestionLagSec: expect.any(Number),
      errorRateLast24hPct: expect.any(Number),
      totalTokensLast30d: expect.any(Number),
      estimatedCostLast30dUsd: expect.any(Number),
      connectors: expect.any(Array),
      timeSeries: expect.any(Array),
    });

    const point = res.body.timeSeries.find(
      (p: { timestamp: string }) => new Date(p.timestamp).getTime() === recent.getTime()
    );
    expect(point).toBeDefined();
    expect(point.ingestionVolume).toBeGreaterThanOrEqual(42);
  });

  it('AC5: GET /v1/admin/platform-metrics is platform_admin gated and supports aggregation', async () => {
    const tenant = await createTenantFixture(`T-13.8-admin-${randomUUID()}`);
    const admin = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com`, role: 'tenant_admin' });
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com`, role: 'tenant_user' });

    const dbNowValue = await dbNow();
    const recent = new Date(dbNowValue);
    recent.setMinutes(0, 0, 0);
    recent.setHours(recent.getHours() - 2);
    await seedHourMetric({ metric_name: 'posts_ingested', value: 10, timestamp: recent, source: 'internal' });
    await seedHourMetric({ metric_name: 'posts_ingested', value: 32, timestamp: new Date(recent.getTime() + 60 * 60 * 1000), source: 'internal' });

    const unauthorized = await request(app)
      .get('/v1/admin/platform-metrics?metricName=posts_ingested&granularity=hour')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));
    expect(unauthorized.status).toBe(403);

    const unauthorizedAdmin = await request(app)
      .get('/v1/admin/platform-metrics?metricName=posts_ingested&granularity=hour')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'tenant_admin' }));
    expect(unauthorizedAdmin.status).toBe(403);

    const res = await request(app)
      .get('/v1/admin/platform-metrics?metricName=posts_ingested&granularity=hour')
      .set('X-Test-Identity', platformAdminHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.metrics)).toBe(true);
    const point = res.body.metrics.find(
      (m: { metric_name: string; value: number }) => m.metric_name === 'posts_ingested'
    );
    expect(point).toBeDefined();
    expect(point.value).toBe(42);
  });

  it('AC6: prunePlatformMetrics enforces 7-day hourly / 365-day daily retention', async () => {
    const now = new Date();
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const threeHundredSixtySixDaysAgo = new Date(now.getTime() - 366 * 24 * 60 * 60 * 1000);
    const threeHundredSixtyDaysAgo = new Date(now.getTime() - 360 * 24 * 60 * 60 * 1000);

    await seedHourMetric({ metric_name: 'retention_test_hour', value: 1, timestamp: eightDaysAgo, source: 'internal' });
    await seedHourMetric({ metric_name: 'retention_test_hour', value: 2, timestamp: sixDaysAgo, source: 'internal' });
    await seedDayMetric({ metric_name: 'retention_test_day', value: 3, timestamp: threeHundredSixtySixDaysAgo, source: 'internal' });
    await seedDayMetric({ metric_name: 'retention_test_day', value: 4, timestamp: threeHundredSixtyDaysAgo, source: 'internal' });

    const result = await prunePlatformMetrics();

    const pool = getAdminPool();
    const hourRows = await pool.query(
      `SELECT 1 FROM platform_metrics
       WHERE metric_name = 'retention_test_hour' AND granularity = 'hour' AND timestamp < now() - interval '7 days'`
    );
    const dayRows = await pool.query(
      `SELECT 1 FROM platform_metrics
       WHERE metric_name = 'retention_test_day' AND granularity = 'day' AND timestamp < now() - interval '365 days'`
    );
    const recentHour = await pool.query(
      `SELECT 1 FROM platform_metrics
       WHERE metric_name = 'retention_test_hour' AND granularity = 'hour' AND timestamp >= now() - interval '7 days'`
    );
    const recentDay = await pool.query(
      `SELECT 1 FROM platform_metrics
       WHERE metric_name = 'retention_test_day' AND granularity = 'day' AND timestamp >= now() - interval '365 days'`
    );

    expect(hourRows.rows.length).toBe(0);
    expect(dayRows.rows.length).toBe(0);
    expect(recentHour.rows.length).toBe(1);
    expect(recentDay.rows.length).toBe(1);

    expect(result).toMatchObject({
      hourDeleted: expect.any(Number),
      dayDeleted: expect.any(Number),
    });
  });
});
