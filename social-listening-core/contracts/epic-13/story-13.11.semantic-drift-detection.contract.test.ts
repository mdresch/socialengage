/**
 * Contract: Story 13.11 (ADR-0116, BRD-0116, FDD-0116) — Semantic drift detection.
 * See docs/user-stories/epic-13-adr-0109-to-0117.md#story-1311
 *
 * Intent:
 *   Add a tenant-scoped `SemanticDriftService` that compares two time windows of
 *   RAG chunks for a topic, computes centroid drift using cosine distance, runs
 *   a simple clustering per window to produce `topClustersNow/Then`, and caches
 *   the expensive result in `semantic_drift_cache` for 24 hours. Expose the work
 *   through `GET /v1/topics/:id/drift?start=...&end=...` mounted on the existing
 *   topics router.
 *
 * Scope:
 *   - social-listening-core/migrations/0071_create_semantic_drift_cache.sql
 *   - social-listening-core/src/rag/semanticDriftService.ts (new)
 *   - social-listening-core/src/http/versions/v1/topicsRouter.ts
 *   - social-listening-core/contracts/epic-13/story-13.11.semantic-drift-detection.contract.test.ts
 *   - social-listening-core/.claude/skills/semantic-drift/SKILL.md (new)
 *   - social-listening-core/.claude/skills/topic-evolution/SKILL.md (update)
 *
 * Contract to encode:
 *   (1) `GET /v1/topics/:id/drift` returns a `DriftResult` with `topicId`,
 *       `start`, `end`, `driftScore` in [0,1], `warning`, `topClustersNow/Then`,
 *       and `samplePostsNow/Then`.
 *   (2) Centroid drift is computed from the RAG chunks in the two windows;
 *       `driftScore >= 0.5` produces `warning: 'significant'`.
 *   (3) `driftScore < 0.2` for two windows with nearly identical content
 *       produces `warning: 'none'`.
 *   (4) Each window is clustered and `topClustersNow/Then` are returned as
 *       human-readable labels.
 *   (5) `samplePostsNow/Then` contain representative chunk text from the
 *       top clusters.
 *   (6) Identical requests within 24 hours are served from `semantic_drift_cache`
 *       (observable through a `cacheHit` flag and cache table row).
 *   (7) The cache row has an `expires_at` roughly 24 hours after creation.
 *   (8) Cross-tenant isolation: requesting drift for another tenant's topic
 *       returns 404; a different tenant with the same topic name does not
 *       receive the first tenant's cached result.
 *   (9) Missing or unparseable `start`/`end` returns 400; unknown topic returns 404.
 *   (10) The endpoint is read-only: no topic or post rows are mutated.
 *
 * Explicitly out of scope:
 *   - Real HDBSCAN or heavy k-means clustering (a lightweight, deterministic
 *     word-frequency clustering is sufficient for this pass).
 *   - UI integration with the Topic Evolution Timeline (Story 13.12) or
 *     `RAGAsk` drift explanation (ADR-0084).
 *   - Pre-computation or scheduled drift jobs.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { findOrCreateTopic } from '../../src/topics/topicStore';
import { generateMockEmbedding } from '../../src/rag/ragChunkingService';
import { PgvectorRAGConnector } from '../../src/rag/pgvectorConnector';

jest.setTimeout(30000);

const app = createApp();

afterAll(async () => {
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

function tenantUserHeader(tenantId: string, userId: string): string {
  return testIdentityHeaderValue(tenantId, { userId, role: 'tenant_user' });
}

async function seedTenant(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

async function createPost(
  tenantId: string,
  publishedAt: string,
  bodyMarkdown: string
): Promise<string> {
  const postId = randomUUID();
  const rawPayload = JSON.stringify({
    providerId: 'gnews',
    externalId: randomUUID(),
    title: 'Drift fixture',
  });

  await getAdminPool().query(
    `INSERT INTO social_posts (
      id, tenant_id, raw_payload, author_id, acquisition_id, acquisition_started_at,
      post_geo_location, published_at, enrichment, author_follower_count_at_publish,
      body_markdown, body_markdown_version, created_at
    ) VALUES ($1, $2, $3, NULL, $4, NULL, NULL, $5, NULL, NULL, $6, 1, $5)`,
    [postId, tenantId, rawPayload, randomUUID(), publishedAt, bodyMarkdown]
  );

  return postId;
}

async function indexRAGChunks(
  tenantId: string,
  postId: string,
  publishedAt: string,
  contents: string[]
): Promise<void> {
  const connector = new PgvectorRAGConnector(1536);
  const chunks = contents.map((content, index) => ({
    id: `${tenantId}:${postId}:${index}`,
    values: generateMockEmbedding(content, 1536),
    metadata: {
      tenant_id: tenantId,
      post_id: postId,
      chunk_index: index,
      content,
      platform_id: 'gnews',
      published_at: publishedAt,
      watchlist_ids: [],
      sentiment: 'neutral',
      topics: [],
    },
  }));

  await connector.upsert(tenantId, chunks);
}

async function seedTopicWithDriftWindow(
  tenantId: string,
  topicName: string,
  thenContents: { publishedAt: string; bodyMarkdown: string; chunks: string[] }[],
  nowContents: { publishedAt: string; bodyMarkdown: string; chunks: string[] }[]
): Promise<{ topicId: string; start: string; end: string }> {
  const topic = await findOrCreateTopic(tenantId, topicName);

  for (const fixture of thenContents) {
    const postId = await createPost(tenantId, fixture.publishedAt, fixture.bodyMarkdown);
    await getAdminPool().query(
      `INSERT INTO post_topics (post_id, topic_id, tenant_id, confidence, extracted_at)
       VALUES ($1, $2, $3, 1.0, now())`,
      [postId, topic.id, tenantId]
    );
    await indexRAGChunks(tenantId, postId, fixture.publishedAt, fixture.chunks);
  }

  for (const fixture of nowContents) {
    const postId = await createPost(tenantId, fixture.publishedAt, fixture.bodyMarkdown);
    await getAdminPool().query(
      `INSERT INTO post_topics (post_id, topic_id, tenant_id, confidence, extracted_at)
       VALUES ($1, $2, $3, 1.0, now())`,
      [postId, topic.id, tenantId]
    );
    await indexRAGChunks(tenantId, postId, fixture.publishedAt, fixture.chunks);
  }

  const start = thenContents[0].publishedAt;
  const end = new Date(new Date(nowContents[nowContents.length - 1].publishedAt).getTime() + 24 * 60 * 60 * 1000).toISOString();

  return { topicId: topic.id, start, end };
}

async function getCacheRow(tenantId: string, topicId: string, start: string, end: string): Promise<Record<string, unknown> | null> {
  const { rows } = await getAdminPool().query(
    `SELECT * FROM semantic_drift_cache
     WHERE tenant_id = $1 AND topic_id = $2 AND start_window = $3 AND end_window = $4
     ORDER BY created_at DESC LIMIT 1`,
    [tenantId, topicId, start, end]
  );
  return rows.length > 0 ? rows[0] : null;
}

describe('Story 13.11 — Semantic drift detection (GET /v1/topics/:id/drift)', () => {
  it('AC1: returns a DriftResult with all required fields and valid driftScore', async () => {
    const tenant = await seedTenant(`T-13.11-ac1-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const { topicId, start, end } = await seedTopicWithDriftWindow(
      tenant.id,
      'Swift',
      [
        {
          publishedAt: '2026-08-01T12:00:00Z',
          bodyMarkdown: 'Taylor Swift singer music',
          chunks: ['taylor swift singer singer music', 'concert singer singer performance'],
        },
      ],
      [
        {
          publishedAt: '2026-08-03T12:00:00Z',
          bodyMarkdown: 'Swift programming language coding',
          chunks: ['swift programming language coding coding', 'development coding coding software'],
        },
      ]
    );

    const res = await request(app)
      .get(`/v1/topics/${topicId}/drift`)
      .query({ start, end })
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      topicId,
      start: expect.any(String),
      end: expect.any(String),
      driftScore: expect.any(Number),
      warning: expect.stringMatching(/^(none|mild|significant)$/),
      topClustersNow: expect.any(Array),
      topClustersThen: expect.any(Array),
      samplePostsNow: expect.any(Array),
      samplePostsThen: expect.any(Array),
      cacheHit: false,
    });

    expect(res.body.driftScore).toBeGreaterThanOrEqual(0);
    expect(res.body.driftScore).toBeLessThanOrEqual(1);
  });

  it('AC2: driftScore >= 0.5 produces warning: significant for semantically different windows', async () => {
    const tenant = await seedTenant(`T-13.11-ac2-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const { topicId, start, end } = await seedTopicWithDriftWindow(
      tenant.id,
      'Swift',
      [
        {
          publishedAt: '2026-08-01T12:00:00Z',
          bodyMarkdown: 'Taylor Swift singer music',
          chunks: ['taylor swift singer singer music', 'concert singer singer performance'],
        },
      ],
      [
        {
          publishedAt: '2026-08-03T12:00:00Z',
          bodyMarkdown: 'Swift programming language coding',
          chunks: ['swift programming language coding coding', 'development coding coding software'],
        },
      ]
    );

    const res = await request(app)
      .get(`/v1/topics/${topicId}/drift`)
      .query({ start, end })
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id));

    expect(res.status).toBe(200);
    expect(res.body.driftScore).toBeGreaterThanOrEqual(0.5);
    expect(res.body.warning).toBe('significant');
  });

  it('AC3: driftScore < 0.2 produces warning: none for two windows with identical meaning', async () => {
    const tenant = await seedTenant(`T-13.11-ac3-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const sameChunks = ['taylor swift singer singer music', 'concert singer singer performance'];

    const { topicId, start, end } = await seedTopicWithDriftWindow(
      tenant.id,
      'Swift',
      [
        {
          publishedAt: '2026-08-01T12:00:00Z',
          bodyMarkdown: 'Taylor Swift singer music',
          chunks: sameChunks,
        },
      ],
      [
        {
          publishedAt: '2026-08-03T12:00:00Z',
          bodyMarkdown: 'Taylor Swift singer music',
          chunks: sameChunks,
        },
      ]
    );

    const res = await request(app)
      .get(`/v1/topics/${topicId}/drift`)
      .query({ start, end })
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id));

    expect(res.status).toBe(200);
    expect(res.body.driftScore).toBeLessThan(0.2);
    expect(res.body.warning).toBe('none');
  });

  it('AC4: each window is clustered and top cluster labels are returned', async () => {
    const tenant = await seedTenant(`T-13.11-ac4-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const { topicId, start, end } = await seedTopicWithDriftWindow(
      tenant.id,
      'Swift',
      [
        {
          publishedAt: '2026-08-01T12:00:00Z',
          bodyMarkdown: 'Taylor Swift singer music',
          chunks: ['taylor swift singer singer music', 'concert singer singer performance'],
        },
      ],
      [
        {
          publishedAt: '2026-08-03T12:00:00Z',
          bodyMarkdown: 'Swift programming language coding',
          chunks: ['swift programming language coding coding', 'development coding coding software'],
        },
      ]
    );

    const res = await request(app)
      .get(`/v1/topics/${topicId}/drift`)
      .query({ start, end })
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id));

    expect(res.status).toBe(200);
    expect(res.body.topClustersThen.length).toBeGreaterThanOrEqual(1);
    expect(res.body.topClustersNow.length).toBeGreaterThanOrEqual(1);
    expect(res.body.topClustersThen.every((label: unknown) => typeof label === 'string' && label.length > 0)).toBe(true);
    expect(res.body.topClustersNow.every((label: unknown) => typeof label === 'string' && label.length > 0)).toBe(true);
    expect(res.body.topClustersThen).toContain('singer');
    expect(res.body.topClustersNow).toContain('coding');
  });

  it('AC5: samplePostsNow/Then contain representative chunk text', async () => {
    const tenant = await seedTenant(`T-13.11-ac5-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const thenChunks = ['taylor swift singer singer music', 'concert singer singer performance'];
    const nowChunks = ['swift programming language coding coding', 'development coding coding software'];

    const { topicId, start, end } = await seedTopicWithDriftWindow(
      tenant.id,
      'Swift',
      [
        {
          publishedAt: '2026-08-01T12:00:00Z',
          bodyMarkdown: 'Taylor Swift singer music',
          chunks: thenChunks,
        },
      ],
      [
        {
          publishedAt: '2026-08-03T12:00:00Z',
          bodyMarkdown: 'Swift programming language coding',
          chunks: nowChunks,
        },
      ]
    );

    const res = await request(app)
      .get(`/v1/topics/${topicId}/drift`)
      .query({ start, end })
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id));

    expect(res.status).toBe(200);
    expect(res.body.samplePostsThen.length).toBeGreaterThanOrEqual(1);
    expect(res.body.samplePostsNow.length).toBeGreaterThanOrEqual(1);
    expect(res.body.samplePostsThen.every((p: unknown) => typeof p === 'string' && p.length > 0)).toBe(true);
    expect(res.body.samplePostsNow.every((p: unknown) => typeof p === 'string' && p.length > 0)).toBe(true);
    expect(thenChunks.some((c) => res.body.samplePostsThen.includes(c))).toBe(true);
    expect(nowChunks.some((c) => res.body.samplePostsNow.includes(c))).toBe(true);
  });

  it('AC6: identical requests within 24 hours return the cached result', async () => {
    const tenant = await seedTenant(`T-13.11-ac6-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const { topicId, start, end } = await seedTopicWithDriftWindow(
      tenant.id,
      'Swift',
      [
        {
          publishedAt: '2026-08-01T12:00:00Z',
          bodyMarkdown: 'Taylor Swift singer music',
          chunks: ['taylor swift singer singer music', 'concert singer singer performance'],
        },
      ],
      [
        {
          publishedAt: '2026-08-03T12:00:00Z',
          bodyMarkdown: 'Swift programming language coding',
          chunks: ['swift programming language coding coding', 'development coding coding software'],
        },
      ]
    );

    const first = await request(app)
      .get(`/v1/topics/${topicId}/drift`)
      .query({ start, end })
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id));

    expect(first.status).toBe(200);
    expect(first.body.cacheHit).toBe(false);

    const second = await request(app)
      .get(`/v1/topics/${topicId}/drift`)
      .query({ start, end })
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id));

    expect(second.status).toBe(200);
    expect(second.body.cacheHit).toBe(true);
    expect(second.body.driftScore).toBe(first.body.driftScore);
    expect(second.body.topClustersNow).toEqual(first.body.topClustersNow);
    expect(second.body.topClustersThen).toEqual(first.body.topClustersThen);
    expect(second.body.samplePostsNow).toEqual(first.body.samplePostsNow);
    expect(second.body.samplePostsThen).toEqual(first.body.samplePostsThen);
  });

  it('AC7: cache entry expires after 24 hours and is recomputed when stale', async () => {
    const tenant = await seedTenant(`T-13.11-ac7-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const { topicId, start, end } = await seedTopicWithDriftWindow(
      tenant.id,
      'Swift',
      [
        {
          publishedAt: '2026-08-01T12:00:00Z',
          bodyMarkdown: 'Taylor Swift singer music',
          chunks: ['taylor swift singer singer music', 'concert singer singer performance'],
        },
      ],
      [
        {
          publishedAt: '2026-08-03T12:00:00Z',
          bodyMarkdown: 'Swift programming language coding',
          chunks: ['swift programming language coding coding', 'development coding coding software'],
        },
      ]
    );

    const first = await request(app)
      .get(`/v1/topics/${topicId}/drift`)
      .query({ start, end })
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id));

    expect(first.status).toBe(200);

    await getAdminPool().query(
      `UPDATE semantic_drift_cache SET expires_at = now() - interval '1 second' WHERE tenant_id = $1 AND topic_id = $2`,
      [tenant.id, topicId]
    );

    const second = await request(app)
      .get(`/v1/topics/${topicId}/drift`)
      .query({ start, end })
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id));

    expect(second.status).toBe(200);
    expect(second.body.cacheHit).toBe(false);
  });

  it('AC8: cache row is created with a 24-hour TTL', async () => {
    const tenant = await seedTenant(`T-13.11-ac8-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const { topicId, start, end } = await seedTopicWithDriftWindow(
      tenant.id,
      'Swift',
      [
        {
          publishedAt: '2026-08-01T12:00:00Z',
          bodyMarkdown: 'Taylor Swift singer music',
          chunks: ['taylor swift singer singer music'],
        },
      ],
      [
        {
          publishedAt: '2026-08-03T12:00:00Z',
          bodyMarkdown: 'Swift programming language coding',
          chunks: ['swift programming language coding coding'],
        },
      ]
    );

    const res = await request(app)
      .get(`/v1/topics/${topicId}/drift`)
      .query({ start, end })
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id));

    expect(res.status).toBe(200);

    const row = await getCacheRow(tenant.id, topicId, start, end);
    expect(row).not.toBeNull();
    const expiresAt = new Date(row!.expires_at as string);
    const createdAt = new Date(row!.created_at as string);
    const ttlSeconds = (expiresAt.getTime() - createdAt.getTime()) / 1000;
    expect(ttlSeconds).toBeGreaterThanOrEqual(86390);
    expect(ttlSeconds).toBeLessThanOrEqual(86410);
  });

  it('AC9: cross-tenant request returns 404 and cannot see another tenant cache', async () => {
    const tenantA = await seedTenant(`T-13.11-A-${randomUUID()}`);
    const userA = await createInvitedUser(tenantA.id, { email: `u-${randomUUID()}@example.com` });

    const tenantB = await seedTenant(`T-13.11-B-${randomUUID()}`);
    const userB = await createInvitedUser(tenantB.id, { email: `u-${randomUUID()}@example.com` });

    const { topicId: topicA, start, end } = await seedTopicWithDriftWindow(
      tenantA.id,
      'Swift',
      [
        {
          publishedAt: '2026-08-01T12:00:00Z',
          bodyMarkdown: 'Taylor Swift singer music',
          chunks: ['taylor swift singer singer music', 'concert singer singer performance'],
        },
      ],
      [
        {
          publishedAt: '2026-08-03T12:00:00Z',
          bodyMarkdown: 'Swift programming language coding',
          chunks: ['swift programming language coding coding', 'development coding coding software'],
        },
      ]
    );

    // Tenant B has its own Swift topic.
    await findOrCreateTopic(tenantB.id, 'Swift');

    // First, compute drift for tenant A.
    const firstA = await request(app)
      .get(`/v1/topics/${topicA}/drift`)
      .query({ start, end })
      .set('X-Test-Identity', tenantUserHeader(tenantA.id, userA.id));
    expect(firstA.status).toBe(200);
    expect(firstA.body.cacheHit).toBe(false);

    // Tenant B asking for tenant A's topic id returns 404 and does not see A's cache.
    const cross = await request(app)
      .get(`/v1/topics/${topicA}/drift`)
      .query({ start, end })
      .set('X-Test-Identity', tenantUserHeader(tenantB.id, userB.id));
    expect(cross.status).toBe(404);

    // Tenant B computing drift on its own (same-named) topic is a cache miss.
    const topicB = (await findOrCreateTopic(tenantB.id, 'Swift')).id;
    const forB = await request(app)
      .get(`/v1/topics/${topicB}/drift`)
      .query({ start, end })
      .set('X-Test-Identity', tenantUserHeader(tenantB.id, userB.id));
    expect(forB.status).toBe(200);
    expect(forB.body.cacheHit).toBe(false);
  });

  it('AC10: missing or invalid start/end returns 400', async () => {
    const tenant = await seedTenant(`T-13.11-ac10-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });
    const topic = await findOrCreateTopic(tenant.id, 'Swift');

    const missingStart = await request(app)
      .get(`/v1/topics/${topic.id}/drift`)
      .query({ end: '2026-08-03T00:00:00Z' })
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id));
    expect(missingStart.status).toBe(400);

    const missingEnd = await request(app)
      .get(`/v1/topics/${topic.id}/drift`)
      .query({ start: '2026-08-01T00:00:00Z' })
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id));
    expect(missingEnd.status).toBe(400);

    const invalid = await request(app)
      .get(`/v1/topics/${topic.id}/drift`)
      .query({ start: 'not-a-date', end: '2026-08-03T00:00:00Z' })
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id));
    expect(invalid.status).toBe(400);
  });

  it('AC11: unknown topic id returns 404', async () => {
    const tenant = await seedTenant(`T-13.11-ac11-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const res = await request(app)
      .get(`/v1/topics/${randomUUID()}/drift`)
      .query({ start: '2026-08-01T00:00:00Z', end: '2026-08-03T00:00:00Z' })
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id));

    expect(res.status).toBe(404);
  });
});
