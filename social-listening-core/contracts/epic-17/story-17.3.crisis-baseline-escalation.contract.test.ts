// Contract: Story 17.3 (ADR-0131, BRD-0131, FDD-0131) — Crisis Threshold
// Baseline Calibration and Escalation Matrix (Backend)
// See docs/user-stories/epic-17-adr-0129-to-0133.md#story-173
//
// Intent: rolling 14-day per-watchlist statistical baseline
// (crisis_baseline_metrics) replacing ADR-0079's static thresholds;
// Z-score dynamic tier evaluation (2.0sigma/3.0sigma/4.5sigma) gated by a
// negative-sentiment floor; a stateful escalation engine whose Tier 1
// action dispatches for real via ADR-0091's webhook mechanism while Tier
// 2/3 record audited intent only (no SMS/PagerDuty/telephony integration
// exists or is authorized — ADR-0131 SS4); and the incident lifecycle API
// (acknowledge/resolve). Out of scope: any live SMS/PagerDuty/telephony
// dispatch, a frontend UI, ack-timeout-driven tier auto-promotion, and
// baseline trend history beyond the current rolling window.

import { randomUUID } from 'crypto';
import { createServer, Server } from 'http';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool, getPool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { createInvitedUser } from '../../src/identity/identityResolution';
import {
  calibrateWatchlistBaselines,
  createEscalationRule,
  getBaselineBucket,
} from '../../src/crisis/crisisBaselineStore';
import {
  evaluateCrisisZScore,
  createCrisisIncident,
  sweepAckTimeoutIncidents,
} from '../../src/crisis/crisisEscalationEngine';

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

async function createWatchlistFixture(tenantId: string, userId: string, name: string): Promise<string> {
  return withTenant<string>(
    tenantId,
    async (client) => {
      const { rows } = await client.query(
        `INSERT INTO watchlists (tenant_id, user_id, name, match_type, terms, boolean_query, platform_ids, is_active)
         VALUES ($1, $2, $3, 'boolean', NULL, 'acme AND crisis', ARRAY['gnews'], true)
         RETURNING id`,
        [tenantId, userId, name]
      );
      return rows[0].id;
    },
    getPool(),
    userId
  );
}

/** Inserts a social_posts row already matched to a watchlist, at a specific published_at, with a sentiment. */
async function insertMatchedPost(
  tenantId: string,
  watchlistId: string,
  publishedAt: Date,
  sentiment: 'positive' | 'neutral' | 'negative'
): Promise<void> {
  await withTenant(
    tenantId,
    async (client) => {
      const { rows } = await client.query(
        `INSERT INTO social_posts (tenant_id, raw_payload, published_at, enrichment)
         VALUES ($1, $2::jsonb, $3, $4::jsonb) RETURNING id`,
        [tenantId, JSON.stringify({ providerId: 'gnews' }), publishedAt.toISOString(), JSON.stringify({ sentiment })]
      );
      await client.query(
        `INSERT INTO post_watchlist_matches (post_id, watchlist_id, tenant_id) VALUES ($1, $2, $3)`,
        [rows[0].id, watchlistId, tenantId]
      );
    },
    getPool()
  );
}

/** A timestamp `daysAgo` days before a fixed anchor hour (same weekday/hour when daysAgo is a multiple of 7). */
function bucketTimestamp(anchorHour: Date, daysAgo: number): Date {
  return new Date(anchorHour.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

function startTestWebhookServer(): Promise<{ server: Server; port: number; received: Array<{ headers: any; body: any }> }> {
  return new Promise((resolve) => {
    const received: Array<{ headers: any; body: any }> = [];
    const server = createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        received.push({ headers: req.headers, body: raw ? JSON.parse(raw) : null });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, port, received });
    });
  });
}

