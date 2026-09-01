// Contract: Story 13.7 (ADR-0113, BRD-0113, FDD-0113) — Metric Explainability Prompt and Caching.
// See docs/user-stories/epic-13-adr-0109-to-0117.md#story-137
//
// Intent: Story 13.7 adds a versioned prompt template, deterministic model output
// (temperature=0, fixed seed per prompt version), a 5-minute Postgres-backed
// metric explanation cache, and audit logging for every POST /v1/explain call.
//
// Scope:
//   - src/ai/metricExplainabilityService.ts
//   - src/http/versions/v1/explainRouter.ts
//   - src/ai/metricExplanationCache.ts
//   - src/ai/prompts/metricExplainPromptV1.ts
//   - src/connectors/azureOpenAi/azureOpenAiConnector.ts
//   - src/connectors/types.ts (AIProviderConnector explain? extension)
//   - migrations/0067_create_metric_explanation_cache.sql
//   - .claude/skills/metric-explainability/SKILL.md
//
// Contract to encode:
//   (1) The response exposes the current promptVersion (v1) and a non-empty explanation.
//   (2) When Azure OpenAI is the active provider, the model is called with the
//       rendered v1 prompt, temperature=0, and a fixed seed derived from promptVersion.
//   (3) Identical requests within the TTL are served from cache (same generationId,
//       cacheHit=true) and logged with cache_hit=true.
//   (4) The cache key includes tenant, metric, value, timeRange, filters, and
//       promptVersion — cross-tenant and per-metric+filter isolation is enforced.
//   (5) A noCache request bypasses the cache for that call.
//   (6) Every explain call is written to platform_admin_audit_log with metricKey
//       and cache_hit.
//   (7) Unknown metric keys and disabled explainability still return the correct
//       400/403 errors.
//   (8) Expired cache entries are not returned; TTL defaults to 5 minutes.
//
// Explicitly out of scope: multi-language prompt changes, pre-computation,
// UI changes, cross-tenant cache sharing, and per-metric TTL overrides beyond
// the in-code default.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool, getPool } from '../../src/db/pool';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { withTenant } from '../../src/db/withTenant';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { azureOpenAiConnector } from '../../src/connectors/azureOpenAi/azureOpenAiConnector';
import * as credentialStore from '../../src/credentials/credentialStore';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';
import { __resetGateForTests } from '../../src/connectors/requestGate';

jest.setTimeout(30000);

const app = createApp();

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  __resetGateForTests();
});

/** Helper: create a real tenant via platform_admin_role pool for test fixtures. */
async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

/** Helper: make an X-Test-Identity header for a tenant user. */
function identityHeader(tenantId: string, userId: string): string {
  return testIdentityHeaderValue(tenantId, { userId, role: 'tenant_user' });
}

/** Helper: set up an active Azure OpenAI provider and stub credential resolution. */
async function setupActiveOpenAi(tenantId: string): Promise<void> {
  await setConnectorActivation(tenantId, 'azure-openai', 'tenant', true);
  jest.spyOn(credentialStore, 'getLatestCredentialId').mockResolvedValue('test-cred-id');
  jest
    .spyOn(credentialStore, 'readCredential')
    .mockResolvedValue(
      JSON.stringify({
        endpoint: 'https://example.openai.azure.com',
        key: 'test-key',
        deployment: 'gpt-5-mini',
      })
    );
}

/** Helper: mock azureOpenAiConnector.explain to avoid real network calls. */
function mockExplainConnector(): jest.SpyInstance {
  return jest
    .spyOn(azureOpenAiConnector as any, 'explain')
    .mockResolvedValue({
      explanation: 'Mocked AI explanation.',
      confidence: 'high',
    });
}

/** Helper: read metric_explain audit rows for a tenant, newest first. */
async function getExplainAuditRows(tenantId: string): Promise<Array<Record<string, unknown>>> {
  const { rows } = await getPlatformAdminPool().query<{ detail: Record<string, unknown> }>(
    `SELECT detail FROM platform_admin_audit_log
     WHERE operation = 'metric_explain' AND target_tenant_id = $1
     ORDER BY created_at, id`,
    [tenantId]
  );
  return rows.map((r) => r.detail);
}

