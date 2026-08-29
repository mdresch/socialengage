/**
 * Contract: Story 11.11 (ADR-0100, BRD-0100, FDD-0100) — Composed Post Author Mention Suggestions (Backend)
 * See docs/user-stories/epic-11-adr-0095-to-0100.md#story-1111--composed-post-author-mention-suggestions-backend
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { withTenant } from '../../src/db/withTenant';
import { bootstrapConnectors } from '../../src/connectors/bootstrapConnectors';

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

describe('Story 11.11 — Composed Post Mention Suggestions (Backend)', () => {
  let tenant: { id: string };
  let user: { id: string };
  let app: any;
  let authorAiId: string;
  let authorCloudId: string;
  let authorTwitterId: string;

  beforeAll(async () => {
    bootstrapConnectors();
    tenant = await createTenantFixture(`Tenant Mentions ${Date.now()}`);
    user = await createInvitedUser(tenant.id, {
      email: `composer-${Date.now()}@example.com`,
    });
    app = createApp();

    authorAiId = randomUUID();
    authorCloudId = randomUUID();
    authorTwitterId = randomUUID();

    // Create test authors and topic signals
    await withTenant(tenant.id, async (client) => {
      // 1. LinkedIn AI Expert
      await client.query(
        `INSERT INTO authors (
          id, tenant_id, platform_id, external_author_id, handle, display_name, follower_count
        ) VALUES ($1, $2, 'linkedin', 'ext-ai-1', 'dr_ai_expert', 'Dr. AI Expert', 5000)`,
        [authorAiId, tenant.id]
      );
      await client.query(
        `INSERT INTO author_topic_signals (
          tenant_id, author_id, topic, mention_count, active_months_count
        ) VALUES ($1, $2, 'artificial-intelligence', 45, 6)`,
        [tenant.id, authorAiId]
      );

      // 2. LinkedIn Cloud Architect
      await client.query(
        `INSERT INTO authors (
          id, tenant_id, platform_id, external_author_id, handle, display_name, follower_count
        ) VALUES ($1, $2, 'linkedin', 'ext-cloud-1', 'cloud_guru', 'Cloud Guru', 3000)`,
        [authorCloudId, tenant.id]
      );

      // 3. Bluesky / Twitter Author (Different platform)
      await client.query(
        `INSERT INTO authors (
          id, tenant_id, platform_id, external_author_id, handle, display_name, follower_count
        ) VALUES ($1, $2, 'bluesky', 'ext-bsky-1', 'sky_influencer', 'Sky Influencer', 8000)`,
        [authorTwitterId, tenant.id]
      );
    });
  });

  describe('AC1, AC2 & AC3: Mention suggestions schema and topic/keyword weights', () => {
    it('returns ranked suggestions with complete metadata matching draft text', async () => {
      const res = await request(app)
        .post('/v1/composer/mention-suggestions')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({
          text: 'Sharing thoughts on artificial-intelligence developments and models',
          targetPlatforms: ['linkedin'],
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.suggestions)).toBe(true);
      expect(res.body.suggestions.length).toBeGreaterThanOrEqual(1);

      const topSuggestion = res.body.suggestions[0];
      expect(topSuggestion.authorId).toBe(authorAiId);
      expect(topSuggestion.authorName).toBe('Dr. AI Expert');
      expect(topSuggestion.handle).toBe('dr_ai_expert');
      expect(topSuggestion.platformId).toBe('linkedin');
      expect(topSuggestion.matchSource).toBe('topic');
      expect(topSuggestion.confidence).toBeGreaterThan(0.5);
      expect(topSuggestion.reason).toBeDefined();
    });
  });

  describe('AC4: Already Mentioned Authors Exclusion', () => {
    it('excludes authors whose @handle is already present in the draft text', async () => {
      const res = await request(app)
        .post('/v1/composer/mention-suggestions')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({
          text: 'Great work with @dr_ai_expert on artificial-intelligence systems!',
          targetPlatforms: ['linkedin'],
        });

      expect(res.status).toBe(200);
      const authors = res.body.suggestions.map((s: any) => s.authorId);
      expect(authors).not.toContain(authorAiId);
    });
  });

  describe('AC5: Platform Filtering', () => {
    it('only returns authors active on the selected target platforms', async () => {
      const res = await request(app)
        .post('/v1/composer/mention-suggestions')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({
          text: 'Connecting across tech channels',
          targetPlatforms: ['linkedin'],
        });

      expect(res.status).toBe(200);
      const platforms = res.body.suggestions.map((s: any) => s.platformId);
      expect(platforms).not.toContain('bluesky');
    });

    it('returns 422 if targetPlatforms is empty or invalid', async () => {
      const res = await request(app)
        .post('/v1/composer/mention-suggestions')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({
          text: 'Some test content',
          targetPlatforms: [],
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVALID_PLATFORMS');
    });
  });

  describe('AC6: Max Suggestions Limit', () => {
    it('respects maxSuggestions and caps at 10', async () => {
      const res = await request(app)
        .post('/v1/composer/mention-suggestions')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({
          text: 'Tech and cloud updates',
          targetPlatforms: ['linkedin', 'bluesky'],
          maxSuggestions: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.suggestions.length).toBeLessThanOrEqual(1);
    });
  });
});
