// Contract: Story 15.1 (ADR-0123, BRD-0123, FDD-0123, TDS-0123) — Alert Rules Refinements (Backend)
// Real-time alert rule exclusions, rolling daily caps, sensitivity presets, and pre-save volume preview

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool, getPool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { createWatchlist } from '../../src/watchlists/watchlistStore';
import { triggerAlert, getAlertRule } from '../../src/alerts/alertRulesStore';
import { evaluateRuleForPost, simulateAlertRulePreview } from '../../src/alerts/alertEvaluationWorker';

jest.setTimeout(30000);

afterAll(async () => {
  await closeAdminPool();
  await closePlatformAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

async function createWatchlistFixture(tenantId: string, userId: string, name: string): Promise<string> {
  const wl = await createWatchlist(tenantId, userId, {
    name,
    matchType: 'keyword',
    platformIds: ['facebook'],
  });
  return wl.id;
}

describe('Story 15.1 — Real-Time Alert Rule Exclusions, Caps, and Preview Contract', () => {
  const app = createApp();

  describe('AC1: Schema & CRUD for Noise Exclusions and Rolling Daily Cap', () => {
    it('creates and retrieves alert rules with exclusions and max_alerts_per_day with defaults', async () => {
      const tenant = await createTenantFixture(`T-15.1-crud-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });
      const wlExcluded1 = await createWatchlistFixture(tenant.id, user.id, 'Competitor Spam');

      // 1. Create rule with explicit refinements
      const createRes = await request(app)
        .post('/v1/alerts/rules')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          name: 'High Volume Brand Outcry',
          type: 'volume_spike',
          thresholds: { min_posts: 100, window_minutes: 15 },
          cooldown_minutes: 30,
          excluded_watchlist_ids: [wlExcluded1],
          excluded_topic_ids: ['internal_announcement', 'scheduled_blast'],
          max_alerts_per_day: 15,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body).toMatchObject({
        id: expect.any(String),
        name: 'High Volume Brand Outcry',
        type: 'volume_spike',
        cooldown_minutes: 30,
        max_alerts_per_day: 15,
        excluded_watchlist_ids: [wlExcluded1],
        excluded_topic_ids: ['internal_announcement', 'scheduled_blast'],
      });

      const ruleId = createRes.body.id;

      // 2. Create rule with omitted refinements -> defaults apply ([], [], 20)
      const defaultRes = await request(app)
        .post('/v1/alerts/rules')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          name: 'Default Safeguards Rule',
          type: 'negative_sentiment_spike',
          thresholds: { spike_pct: 50 },
        });

      expect(defaultRes.status).toBe(201);
      expect(defaultRes.body.max_alerts_per_day).toBe(20);
      expect(defaultRes.body.excluded_watchlist_ids).toEqual([]);
      expect(defaultRes.body.excluded_topic_ids).toEqual([]);

      // 3. Update rule refinements
      const updateRes = await request(app)
        .patch(`/v1/alerts/rules/${ruleId}`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          max_alerts_per_day: 25,
          excluded_topic_ids: ['internal_announcement'],
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.max_alerts_per_day).toBe(25);
      expect(updateRes.body.excluded_topic_ids).toEqual(['internal_announcement']);

      // 4. Validate max_alerts_per_day bounds (1 to 500)
      const invalidCapRes = await request(app)
        .post('/v1/alerts/rules')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          name: 'Invalid Cap',
          type: 'volume_spike',
          max_alerts_per_day: 0,
        });
      expect(invalidCapRes.status).toBe(400);

      const excessCapRes = await request(app)
        .post('/v1/alerts/rules')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          name: 'Excess Cap',
          type: 'volume_spike',
          max_alerts_per_day: 600,
        });
      expect(excessCapRes.status).toBe(400);
    });
  });

  describe('AC2: Noise Exclusion Invariant & Independent Evaluation', () => {
    it('evaluates watchlist and topic exclusions independently and suppresses alerts without database writes', async () => {
      const tenant = await createTenantFixture(`T-15.1-excl-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });
      const wlExcluded = await createWatchlistFixture(tenant.id, user.id, 'Excluded WL');
      const wlNormal = await createWatchlistFixture(tenant.id, user.id, 'Normal WL');

      // Rule A: Watchlist-only exclusion
      const ruleARes = await request(app)
        .post('/v1/alerts/rules')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          name: 'Watchlist Excluded Rule',
          type: 'volume_spike',
          excluded_watchlist_ids: [wlExcluded],
          excluded_topic_ids: [],
          max_alerts_per_day: 20,
        });
      const ruleA = ruleARes.body;

      // Rule B: Topic-only exclusion
      const ruleBRes = await request(app)
        .post('/v1/alerts/rules')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          name: 'Topic Excluded Rule',
          type: 'volume_spike',
          excluded_watchlist_ids: [],
          excluded_topic_ids: ['marketing_blast'],
          max_alerts_per_day: 20,
        });
      const ruleB = ruleBRes.body;

      // Rule C: Both exclusions configured independently
      const ruleCRes = await request(app)
        .post('/v1/alerts/rules')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          name: 'Dual Excluded Rule',
          type: 'volume_spike',
          excluded_watchlist_ids: [wlExcluded],
          excluded_topic_ids: ['marketing_blast'],
          max_alerts_per_day: 20,
        });
      const ruleC = ruleCRes.body;

      // Test A1: Post on excluded watchlist -> suppressed by Rule A independently of topics
      const resA1 = await evaluateRuleForPost(
        ruleA,
        {
          id: randomUUID(),
          tenantId: tenant.id,
          matchedWatchlistIds: [wlExcluded],
          topics: ['unrelated_topic'],
        },
        getAdminPool()
      );
      expect(resA1).toEqual({ status: 'excluded', reason: 'MATCHED_EXCLUDED_WATCHLIST' });

      // Test A2: Post on normal watchlist -> passes Rule A
      const resA2 = await evaluateRuleForPost(
        ruleA,
        {
          id: randomUUID(),
          tenantId: tenant.id,
          matchedWatchlistIds: [wlNormal],
          topics: ['marketing_blast'],
        },
        getAdminPool()
      );
      expect(resA2.status).not.toBe('excluded');

      // Test B1: Post with excluded topic -> suppressed by Rule B independently of watchlists
      const resB1 = await evaluateRuleForPost(
        ruleB,
        {
          id: randomUUID(),
          tenantId: tenant.id,
          matchedWatchlistIds: [wlNormal],
          topics: ['marketing_blast'],
        },
        getAdminPool()
      );
      expect(resB1).toEqual({ status: 'excluded', reason: 'MATCHED_EXCLUDED_TOPIC' });

      // Test B2: Post with normal topic -> passes Rule B
      const resB2 = await evaluateRuleForPost(
        ruleB,
        {
          id: randomUUID(),
          tenantId: tenant.id,
          matchedWatchlistIds: [wlExcluded],
          topics: ['general_discussion'],
        },
        getAdminPool()
      );
      expect(resB2.status).not.toBe('excluded');

      // Test C1 & C2: Dual rule suppresses if EITHER matches
      const resC1 = await evaluateRuleForPost(
        ruleC,
        {
          id: randomUUID(),
          tenantId: tenant.id,
          matchedWatchlistIds: [wlExcluded],
          topics: ['general_discussion'],
        },
        getAdminPool()
      );
      expect(resC1).toEqual({ status: 'excluded', reason: 'MATCHED_EXCLUDED_WATCHLIST' });

      const resC2 = await evaluateRuleForPost(
        ruleC,
        {
          id: randomUUID(),
          tenantId: tenant.id,
          matchedWatchlistIds: [wlNormal],
          topics: ['marketing_blast'],
        },
        getAdminPool()
      );
      expect(resC2).toEqual({ status: 'excluded', reason: 'MATCHED_EXCLUDED_TOPIC' });

      // Test triggerAlert with post context: verify zero records in tenant_alerts when excluded
      const alertNull = await triggerAlert(
        tenant.id,
        ruleC.id,
        'warning',
        'Should be suppressed by exclusion',
        {},
        { matchedWatchlistIds: [wlExcluded], topicIds: [] }
      );
      expect(alertNull).toBeNull();

      const inboxRes = await request(app)
        .get('/v1/alerts/inbox')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));
      expect(inboxRes.body.alerts.length).toBe(0);
    });
  });

  describe('AC3: Rolling 24-Hour Daily Cap & Dual Throttling', () => {
    it('suppresses alert creation once max_alerts_per_day is reached within 24h rolling window', async () => {
      const tenant = await createTenantFixture(`T-15.1-cap-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

      // Rule with max 2 alerts per day and 0 cooldown for immediate testing
      const ruleRes = await request(app)
        .post('/v1/alerts/rules')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          name: 'Capped Rule',
          type: 'volume_spike',
          cooldown_minutes: 0,
          max_alerts_per_day: 2,
        });
      const ruleId = ruleRes.body.id;

      // Fire 1st alert -> Succeeds
      const alert1 = await triggerAlert(tenant.id, ruleId, 'info', 'Alert #1');
      expect(alert1).toBeDefined();
      expect(alert1?.status).toBe('active');

      // Fire 2nd alert -> Succeeds
      const alert2 = await triggerAlert(tenant.id, ruleId, 'info', 'Alert #2');
      expect(alert2).toBeDefined();
      expect(alert2?.status).toBe('active');

      // Fire 3rd alert -> Suppressed by rolling 24h daily cap!
      const alert3 = await triggerAlert(tenant.id, ruleId, 'info', 'Alert #3 (should exceed cap)');
      expect(alert3).toBeNull();

      // Verify inbox only contains exactly 2 alerts
      const inboxRes = await request(app)
        .get('/v1/alerts/inbox')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));
      expect(inboxRes.body.alerts.length).toBe(2);
    });
  });

  describe('AC4: Pre-Save Alert Volume Preview Simulation Endpoint', () => {
    it('simulates historical alert firing over lookback window without writing to DB', async () => {
      const tenant = await createTenantFixture(`T-15.1-sim-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });
      const wl = await createWatchlistFixture(tenant.id, user.id, 'Target WL');

      // Record rule and alert counts before preview
      const { rows: rulesBefore } = await getAdminPool().query(
        `SELECT COUNT(*)::int AS count FROM alert_rules WHERE tenant_id = $1`,
        [tenant.id]
      );
      const { rows: alertsBefore } = await getAdminPool().query(
        `SELECT COUNT(*)::int AS count FROM tenant_alerts WHERE tenant_id = $1`,
        [tenant.id]
      );

      // Seed historical counts in watchlist_daily_counts for simulation replay
      await getAdminPool().query(
        `INSERT INTO watchlist_daily_counts (tenant_id, date, watchlist_id, post_count, positive_count, neutral_count, negative_count)
         VALUES 
           ($1, CURRENT_DATE - INTERVAL '1 day', $2, 60, 10, 40, 10),
           ($1, CURRENT_DATE - INTERVAL '2 day', $2, 120, 10, 80, 30),
           ($1, CURRENT_DATE - INTERVAL '3 day', $2, 40, 10, 25, 5)`,
        [tenant.id, wl]
      );

      // 1. Call POST /v1/alert-rules/preview
      const previewRes = await request(app)
        .post('/v1/alert-rules/preview')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          type: 'volume_spike',
          watchlistId: wl,
          threshold: { minPosts: 50 },
          lookbackDays: 7,
          sensitivity: 'balanced',
        });

      expect(previewRes.status).toBe(200);
      expect(previewRes.body).toMatchObject({
        estimatedAlertCount: expect.any(Number),
        lookbackDays: 7,
        sensitivity: 'balanced',
      });
      // Days 1 and 2 exceeded 50 posts -> estimated count >= 2
      expect(previewRes.body.estimatedAlertCount).toBeGreaterThanOrEqual(2);

      // Also verify alternative mounted path POST /v1/alerts/rules/preview
      const altPreviewRes = await request(app)
        .post('/v1/alerts/rules/preview')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          type: 'volume_spike',
          watchlistId: wl,
          threshold: { minPosts: 100 },
          lookbackDays: 7,
        });
      expect(altPreviewRes.status).toBe(200);
      expect(altPreviewRes.body.estimatedAlertCount).toBe(1); // Only day 2 had 120 posts

      // 2. Read-only invariant: confirm zero records were written
      const { rows: rulesAfter } = await getAdminPool().query(
        `SELECT COUNT(*)::int AS count FROM alert_rules WHERE tenant_id = $1`,
        [tenant.id]
      );
      const { rows: alertsAfter } = await getAdminPool().query(
        `SELECT COUNT(*)::int AS count FROM tenant_alerts WHERE tenant_id = $1`,
        [tenant.id]
      );

      expect(rulesAfter[0].count).toBe(rulesBefore[0].count);
      expect(alertsAfter[0].count).toBe(alertsBefore[0].count);

      // 3. Validation: lookbackDays bounds [1, 30]
      const highLookbackRes = await request(app)
        .post('/v1/alert-rules/preview')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          type: 'volume_spike',
          watchlistId: wl,
          threshold: { minPosts: 50 },
          lookbackDays: 31,
        });
      expect(highLookbackRes.status).toBe(400);
      expect(highLookbackRes.body.error).toContain('INVALID_LOOKBACK_WINDOW');

      const lowLookbackRes = await request(app)
        .post('/v1/alert-rules/preview')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          type: 'volume_spike',
          watchlistId: wl,
          threshold: { minPosts: 50 },
          lookbackDays: 0,
        });
      expect(lowLookbackRes.status).toBe(400);
      expect(lowLookbackRes.body.error).toContain('INVALID_LOOKBACK_WINDOW');

      // 4. Validation: malformed exclusion UUID
      const badUuidRes = await request(app)
        .post('/v1/alert-rules/preview')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          type: 'volume_spike',
          watchlistId: wl,
          threshold: { minPosts: 50 },
          excludedWatchlistIds: ['not-a-valid-uuid'],
        });
      expect(badUuidRes.status).toBe(400);
      expect(badUuidRes.body.error).toContain('INVALID_EXCLUSION_ID');
    });

    it('enforces tenant isolation during preview simulation', async () => {
      const tenantA = await createTenantFixture(`T-15.1-isoA-${randomUUID()}`);
      const tenantB = await createTenantFixture(`T-15.1-isoB-${randomUUID()}`);
      const userA = await createInvitedUser(tenantA.id, { email: `user-${randomUUID()}@example.com` });
      const userB = await createInvitedUser(tenantB.id, { email: `user-${randomUUID()}@example.com` });

      const wlA = await createWatchlistFixture(tenantA.id, userA.id, 'Tenant A WL');
      const wlB = await createWatchlistFixture(tenantB.id, userB.id, 'Tenant B WL');

      // Seed 200 posts in Tenant B
      await getAdminPool().query(
        `INSERT INTO watchlist_daily_counts (tenant_id, date, watchlist_id, post_count)
         VALUES ($1, CURRENT_DATE - INTERVAL '1 day', $2, 200)`,
        [tenantB.id, wlB]
      );

      // Tenant A runs preview -> should see 0 alerts (cannot see tenant B data)
      const res = await request(app)
        .post('/v1/alert-rules/preview')
        .set('X-Test-Identity', testIdentityHeaderValue(tenantA.id, { userId: userA.id, role: 'tenant_user' }))
        .send({
          type: 'volume_spike',
          watchlistId: wlA,
          threshold: { minPosts: 50 },
          lookbackDays: 7,
        });

      expect(res.status).toBe(200);
      expect(res.body.estimatedAlertCount).toBe(0);
    });
  });
});
