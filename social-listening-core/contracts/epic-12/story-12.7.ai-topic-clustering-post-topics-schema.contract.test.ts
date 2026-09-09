/**
 * Contract: Story 12.7 (ADR-0104, BRD-0104, FDD-0104) — AI topic clustering post-topics schema (backend).
 * See docs/user-stories/epic-12-adr-0101-to-0108.md#story-127--ai-topic-clustering-post-topics-schema-backend
 * and docs/adr/0104-ai-topic-clustering-post-topics-schema.md
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import {
  findOrCreateTopic,
  listTopics,
  getTopicById,
  renameTopic,
  mergeTopic,
  hideTopic,
  attachPostTopics,
  getPostTopics,
} from '../../src/topics/topicStore';
import { TopicClusteringRefresh } from '../../src/topics/topicClusteringService';

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

describe('Story 12.7 — AI topic clustering post-topics schema (backend)', () => {
  let tenant: { id: string };
  let otherTenant: { id: string };
  let user: { id: string };
  let testPostId: string;
  let app: any;

  beforeAll(async () => {
    tenant = await createTenantFixture(`Topic Test Tenant ${Date.now()}`);
    otherTenant = await createTenantFixture(`Other Topic Tenant ${Date.now()}`);
    user = await createInvitedUser(tenant.id, {
      email: `topic-user-${Date.now()}@example.com`,
    });
    testPostId = randomUUID();
    app = createApp();

    // Seed test social post - partitioned table requires WHERE NOT EXISTS instead of ON CONFLICT
    await withTenant(tenant.id, async (client) => {
      await client.query(
        `INSERT INTO social_posts (id, tenant_id, raw_payload)
         SELECT $1, $2, '{}'::jsonb
         WHERE NOT EXISTS (SELECT 1 FROM social_posts WHERE id = $1)`,
        [testPostId, tenant.id]
      );
    });
  });

  describe('AC1: topics and post_topics schema and RLS', () => {
    it('creates topics with slug, status, and tenant isolation', async () => {
      const topic = await findOrCreateTopic(tenant.id, 'Cloud Computing', 'All things cloud and infrastructure');
      expect(topic).toBeDefined();
      expect(topic.id).toBeDefined();
      expect(topic.tenant_id).toBe(tenant.id);
      expect(topic.name).toBe('Cloud Computing');
      expect(topic.slug).toBe('cloud-computing');
      expect(topic.status).toBe('active');

      // Check tenant isolation: other tenant cannot see this topic
      const otherTenantTopics = await listTopics(otherTenant.id);
      expect(otherTenantTopics.some((t) => t.id === topic.id)).toBe(false);
    });

    it('attaches post_topics with confidence scores', async () => {
      const attached = await attachPostTopics(tenant.id, testPostId, [
        { name: 'Cloud Computing', confidence: 0.95 },
        { name: 'Artificial Intelligence', confidence: 0.82 },
      ]);

      expect(attached.length).toBe(2);
      expect(attached[0].post_id).toBe(testPostId);
      expect(Number(attached[0].confidence)).toBe(0.95);

      const postTopics = await getPostTopics(tenant.id, testPostId);
      expect(postTopics.length).toBe(2);
      expect(postTopics.map((pt) => pt.topic_name).sort()).toEqual(
        ['Artificial Intelligence', 'Cloud Computing'].sort()
      );
    });
  });

  describe('AC2: Topic curation operations (rename, merge, hide)', () => {
    it('renames a topic and updates its slug', async () => {
      const topic = await findOrCreateTopic(tenant.id, 'Cyber Security');
      const renamed = await renameTopic(tenant.id, topic.id, 'Information Security');

      expect(renamed.name).toBe('Information Security');
      expect(renamed.slug).toBe('information-security');
    });

    it('hides a topic so it is excluded from default list', async () => {
      const topic = await findOrCreateTopic(tenant.id, 'Deprecated Framework');
      await hideTopic(tenant.id, topic.id);

      const activeTopics = await listTopics(tenant.id);
      expect(activeTopics.some((t) => t.id === topic.id)).toBe(false);

      const allTopics = await listTopics(tenant.id, { status: 'all' });
      expect(allTopics.some((t) => t.id === topic.id && t.status === 'hidden')).toBe(true);
    });

    it('merges a source topic into target and reassigns post_topics rows', async () => {
      const sourceTopic = await findOrCreateTopic(tenant.id, 'Kubernetes Deployment');
      const targetTopic = await findOrCreateTopic(tenant.id, 'Container Orchestration');

      // Attach post to source topic
      await attachPostTopics(tenant.id, testPostId, [{ name: 'Kubernetes Deployment', confidence: 0.88 }]);

      // Merge source into target
      const merged = await mergeTopic(tenant.id, sourceTopic.id, targetTopic.id);
      expect(merged.status).toBe('merged');
      expect(merged.merged_into_topic_id).toBe(targetTopic.id);

      // Verify post_topics rows now point to target
      const postTopics = await getPostTopics(tenant.id, testPostId);
      expect(postTopics.some((pt) => pt.topic_id === targetTopic.id)).toBe(true);
      expect(postTopics.some((pt) => pt.topic_id === sourceTopic.id)).toBe(false);
    });
  });

  describe('AC3: HTTP Endpoints (/v1/topics, rename, merge, hide)', () => {
    it('GET /v1/topics returns active topics with auth header', async () => {
      const res = await request(app)
        .get('/v1/topics')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .set('x-tenant-id', tenant.id);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.topics)).toBe(true);
      expect(res.body.topics.length).toBeGreaterThan(0);
    });

    it('POST /v1/topics/:id/rename updates topic name', async () => {
      const topic = await findOrCreateTopic(tenant.id, 'DevOps Tools');
      const res = await request(app)
        .post(`/v1/topics/${topic.id}/rename`)
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .set('x-tenant-id', tenant.id)
        .send({ name: 'Platform Engineering' });

      expect(res.status).toBe(200);
      expect(res.body.topic.name).toBe('Platform Engineering');
      expect(res.body.topic.slug).toBe('platform-engineering');
    });

    it('POST /v1/topics/:id/merge merges topic into target', async () => {
      const source = await findOrCreateTopic(tenant.id, 'Microservices Architecture');
      const target = await findOrCreateTopic(tenant.id, 'Distributed Systems');

      const res = await request(app)
        .post(`/v1/topics/${source.id}/merge`)
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .set('x-tenant-id', tenant.id)
        .send({ targetTopicId: target.id });

      expect(res.status).toBe(200);
      expect(res.body.topic.status).toBe('merged');
      expect(res.body.topic.merged_into_topic_id).toBe(target.id);
    });

    it('POST /v1/topics/:id/hide sets topic status to hidden', async () => {
      const topic = await findOrCreateTopic(tenant.id, 'Legacy Topic');
      const res = await request(app)
        .post(`/v1/topics/${topic.id}/hide`)
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .set('x-tenant-id', tenant.id);

      expect(res.status).toBe(200);
      expect(res.body.topic.status).toBe('hidden');
    });
  });

  describe('AC4: TopicClusteringRefresh rolling 7-day worker service', () => {
    it('executes rolling 7-day topic clustering refresh without error', async () => {
      const result = await TopicClusteringRefresh.run({ tenantId: tenant.id, windowDays: 7 });
      expect(result).toBeDefined();
      expect(typeof result.processedPosts).toBe('number');
      expect(typeof result.topicsAttached).toBe('number');
    });
  });
});
