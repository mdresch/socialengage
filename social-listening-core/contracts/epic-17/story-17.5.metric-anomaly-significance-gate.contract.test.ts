// Contract: Story 17.5 (ADR-0133, TDS-0133) — Metric anomaly statistical significance gate (backend)
// See docs/user-stories/epic-17-adr-0129-to-0133.md#story-175--metric-anomaly-statistical-significance-gate-backend
//
// Intent: Story 17.5 — Statistical significance gating (p < 0.05) and multi-factor
//         root-cause decomposition for POST /v1/explain.
// Source: ADR-0133, BRD-0133, FDD-0133, TDS-0133 (ADR/BRD/FDD are terse stubs;
//         TDS-0133 and the Story's AC list are the real spec — same pattern as
//         Stories 17.2–17.4. Note: TDS-0133 §1.2's traceability matrix cites
//         "Story 17.3" as governing story — a doc bug; the governing story is 17.5).
// Scope:
//   src/ai/significanceGate.ts (new)
//   src/ai/metricExplainabilityService.ts (gate + decomposition wiring, response extension)
//   social-listening-core/.claude/skills/metric-explainability/SKILL.md
// Contract to encode:
//   AC1: evaluateStatisticalSignificance computes Z = |Δ−μ|/σ and
//        p = 2·(1−Φ(Z)) per TDS-0133 §4.1 — including the σ=0 → not-significant
//        guard and the Z≈1.96 significance boundary.
//   AC2: Baseline = the tenant's own 30-day daily-post-count series before the
//        request's timeRange.start; the observed delta |value−previousValue| is
//        compared against the distribution of absolute day-over-day deltas.
//        p ≥ 0.05 → POST /v1/explain returns 200 with isStatisticallySignificant=false,
//        zScore, pValue, a deterministic no-LLM explanation, tokenCostSaved=true,
//        generationId 'none' — and the Azure OpenAI connector is never invoked.
//   AC3: p < 0.05 → the request proceeds to generation and the response carries
//        factorDecomposition{volumeDeltaPercent, sentimentShiftContribution,
//        dominantPlatform, topContributingTopic, topAuthorImpactRatio} computed
//        from real tenant data, and the rendered prompt contains the structured
//        factor telemetry.
//   AC4: <7 historical samples (TDS-0133 §8) → the gate defaults open and the
//        normal generation path runs.
//   AC5: Gate decisions are computed strictly across the authenticated tenant's
//        data (baseline + decomposition are tenant-scoped).
// Out of scope: bumping the versioned prompt template (factors are injected via
//   the existing context string so promptVersion stays 1 and the Story 13.7
//   cache-key contract is untouched); caching gated responses (they are
//   deterministic and cheap — no LLM spend to amortize); per-tenant alpha
//   (TDS-0133 §12 open question Q-0133-1).

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { evaluateStatisticalSignificance } from '../../src/ai/significanceGate';
import { azureOpenAiConnector } from '../../src/connectors/azureOpenAi/azureOpenAiConnector';
import * as credentialStore from '../../src/credentials/credentialStore';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';
import { __resetGateForTests } from '../../src/connectors/requestGate';

jest.setTimeout(120000);

const app = createApp();