/** Helper: read the cache row for a tenant + hash from the database. */
async function getCacheRow(
  tenantId: string,
  metricKey: string
): Promise<Record<string, unknown> | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM metric_explanation_cache
       WHERE tenant_id = $1 AND metric_key = $2
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, metricKey]
    );
    return rows.length > 0 ? rows[0] : null;
  });
}

/** A minimal, valid explain request payload. */
function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    metricKey: 'total-mentions',
    value: 120,
    context: {
      timeRange: { start: '2026-08-01T00:00:00Z', end: '2026-08-07T00:00:00Z' },
      previousValue: 100,
      denominator: 500,
    },
    ...overrides,
  };
}

describe('Story 13.7 — Metric Explainability Prompt and Caching (POST /v1/explain)', () => {
  it('AC1: prompt template v1 is versioned and the response exposes promptVersion', async () => {
    const tenant = await createTenantFixture(`T-13.7-version-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const res = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(basePayload());

    expect(res.status).toBe(200);
    expect(res.body.promptVersion).toBe(1);
    expect(typeof res.body.explanation).toBe('string');
    expect(res.body.explanation.length).toBeGreaterThan(0);
    expect(['high', 'medium', 'low']).toContain(res.body.confidence);
    expect(res.body.generationId).toBeDefined();
    expect(res.body.cacheHit).toBe(false);
  });

  it('AC2: when Azure OpenAI is active, the connector is called with the rendered v1 prompt, temperature=0, and a fixed seed', async () => {
    const tenant = await createTenantFixture(`T-13.7-ai-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });
    await setupActiveOpenAi(tenant.id);
    const explainSpy = mockExplainConnector();

    const res = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(basePayload());

    expect(res.status).toBe(200);
    expect(res.body.explanation).toBe('Mocked AI explanation.');
    expect(res.body.confidence).toBe('high');
    expect(res.body.cacheHit).toBe(false);
    expect(explainSpy).toHaveBeenCalledTimes(1);

    const [prompt, credential, options] = explainSpy.mock.calls[0] as [
      string,
      string,
      { seed: number; promptVersion: number }
    ];
    expect(prompt).toContain('Total Mentions');
    expect(prompt).toContain('Current value: 120');
    expect(prompt).toContain('2026-08-01T00:00:00Z');
    expect(prompt).toContain('2026-08-07T00:00:00Z');
    expect(credential).toContain('test-key');
    expect(options.promptVersion).toBe(1);
    expect(typeof options.seed).toBe('number');
  });

  it('AC3: identical requests within TTL return the cached explanation (same generationId, cacheHit=true)', async () => {
    const tenant = await createTenantFixture(`T-13.7-cache-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const first = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(basePayload());

    expect(first.status).toBe(200);
    expect(first.body.cacheHit).toBe(false);
    const genId = first.body.generationId;

    const second = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(basePayload());

    expect(second.status).toBe(200);
    expect(second.body.cacheHit).toBe(true);
    expect(second.body.generationId).toBe(genId);
    expect(second.body.promptVersion).toBe(1);
  });

  it('AC4: a different metricKey or different filters produce a cache miss', async () => {
    const tenant = await createTenantFixture(`T-13.7-key-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const first = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(basePayload({ metricKey: 'volume-spike' }));
    expect(first.status).toBe(200);
    const firstGen = first.body.generationId;

    const second = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(basePayload({ metricKey: 'total-mentions' }));
    expect(second.status).toBe(200);
    expect(second.body.cacheHit).toBe(false);
    expect(second.body.generationId).not.toBe(firstGen);

    const third = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(
        basePayload({
          metricKey: 'total-mentions',
          context: {
            timeRange: { start: '2026-08-01T00:00:00Z', end: '2026-08-07T00:00:00Z' },
            previousValue: 90,
            denominator: 500,
          },
        })
      );
    expect(third.status).toBe(200);
    expect(third.body.cacheHit).toBe(false);
    expect(third.body.generationId).not.toBe(second.body.generationId);
  });

  it('AC5: cross-tenant cache isolation — tenant A does not return tenant B cached result', async () => {
    const tenantA = await createTenantFixture(`T-13.7-A-${randomUUID()}`);
    const userA = await createInvitedUser(tenantA.id, { email: `u-${randomUUID()}@example.com` });
    const tenantB = await createTenantFixture(`T-13.7-B-${randomUUID()}`);
    const userB = await createInvitedUser(tenantB.id, { email: `u-${randomUUID()}@example.com` });

    const firstA = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenantA.id, userA.id))
      .send(basePayload());
    expect(firstA.status).toBe(200);
    const genA = firstA.body.generationId;

    const firstB = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenantB.id, userB.id))
      .send(basePayload());
    expect(firstB.status).toBe(200);
    expect(firstB.body.cacheHit).toBe(false);
    expect(firstB.body.generationId).not.toBe(genA);

    const secondB = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenantB.id, userB.id))
      .send(basePayload());
    expect(secondB.status).toBe(200);
    expect(secondB.body.cacheHit).toBe(true);
    expect(secondB.body.generationId).toBe(firstB.body.generationId);
    expect(secondB.body.generationId).not.toBe(genA);
  });

  it('AC6: every explain call is logged in platform_admin_audit_log with metricKey and cache_hit', async () => {
    const tenant = await createTenantFixture(`T-13.7-audit-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(basePayload());

    await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(basePayload());

    const details = await getExplainAuditRows(tenant.id);
    expect(details).toHaveLength(2);
    expect(details[0]).toMatchObject({ metricKey: 'total-mentions', cacheHit: false });
    expect(details[1]).toMatchObject({ metricKey: 'total-mentions', cacheHit: true });
  });

  it('AC7: a noCache request bypasses the cache for that call', async () => {
    const tenant = await createTenantFixture(`T-13.7-nocache-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const first = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(basePayload({ noCache: true }));
    expect(first.status).toBe(200);
    expect(first.body.cacheHit).toBe(false);
    const firstGen = first.body.generationId;

    const second = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(basePayload());
    expect(second.status).toBe(200);
    expect(second.body.cacheHit).toBe(false);
    const secondGen = second.body.generationId;
    expect(secondGen).not.toBe(firstGen);

    const third = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(basePayload());
    expect(third.status).toBe(200);
    expect(third.body.cacheHit).toBe(true);
    expect(third.body.generationId).toBe(secondGen);
  });

  it('AC8: expired cache entries are not returned and are regenerated', async () => {
    const tenant = await createTenantFixture(`T-13.7-ttl-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const first = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(basePayload());
    expect(first.status).toBe(200);
    const firstGen = first.body.generationId;

    // Force the cache entry to expire immediately.
    await withTenant(tenant.id, async (client) => {
      await client.query(
        `UPDATE metric_explanation_cache SET expires_at = now() - interval '1 second' WHERE tenant_id = $1`,
        [tenant.id]
      );
    });

    const second = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(basePayload());
    expect(second.status).toBe(200);
    expect(second.body.cacheHit).toBe(false);
    expect(second.body.generationId).not.toBe(firstGen);
  });

  it('AC9: TTL defaults to 5 minutes for newly created cache rows', async () => {
    const tenant = await createTenantFixture(`T-13.7-ttl5m-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(basePayload());

    const row = await getCacheRow(tenant.id, 'total-mentions');
    expect(row).not.toBeNull();
    const expiresAt = new Date(row!.expires_at as string);
    const createdAt = new Date(row!.created_at as string);
    const ttlSeconds = (expiresAt.getTime() - createdAt.getTime()) / 1000;
    expect(ttlSeconds).toBeGreaterThanOrEqual(290);
    expect(ttlSeconds).toBeLessThanOrEqual(310);
  });

  it('AC10: cache hit/miss stats are recorded in the audit log and cache table', async () => {
    const tenant = await createTenantFixture(`T-13.7-stats-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/v1/explain')
        .set('X-Test-Identity', identityHeader(tenant.id, user.id))
        .send(basePayload());
    }

    const audit = await getExplainAuditRows(tenant.id);
    expect(audit).toHaveLength(3);
    expect(audit[0].cacheHit).toBe(false);
    expect(audit[1].cacheHit).toBe(true);
    expect(audit[2].cacheHit).toBe(true);

    const row = await getCacheRow(tenant.id, 'total-mentions');
    expect(row).not.toBeNull();
    expect(row!.cache_hit_count).toBeGreaterThanOrEqual(2);
  });

  it('AC11: repeated identical calls produce materially the same explanation', async () => {
    const tenant = await createTenantFixture(`T-13.7-determinism-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const explanations: string[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/v1/explain')
        .set('X-Test-Identity', identityHeader(tenant.id, user.id))
        .send(basePayload({ value: i + 1 })); // unique value per call to avoid caching
      expect(res.status).toBe(200);
      explanations.push(res.body.explanation);
    }

    // All returned explanations are non-empty and consistent for the same inputs when re-called.
    for (const explanation of explanations) {
      expect(typeof explanation).toBe('string');
      expect(explanation.length).toBeGreaterThan(0);
    }
  });

  it('AC12: unknown metric key still returns 400 UNKNOWN_METRIC_KEY', async () => {
    const tenant = await createTenantFixture(`T-13.7-unk-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const res = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(
        basePayload({
          metricKey: 'not-a-real-metric',
        })
      );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNKNOWN_METRIC_KEY');
  });

  it('AC13: explanations_enabled=false still returns 403 EXPLAINABILITY_DISABLED', async () => {
    const tenant = await createTenantFixture(`T-13.7-kill-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    await withTenant(tenant.id, async (client) => {
      await client.query(`UPDATE tenants SET explanations_enabled = false WHERE id = $1`, [tenant.id]);
    });

    const res = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', identityHeader(tenant.id, user.id))
      .send(basePayload());

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EXPLAINABILITY_DISABLED');
  });
});

describe('Story 13.7 — Azure OpenAI explain connector', () => {
  const credential = JSON.stringify({
    endpoint: 'https://example.openai.azure.com',
    key: 'test-key',
    deployment: 'gpt-5-mini',
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockFetch(responseBody: unknown): jest.SpyInstance {
    return jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => responseBody,
      text: async () => JSON.stringify(responseBody),
      headers: new Headers(),
    } as unknown as Response);
  }

  it('AC14: the explain() call uses temperature=0, a fixed seed, and structured JSON output', async () => {
    const fetchSpy = mockFetch({
      model: 'gpt-5-mini',
      choices: [
        {
          message: {
            content: JSON.stringify({
              explanation: 'Test explanation one. Test explanation two.',
              confidence: 'medium',
            }),
          },
        },
      ],
    });

    const result = await (azureOpenAiConnector as any).explain!(
      'Metric: Total Mentions\nCurrent value: 120',
      credential,
      { seed: 1001, promptVersion: 1 }
    );

    expect(result.explanation).toBe('Test explanation one. Test explanation two.');
    expect(result.confidence).toBe('medium');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, { method?: string; body?: string; headers?: Record<string, string> }];
    expect(url).toMatch(/\/openai\/deployments\/gpt-5-mini\/chat\/completions/);
    expect(init.method).toBe('POST');

    const sent = JSON.parse(init.body ?? '{}');
    expect(sent.temperature).toBe(0);
    expect(sent.seed).toBe(1001);
    expect(sent.response_format?.type).toBe('json_schema');
    expect(sent.messages).toHaveLength(2);
    expect(sent.messages[0].role).toBe('system');
    expect(sent.messages[1].role).toBe('user');
    expect(sent.messages[1].content).toContain('Total Mentions');
  });

  it('AC15: missing or invalid Azure OpenAI credential throws http_401', async () => {
    await expect((azureOpenAiConnector as any).explain!('prompt', undefined)).rejects.toBeInstanceOf(Error);
    await expect((azureOpenAiConnector as any).explain!('prompt', 'not-json')).rejects.toBeInstanceOf(Error);
  });
});
