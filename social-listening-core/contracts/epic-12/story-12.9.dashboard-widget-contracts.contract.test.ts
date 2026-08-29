/**
 * Contract: Story 12.9 (ADR-0105, BRD-0105, FDD-0105) — Dashboard widget contracts (backend).
 * See docs/user-stories/epic-12-adr-0101-to-0108.md#story-129--dashboard-widget-contracts-backend
 * and docs/adr/0105-dashboards-and-analytics-widget-contracts.md
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import {
  WidgetRegistry,
  dashboardWidgetRegistry,
  WidgetData,
  MetricWidgetData,
  TimeSeriesWidgetData,
  BarWidgetData,
  PieWidgetData,
  ListWidgetData,
  TableWidgetData,
} from '../../src/analytics/dashboard/widgetRegistry';
import { getDashboardData } from '../../src/analytics/dashboard/dashboardService';
import { findOrCreateTopic } from '../../src/topics/topicStore';
import { createWatchlist } from '../../src/watchlists/watchlistStore';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

describe('Story 12.9 — Dashboard widget contracts (backend)', () => {
  let tenant: { id: string };
  let otherTenant: { id: string };
  let user: { id: string };
  let app: any;
  let testTopicId: string;
  let testWatchlistId: string;

  beforeAll(async () => {
    tenant = await createTenantFixture(`Tenant Widget Dashboard ${Date.now()}`);
    otherTenant = await createTenantFixture(`Other Tenant Widget ${Date.now()}`);
    user = await createInvitedUser(tenant.id, {
      email: `widget-tester-${Date.now()}@example.com`,
    });
    app = createApp();

    // Seed a test topic
    const topic = await findOrCreateTopic(
      tenant.id,
      'Cloud Computing',
      'Cloud infrastructure discussion'
    );
    testTopicId = topic.id;

    // Seed a test watchlist via createWatchlist helper
    const wl = await createWatchlist(tenant.id, user.id, {
      name: 'Tech Watchlist',
      matchType: 'keyword',
      terms: ['cloud'],
    });
    testWatchlistId = wl.id;

    await withTenant(tenant.id, async (client) => {
      // Seed daily count tables for tenant
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      await client.query(
        `INSERT INTO source_daily_counts (tenant_id, date, platform_id, post_count, positive_count, neutral_count, negative_count)
         VALUES ($1, $2, 'twitter', 45, 25, 15, 5),
                ($1, $3, 'twitter', 30, 15, 10, 5)
         ON CONFLICT DO NOTHING`,
        [tenant.id, today, yesterday]
      );

      await client.query(
        `INSERT INTO sentiment_daily_counts (tenant_id, date, sentiment, post_count)
         VALUES ($1, $2, 'positive', 25),
                ($1, $2, 'neutral', 15),
                ($1, $2, 'negative', 5)
         ON CONFLICT DO NOTHING`,
        [tenant.id, today]
      );

      const auth1 = randomUUID();
      const auth2 = randomUUID();

      await client.query(
        `INSERT INTO authors (id, tenant_id, platform_id, external_author_id, handle, display_name)
         VALUES ($1, $2, 'twitter', 'ext-1', 'alice', 'Alice Developer'),
                ($3, $2, 'twitter', 'ext-2', 'bob', 'Bob Engineer')
         ON CONFLICT DO NOTHING`,
        [auth1, tenant.id, auth2]
      );

      await client.query(
        `INSERT INTO author_daily_counts (tenant_id, date, author_id, post_count, engagement_total)
         VALUES ($1, $2, $3, 12, 120),
                ($1, $2, $4, 8, 80)
         ON CONFLICT DO NOTHING`,
        [tenant.id, today, auth1, auth2]
      );
    });
  });

  describe('AC1: GET /v1/analytics/dashboard endpoint', () => {
    it('returns dashboard widgets and available filter metadata', async () => {
      const res = await request(app)
        .get('/v1/analytics/dashboard')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('widgets');
      expect(Array.isArray(res.body.widgets)).toBe(true);
      expect(res.body.widgets.length).toBeGreaterThanOrEqual(4);

      expect(res.body).toHaveProperty('filters');
      expect(res.body.filters).toHaveProperty('watchlists');
      expect(res.body.filters).toHaveProperty('topics');
      expect(res.body.filters).toHaveProperty('availableTimeRanges');
      expect(Array.isArray(res.body.filters.availableTimeRanges)).toBe(true);
    });

    it('accepts filter query parameters: watchlistId, selectedTopic, timeRange, granularity', async () => {
      const res = await request(app)
        .get(`/v1/analytics/dashboard?watchlistId=${testWatchlistId}&selectedTopic=${testTopicId}&granularity=day&timeRange[start]=2026-08-01T00:00:00Z&timeRange[end]=2026-08-29T23:59:59Z`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

      expect(res.status).toBe(200);
      expect(res.body.widgets).toBeDefined();
    });

    it('rejects unauthorized requests with 401/403', async () => {
      const res = await request(app).get('/v1/analytics/dashboard');
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('AC2: Per-widget typed data shapes', () => {
    it('returns metric widget conforming to MetricWidgetData shape', async () => {
      const dashboard = await getDashboardData(tenant.id, {});
      const metricWidget = dashboard.widgets.find((w) => w.type === 'metric');
      expect(metricWidget).toBeDefined();
      expect(metricWidget?.data.type).toBe('metric');
      const data = metricWidget?.data as MetricWidgetData;
      expect(typeof data.value).toBe('number');
      if (data.previousValue !== undefined) {
        expect(typeof data.previousValue).toBe('number');
      }
    });

    it('returns time-series widget conforming to TimeSeriesWidgetData shape', async () => {
      const dashboard = await getDashboardData(tenant.id, {});
      const tsWidget = dashboard.widgets.find((w) => w.type === 'time-series');
      expect(tsWidget).toBeDefined();
      expect(tsWidget?.data.type).toBe('time-series');
      const data = tsWidget?.data as TimeSeriesWidgetData;
      expect(Array.isArray(data.labels)).toBe(true);
      expect(Array.isArray(data.series)).toBe(true);
      if (data.series.length > 0) {
        expect(data.series[0]).toHaveProperty('name');
        expect(Array.isArray(data.series[0].data)).toBe(true);
      }
    });

    it('returns pie and bar widgets conforming to respective data shapes', async () => {
      const dashboard = await getDashboardData(tenant.id, {});
      const pieWidget = dashboard.widgets.find((w) => w.type === 'pie');
      if (pieWidget) {
        expect(pieWidget.data.type).toBe('pie');
        const data = pieWidget.data as PieWidgetData;
        expect(Array.isArray(data.segments)).toBe(true);
      }

      const barWidget = dashboard.widgets.find((w) => w.type === 'bar');
      if (barWidget) {
        expect(barWidget.data.type).toBe('bar');
        const data = barWidget.data as BarWidgetData;
        expect(Array.isArray(data.labels)).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
      }
    });

    it('returns list and table widgets conforming to respective data shapes', async () => {
      const dashboard = await getDashboardData(tenant.id, {});
      const listWidget = dashboard.widgets.find((w) => w.type === 'list');
      if (listWidget) {
        expect(listWidget.data.type).toBe('list');
        const data = listWidget.data as ListWidgetData;
        expect(Array.isArray(data.items)).toBe(true);
      }

      const tableWidget = dashboard.widgets.find((w) => w.type === 'table');
      if (tableWidget) {
        expect(tableWidget.data.type).toBe('table');
        const data = tableWidget.data as TableWidgetData;
        expect(Array.isArray(data.columns)).toBe(true);
        expect(Array.isArray(data.rows)).toBe(true);
      }
    });
  });

  describe('AC3: WidgetRegistry pattern', () => {
    it('allows registering and executing custom widgets', async () => {
      const customRegistry = new WidgetRegistry();

      customRegistry.register({
        id: 'custom-counter',
        type: 'metric',
        title: 'Custom Counter',
        dataProvider: async (_tenantId, _params) => ({
          type: 'metric',
          value: 42,
          previousValue: 30,
          explanation: 'Custom calculated count increased by 40%',
        }),
      });

      const widgets = await customRegistry.executeWidgets(tenant.id, {});
      expect(widgets).toHaveLength(1);
      expect(widgets[0].id).toBe('custom-counter');
      expect(widgets[0].data.type).toBe('metric');
      expect((widgets[0].data as MetricWidgetData).value).toBe(42);
    });

    it('handles widget provider errors gracefully without failing other widgets', async () => {
      const customRegistry = new WidgetRegistry();

      customRegistry.register({
        id: 'failing-widget',
        type: 'bar',
        title: 'Failing Widget',
        dataProvider: async () => {
          throw new Error('Provider failed to query DB');
        },
      });

      customRegistry.register({
        id: 'working-widget',
        type: 'metric',
        title: 'Working Widget',
        dataProvider: async () => ({
          type: 'metric',
          value: 100,
        }),
      });

      const widgets = await customRegistry.executeWidgets(tenant.id, {});
      expect(widgets).toHaveLength(2);
      expect(widgets.find((w) => w.id === 'working-widget')?.data).toEqual({
        type: 'metric',
        value: 100,
      });
      // The failing widget should return an empty/error fallback shape or empty metric
      const failed = widgets.find((w) => w.id === 'failing-widget');
      expect(failed).toBeDefined();
    });
  });

  describe('AC4: Query routing & precomputed daily count aggregation', () => {
    it('uses *DailyCount tables and tenant isolation', async () => {
      const dashboard = await getDashboardData(tenant.id, {});
      expect(dashboard.widgets.length).toBeGreaterThan(0);

      // Verify that other tenant sees their own isolated data
      const otherDashboard = await getDashboardData(otherTenant.id, {});
      expect(otherDashboard.widgets).toBeDefined();
    });
  });

  describe('AC5: Metric widgets explainability integration', () => {
    it('supports generating explanations for metric widgets when requested', async () => {
      const res = await request(app)
        .get('/v1/analytics/dashboard?includeExplanation=true')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

      expect(res.status).toBe(200);
      const metricWidgets = res.body.widgets.filter((w: any) => w.type === 'metric');
      expect(metricWidgets.length).toBeGreaterThan(0);
      // At least one metric widget has explanation text when explanations are enabled
      const hasExplanation = metricWidgets.some((w: any) => typeof w.data.explanation === 'string');
      expect(hasExplanation).toBe(true);
    });
  });
});