afterAll(async () => {
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  __resetGateForTests();
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

/**
 * Seeds `days` days of posts ending `endDate` (exclusive-ish, day precision).
 * Daily volume follows a repeating 8/11/14/17/20 pattern so the day-over-day
 * |delta| distribution has a known nonzero spread (≈ [3,3,3,3,12] repeating).
 */
async function seedDailyPosts(tenantId: string, days: number, endDate: string): Promise<void> {
  const pattern = [8, 11, 14, 17, 20];
  for (let d = days; d >= 1; d--) {
    const day = new Date(new Date(endDate).getTime() - d * 86400000)
      .toISOString()
      .slice(0, 10);
    const count = pattern[d % pattern.length];
    await getAdminPool().query(
      `INSERT INTO social_posts (tenant_id, raw_payload, published_at, body_markdown, enrichment)
       SELECT $1,
              jsonb_build_object('providerId', 'twitter', 'externalId', 'e-' || gen_random_uuid()),
              ($2::date + (g || ' hours')::interval)::timestamptz,
              'seeded post',
              jsonb_build_object('sentiment', CASE WHEN g % 3 = 0 THEN 'negative' ELSE 'positive' END, 'modelUsed', 'azure-ai-language')
       FROM generate_series(0, $3 - 1) g`,
      [tenantId, day, count]
    );
  }
}

/** Seeds posts inside the explain request's observed window. */
async function seedWindowPosts(tenantId: string, start: string, count: number, platform = 'twitter'): Promise<void> {
  await getAdminPool().query(
    `INSERT INTO social_posts (tenant_id, raw_payload, published_at, body_markdown, enrichment)
     SELECT $1,
            jsonb_build_object('providerId', $4::text, 'externalId', 'w-' || gen_random_uuid()),
            ($2::timestamptz + (g || ' hours')::interval),
            'window post',
            jsonb_build_object('sentiment', CASE WHEN g % 4 = 0 THEN 'negative' ELSE 'positive' END, 'modelUsed', 'azure-ai-language')
     FROM generate_series(0, $3 - 1) g`,
    [tenantId, start, count, platform]
  );
}

async function setupActiveOpenAi(tenantId: string): Promise<jest.SpyInstance> {
  await setConnectorActivation(tenantId, 'azure-openai', 'tenant', true);
  jest.spyOn(credentialStore, 'getLatestCredentialId').mockResolvedValue('test-cred-id');
  jest.spyOn(credentialStore, 'readCredential').mockResolvedValue(
    JSON.stringify({ endpoint: 'https://example.openai.azure.com', key: 'test-key', deployment: 'gpt-5-mini' })
  );
  return jest
    .spyOn(azureOpenAiConnector as any, 'explain')
    .mockResolvedValue({ explanation: 'Mocked AI explanation.', confidence: 'high' });
}

const WINDOW = { start: '2026-08-01T00:00:00Z', end: '2026-08-07T00:00:00Z' };
const BASELINE_END = '2026-08-01';

describe('Story 17.5 — Metric anomaly statistical significance gate', () => {
  describe('AC1: evaluateStatisticalSignificance math (TDS-0133 §4.1)', () => {
    it('returns not-significant with p=1.0 when the baseline has zero variance', () => {
      const r = evaluateStatisticalSignificance(5, 10, 0);
      expect(r).toEqual({ isSignificant: false, zScore: 0, pValue: 1.0 });
    });

    it('computes Z and two-tailed p; the significance boundary is p < 0.05', () => {
      // Z = |15−10|/2 = 2.5 → p ≈ 0.0124 → significant
      const sig = evaluateStatisticalSignificance(15, 10, 2);
      expect(sig.isSignificant).toBe(true);
      expect(sig.zScore).toBeCloseTo(2.5, 2);
      expect(sig.pValue).toBeLessThan(0.05);

      // Z = |11−10|/2 = 0.5 → p ≈ 0.617 → not significant
      const noise = evaluateStatisticalSignificance(11, 10, 2);
      expect(noise.isSignificant).toBe(false);
      expect(noise.zScore).toBeCloseTo(0.5, 2);
      expect(noise.pValue).toBeGreaterThan(0.05);
    });
  });

  describe('AC2: non-significant shifts return 200 without invoking Azure OpenAI', () => {
    it('a delta inside historical variance returns the gated response and never calls explain()', async () => {
      const tenant = await createTenantFixture(`T-17.5-gated-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });
      await seedDailyPosts(tenant.id, 30, BASELINE_END);
      const explainSpy = await setupActiveOpenAi(tenant.id);

      const res = await request(app)
        .post('/v1/explain')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({
          metricKey: 'total-mentions',
          value: 12, // |12−10| = 2, inside the |delta| baseline spread (~[3,3,3,3,12])
          context: { timeRange: WINDOW, previousValue: 10 },
        });

      expect(res.status).toBe(200);
      expect(res.body.isStatisticallySignificant).toBe(false);
      expect(res.body.tokenCostSaved).toBe(true);
      expect(res.body.generationId).toBe('none');
      expect(typeof res.body.zScore).toBe('number');
      expect(res.body.pValue).toBeGreaterThanOrEqual(0.05);
      expect(typeof res.body.explanation).toBe('string');
      expect(res.body.explanation).toContain('within standard historical variance');
      expect(explainSpy).not.toHaveBeenCalled();
    });
  });

  describe('AC3: significant shifts decompose root-cause factors into the prompt', () => {
    it('a delta far outside variance proceeds, returns factorDecomposition, and injects factors into the rendered prompt', async () => {
      const tenant = await createTenantFixture(`T-17.5-sig-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });
      await seedDailyPosts(tenant.id, 30, BASELINE_END);
      await seedWindowPosts(tenant.id, WINDOW.start, 60, 'twitter');
      const explainSpy = await setupActiveOpenAi(tenant.id);

      const res = await request(app)
        .post('/v1/explain')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({
          metricKey: 'total-mentions',
          value: 500, // |500−100| = 400 — far outside the baseline delta spread
          context: { timeRange: WINDOW, previousValue: 100 },
        });

      expect(res.status).toBe(200);
      expect(res.body.isStatisticallySignificant).toBe(true);
      expect(res.body.pValue).toBeLessThan(0.05);
      expect(res.body.tokenCostSaved).toBe(false);
      expect(res.body.factorDecomposition).toMatchObject({
        volumeDeltaPercent: 400,
        dominantPlatform: 'twitter',
      });
      expect(typeof res.body.factorDecomposition.sentimentShiftContribution).toBe('number');
      expect(typeof res.body.factorDecomposition.topAuthorImpactRatio).toBe('number');
      expect(typeof res.body.factorDecomposition.topContributingTopic).toBe('string');
      expect(explainSpy).toHaveBeenCalledTimes(1);
      const [prompt] = explainSpy.mock.calls[0] as [string];
      expect(prompt).toContain('volumeDeltaPercent');
    });
  });

  describe('AC4: insufficient history (<7 samples) defaults the gate open', () => {
    it('a tenant with 3 days of history proceeds to generation', async () => {
      const tenant = await createTenantFixture(`T-17.5-thin-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });
      await seedDailyPosts(tenant.id, 3, BASELINE_END);
      const explainSpy = await setupActiveOpenAi(tenant.id);

      const res = await request(app)
        .post('/v1/explain')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({
          metricKey: 'total-mentions',
          value: 12,
          context: { timeRange: WINDOW, previousValue: 10 },
        });

      expect(res.status).toBe(200);
      expect(res.body.isStatisticallySignificant).toBe(true);
      expect(res.body.tokenCostSaved).toBe(false);
      expect(explainSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC5: the gate is tenant-scoped', () => {
    it('tenant B with its own thin history is not gated by tenant A deep baseline', async () => {
      const tenantA = await createTenantFixture(`T-17.5-A-${randomUUID()}`);
      const tenantB = await createTenantFixture(`T-17.5-B-${randomUUID()}`);
      const userB = await createInvitedUser(tenantB.id, { email: `u-${randomUUID()}@example.com` });
      await seedDailyPosts(tenantA.id, 30, BASELINE_END); // A has deep history
      await seedDailyPosts(tenantB.id, 2, BASELINE_END);  // B has 2 days → gate open
      const explainSpy = await setupActiveOpenAi(tenantB.id);

      const res = await request(app)
        .post('/v1/explain')
        .set('X-Test-Identity', testIdentityHeaderValue(tenantB.id, { userId: userB.id }))
        .send({
          metricKey: 'total-mentions',
          value: 12,
          context: { timeRange: WINDOW, previousValue: 10 },
        });

      expect(res.status).toBe(200);
      expect(res.body.isStatisticallySignificant).toBe(true); // B's own baseline is too thin to gate
      expect(explainSpy).toHaveBeenCalled();
    });
  });
});