describe('Story 17.3 — Crisis Baseline Calibration & Escalation Matrix Contract', () => {
  const app = createApp();

  it('AC1: crisis_baseline_metrics, crisis_escalation_rules, crisis_incident_logs are RLS-isolated across tenants', async () => {
    const tenantA = await createTenantFixture(`T-17.3-rlsA-${randomUUID()}`);
    const tenantB = await createTenantFixture(`T-17.3-rlsB-${randomUUID()}`);
    const userA = await createInvitedUser(tenantA.id, { email: `a-${randomUUID()}@example.com`, role: 'tenant_admin' });
    const watchlistA = await createWatchlistFixture(tenantA.id, userA.id, 'A Watchlist');
    const rule = await createEscalationRule(tenantA.id, userA.id, { watchlistId: watchlistA });

    await calibrateWatchlistBaselines(tenantA.id, watchlistA);

    await withTenant(tenantB.id, async (client) => {
      const rules = await client.query('SELECT * FROM crisis_escalation_rules WHERE id = $1', [rule.id]);
      expect(rules.rows).toHaveLength(0);
      const baselines = await client.query('SELECT * FROM crisis_baseline_metrics WHERE watchlist_id = $1', [watchlistA]);
      expect(baselines.rows).toHaveLength(0);
    });
  });

  it('AC2: calibration worker upserts rolling 14-day mean/stddev/sample_count for a calibrated bucket, from real ingestion history', async () => {
    const tenant = await createTenantFixture(`T-17.3-calib-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com`, role: 'tenant_admin' });
    const watchlistId = await createWatchlistFixture(tenant.id, user.id, 'Calibration Watchlist');

    // Anchor a fixed hour comfortably inside "today", then place two
    // occurrences of that same (day_of_week, hour_of_day) bucket 7 days
    // apart (3 and 10 days back) — both safely inside the 14-day trailing
    // window with real margin on both ends, unlike exactly 7/14 days back,
    // which leaves zero slack against the 14-day boundary (the 14-day-back
    // sample would fall outside `>= now() - interval '14 days'` by the time
    // this async setup's real wall-clock time elapses and the calibration
    // query's own `now()` evaluates slightly later than this anchor).
    // week1 (mention_count=3) and week2 (mention_count=5) => mean=4, stddev_pop=1, sample_count=2.
    const anchor = new Date();
    anchor.setUTCMinutes(0, 0, 0);
    const week1 = bucketTimestamp(anchor, 3);
    const week2 = bucketTimestamp(anchor, 10);

    for (let i = 0; i < 3; i++) {
      await insertMatchedPost(tenant.id, watchlistId, new Date(week1.getTime() + i * 1000), 'neutral');
    }
    for (let i = 0; i < 5; i++) {
      await insertMatchedPost(tenant.id, watchlistId, new Date(week2.getTime() + i * 1000), i < 2 ? 'negative' : 'neutral');
    }

    const rows = await calibrateWatchlistBaselines(tenant.id, watchlistId);
    expect(rows.length).toBeGreaterThan(0);

    const velocityBucket = await getBaselineBucket(
      tenant.id,
      watchlistId,
      'mention_velocity',
      week1.getUTCDay(),
      week1.getUTCHours()
    );
    expect(velocityBucket).not.toBeNull();
    expect(Number(velocityBucket!.mean_14d)).toBeCloseTo(4, 5);
    expect(Number(velocityBucket!.stddev_14d)).toBeCloseTo(1, 5);
    expect(velocityBucket!.sample_count).toBe(2);

    const sentimentBucket = await getBaselineBucket(
      tenant.id,
      watchlistId,
      'negative_sentiment_ratio',
      week1.getUTCDay(),
      week1.getUTCHours()
    );
    expect(sentimentBucket).not.toBeNull();
    // week1: 0/3 negative; week2: 2/5 negative => mean = (0 + 0.4) / 2 = 0.2
    expect(Number(sentimentBucket!.mean_14d)).toBeCloseTo(0.2, 5);
    expect(sentimentBucket!.sample_count).toBe(2);
  });

  it('AC3: an uncalibrated bucket (no baseline, or below the sample-count floor / zero stddev) is excluded from Z-score evaluation, never divides by zero', () => {
    const rule = {
      tier1_z_threshold: '2.0',
      tier2_z_threshold: '3.0',
      tier3_z_threshold: '4.5',
      negative_sentiment_floor_pct: '40',
    };

    expect(evaluateCrisisZScore(null, rule, { metricType: 'mention_velocity', observedValue: 50, negativeSentimentPct: 80 })).toBeNull();

    expect(
      evaluateCrisisZScore(
        { mean_14d: '10', stddev_14d: '0', sample_count: 5 },
        rule,
        { metricType: 'mention_velocity', observedValue: 50, negativeSentimentPct: 80 }
      )
    ).toBeNull();

    expect(
      evaluateCrisisZScore(
        { mean_14d: '10', stddev_14d: '2', sample_count: 1 },
        rule,
        { metricType: 'mention_velocity', observedValue: 50, negativeSentimentPct: 80 }
      )
    ).toBeNull();
  });

  it('AC4: Z-score evaluation assigns the correct dynamic tier and requires the negative-sentiment floor to also be met (BRU-002)', () => {
    const rule = {
      tier1_z_threshold: '2.0',
      tier2_z_threshold: '3.0',
      tier3_z_threshold: '4.5',
      negative_sentiment_floor_pct: '40',
    };
    const baseline = { mean_14d: '10', stddev_14d: '2', sample_count: 5 };

    // Z = (14 - 10) / 2 = 2.0 -> tier 1, sentiment floor met
    expect(
      evaluateCrisisZScore(baseline, rule, { metricType: 'mention_velocity', observedValue: 14, negativeSentimentPct: 45 })
    ).toMatchObject({ tier: 1, zScore: 2 });

    // Z = (16 - 10) / 2 = 3.0 -> tier 2
    expect(
      evaluateCrisisZScore(baseline, rule, { metricType: 'mention_velocity', observedValue: 16, negativeSentimentPct: 45 })
    ).toMatchObject({ tier: 2, zScore: 3 });

    // Z = (19 - 10) / 2 = 4.5 -> tier 3
    expect(
      evaluateCrisisZScore(baseline, rule, { metricType: 'mention_velocity', observedValue: 19, negativeSentimentPct: 45 })
    ).toMatchObject({ tier: 3, zScore: 4.5 });

    // Z = 4.5 (tier-3-qualifying) but sentiment floor not met -> no incident at all
    expect(
      evaluateCrisisZScore(baseline, rule, { metricType: 'mention_velocity', observedValue: 19, negativeSentimentPct: 10 })
    ).toBeNull();

    // Z below tier 1 -> no incident
    expect(
      evaluateCrisisZScore(baseline, rule, { metricType: 'mention_velocity', observedValue: 11, negativeSentimentPct: 90 })
    ).toBeNull();
  });

  it('AC5/AC6: Tier 1 incident creation dispatches a real, signed webhook via ADR-0091\'s delivery mechanism and records the outcome', async () => {
    const { server, port, received } = await startTestWebhookServer();
    try {
      const tenant = await createTenantFixture(`T-17.3-tier1-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com`, role: 'tenant_admin' });
      const watchlistId = await createWatchlistFixture(tenant.id, user.id, 'Tier1 Watchlist');
      const rule = await createEscalationRule(tenant.id, user.id, {
        watchlistId,
        tier1Delivery: { channel: 'webhook', webhookUrls: [`http://127.0.0.1:${port}/hook`], secret: 'test-secret' },
      });

      const evaluation = { tier: 1 as const, zScore: 2.4, baselineMean: 10, baselineStddev: 2 };
      const incident = await createCrisisIncident(
        tenant.id,
        watchlistId,
        rule,
        evaluation,
        { metricType: 'mention_velocity', observedValue: 14.8, negativeSentimentPct: 55 }
      );

      expect(incident.tier).toBe(1);
      expect(incident.status).toBe('open');
      expect(incident.escalation_action_log).toHaveLength(1);
      expect(incident.escalation_action_log[0]).toMatchObject({
        tier: 1,
        action: 'dispatched',
        channel: 'webhook',
        outcome: 'delivered',
      });

      // Real production call site: the mechanism ADR-0091 already ships
      // actually received a real, signed HTTP POST.
      expect(received).toHaveLength(1);
      expect(received[0].headers['x-socialengage-signature']).toBeDefined();
      expect(received[0].body.payload).toMatchObject({ incidentId: incident.id, tier: 1 });
    } finally {
      server.close();
    }
  });

  it('AC5/AC7: Tier 2 and Tier 3 incidents record recorded_intent audit entries only, with no outbound call made', async () => {
    const tenant = await createTenantFixture(`T-17.3-tier23-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com`, role: 'tenant_admin' });
    const watchlistId = await createWatchlistFixture(tenant.id, user.id, 'Tier23 Watchlist');
    const rule = await createEscalationRule(tenant.id, user.id, {
      watchlistId,
      tier2Delivery: { channel: 'intent_only', vendor: 'pagerduty', recipients: ['brm-oncall'] },
      tier3Delivery: { channel: 'intent_only', vendor: 'executive_phone_broadcast', recipients: ['cmo'] },
    });

    const tier2Incident = await createCrisisIncident(
      tenant.id,
      watchlistId,
      rule,
      { tier: 2, zScore: 3.2, baselineMean: 10, baselineStddev: 2 },
      { metricType: 'mention_velocity', observedValue: 16.4, negativeSentimentPct: 55 }
    );
    expect(tier2Incident.escalation_action_log[0]).toMatchObject({
      tier: 2,
      action: 'recorded_intent',
      outcome: 'not_attempted_intent_only',
    });

    const tier3Incident = await createCrisisIncident(
      tenant.id,
      watchlistId,
      rule,
      { tier: 3, zScore: 5.1, baselineMean: 10, baselineStddev: 2 },
      { metricType: 'mention_velocity', observedValue: 20.2, negativeSentimentPct: 55 }
    );
    expect(tier3Incident.escalation_action_log[0]).toMatchObject({
      tier: 3,
      action: 'recorded_intent',
      channel: 'executive_phone_broadcast',
      outcome: 'not_attempted_intent_only',
    });
  });

  it('AC8: the ack-timeout sweep re-notifies an overdue open incident at the same tier and pushes ack_timeout_at forward, without promoting the tier', async () => {
    const tenant = await createTenantFixture(`T-17.3-sweep-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com`, role: 'tenant_admin' });
    const watchlistId = await createWatchlistFixture(tenant.id, user.id, 'Sweep Watchlist');
    const rule = await createEscalationRule(tenant.id, user.id, {
      watchlistId,
      ackTimeoutMinutes: 15,
      tier2Delivery: { channel: 'intent_only', vendor: 'pagerduty', recipients: ['oncall'] },
    });

    const incident = await createCrisisIncident(
      tenant.id,
      watchlistId,
      rule,
      { tier: 2, zScore: 3.5, baselineMean: 10, baselineStddev: 2 },
      { metricType: 'mention_velocity', observedValue: 17, negativeSentimentPct: 55 }
    );

    // Force the ack_timeout_at into the past to simulate an elapsed window.
    await withTenant(
      tenant.id,
      (client) => client.query(`UPDATE crisis_incident_logs SET ack_timeout_at = now() - interval '1 minute' WHERE id = $1`, [incident.id]),
      getPool(),
      user.id
    );

    const result = await sweepAckTimeoutIncidents();
    expect(result.swept).toBeGreaterThanOrEqual(1);

    const refreshed = await withTenant(
      tenant.id,
      async (client) => {
        const { rows } = await client.query('SELECT * FROM crisis_incident_logs WHERE id = $1', [incident.id]);
        return rows[0];
      },
      getPool(),
      user.id
    );
    expect(refreshed.tier).toBe(2); // never promoted
    expect(refreshed.status).toBe('open');
    expect(new Date(refreshed.ack_timeout_at).getTime()).toBeGreaterThan(Date.now());
    expect(refreshed.escalation_action_log).toHaveLength(2); // original dispatch + sweep re-notification
  });

  it('AC9: POST /v1/crisis/incidents/:id/acknowledge is role-gated, idempotent, and rejects an already-resolved incident', async () => {
    const tenant = await createTenantFixture(`T-17.3-ack-${randomUUID()}`);
    const admin = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com`, role: 'tenant_admin' });
    const brm = await createInvitedUser(tenant.id, {
      email: `brm-${randomUUID()}@example.com`,
      role: 'tenant_brand_reputation_manager',
    });
    const plainUser = await createInvitedUser(tenant.id, { email: `plain-${randomUUID()}@example.com`, role: 'tenant_user' });
    const watchlistId = await createWatchlistFixture(tenant.id, admin.id, 'Ack Watchlist');
    const rule = await createEscalationRule(tenant.id, admin.id, {
      watchlistId,
      tier2Delivery: { channel: 'intent_only', vendor: 'sms', recipients: ['brm'] },
    });
    const incident = await createCrisisIncident(
      tenant.id,
      watchlistId,
      rule,
      { tier: 2, zScore: 3.1, baselineMean: 10, baselineStddev: 2 },
      { metricType: 'mention_velocity', observedValue: 16.2, negativeSentimentPct: 55 }
    );

    const forbidden = await request(app)
      .post(`/v1/crisis/incidents/${incident.id}/acknowledge`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: plainUser.id, role: 'tenant_user' }));
    expect(forbidden.status).toBe(403);

    const ok = await request(app)
      .post(`/v1/crisis/incidents/${incident.id}/acknowledge`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: brm.id, role: 'tenant_brand_reputation_manager' }));
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ incidentId: incident.id, status: 'acknowledged', acknowledgedByUserId: brm.id });

    // Idempotent re-acknowledge: no error, no state change.
    const again = await request(app)
      .post(`/v1/crisis/incidents/${incident.id}/acknowledge`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'tenant_admin' }));
    expect(again.status).toBe(200);
    expect(again.body.acknowledgedByUserId).toBe(brm.id); // unchanged, not overwritten

    const resolve = await request(app)
      .post(`/v1/crisis/incidents/${incident.id}/resolve`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'tenant_admin' }))
      .send({ rootCauseNotes: 'Confirmed false positive from a viral positive PR mention.' });
    expect(resolve.status).toBe(200);

    const ackAfterResolve = await request(app)
      .post(`/v1/crisis/incidents/${incident.id}/acknowledge`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'tenant_admin' }));
    expect(ackAfterResolve.status).toBe(409);
    expect(ackAfterResolve.body.code).toBe('invalid_state_transition');
  });

  it('AC10: POST /v1/crisis/incidents/:id/resolve requires non-empty rootCauseNotes and rejects on unknown/cross-tenant id', async () => {
    const tenant = await createTenantFixture(`T-17.3-resolve-${randomUUID()}`);
    const otherTenant = await createTenantFixture(`T-17.3-resolve-other-${randomUUID()}`);
    const admin = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com`, role: 'tenant_admin' });
    const otherAdmin = await createInvitedUser(otherTenant.id, { email: `other-${randomUUID()}@example.com`, role: 'tenant_admin' });
    const watchlistId = await createWatchlistFixture(tenant.id, admin.id, 'Resolve Watchlist');
    const rule = await createEscalationRule(tenant.id, admin.id, { watchlistId });
    const incident = await createCrisisIncident(
      tenant.id,
      watchlistId,
      rule,
      { tier: 1, zScore: 2.2, baselineMean: 10, baselineStddev: 2 },
      { metricType: 'mention_velocity', observedValue: 14.4, negativeSentimentPct: 45 }
    );

    const missingNotes = await request(app)
      .post(`/v1/crisis/incidents/${incident.id}/resolve`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'tenant_admin' }))
      .send({ rootCauseNotes: '   ' });
    expect(missingNotes.status).toBe(422);
    expect(missingNotes.body.code).toBe('validation_failed');

    // Cross-tenant: tenant B's admin cannot resolve tenant A's incident (RLS -> not_found).
    const crossTenant = await request(app)
      .post(`/v1/crisis/incidents/${incident.id}/resolve`)
      .set('X-Test-Identity', testIdentityHeaderValue(otherTenant.id, { userId: otherAdmin.id, role: 'tenant_admin' }))
      .send({ rootCauseNotes: 'Should not be visible cross-tenant.' });
    expect(crossTenant.status).toBe(404);

    const ok = await request(app)
      .post(`/v1/crisis/incidents/${incident.id}/resolve`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'tenant_admin' }))
      .send({ rootCauseNotes: 'Root cause: confirmed spike from a syndicated news pickup, resolved.' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ incidentId: incident.id, status: 'resolved', resolvedByUserId: admin.id });
    expect(ok.body.rootCauseNotes).toContain('syndicated news pickup');
  });

  it('AC11: exactly one incident row is created per triggering observation, at its single highest-qualifying tier', async () => {
    const tenant = await createTenantFixture(`T-17.3-onerow-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com`, role: 'tenant_admin' });
    const watchlistId = await createWatchlistFixture(tenant.id, user.id, 'OneRow Watchlist');
    const rule = await createEscalationRule(tenant.id, user.id, {
      watchlistId,
      tier3Delivery: { channel: 'intent_only', vendor: 'executive_phone_broadcast', recipients: ['cmo'] },
    });

    const evaluation = evaluateCrisisZScore(
      { mean_14d: '10', stddev_14d: '2', sample_count: 3 },
      rule,
      { metricType: 'mention_velocity', observedValue: 19, negativeSentimentPct: 55 }
    );
    expect(evaluation).toMatchObject({ tier: 3 });

    const incident = await createCrisisIncident(
      tenant.id,
      watchlistId,
      rule,
      evaluation!,
      { metricType: 'mention_velocity', observedValue: 19, negativeSentimentPct: 55 }
    );

    const rows = await withTenant(
      tenant.id,
      async (client) => {
        const res = await client.query('SELECT * FROM crisis_incident_logs WHERE watchlist_id = $1', [watchlistId]);
        return res.rows;
      },
      getPool(),
      user.id
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(incident.id);
    expect(rows[0].tier).toBe(3);
  });
});
