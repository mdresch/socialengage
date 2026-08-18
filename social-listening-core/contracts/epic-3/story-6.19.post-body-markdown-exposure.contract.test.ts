/**
 * Contract: Story 6.19 (Story 3.10/ADR-0053, against Story 6.11's post
 * detail screen) — expose the already-populated body_markdown column over
 * REST.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-619--render-the-post-detail-body-as-real-formatted-markdown
 *
 * Intent: Story 6.19 (core half) — SocialPostSummary/SocialPostFull gain
 * bodyMarkdown
 * Scope: src/posts/socialPostStore.ts (SocialPostSummary/SocialPostFull
 *   interfaces widened; queryFirstPage/queryAfterCursor/getSocialPostById
 *   queries widened to select body_markdown). No migration, no new query,
 *   no new endpoint — social_posts.body_markdown already exists and is
 *   already populated by all three real connectors' ingestX() functions
 *   (Story 3.10).
 * Contract to encode: GET /v1/posts and GET /v1/posts/:id both return a
 *   real, non-null bodyMarkdown for a post that has one stored; a post
 *   with no bodyMarkdown (predating Story 3.10, or any future connector
 *   that doesn't populate it) returns bodyMarkdown: null honestly, never
 *   omitted or defaulted to empty string.
 * Explicitly out of scope:
 *   - Any change to htmlToMarkdown()/Story 3.10's own conversion pipeline —
 *     already correct, already shipped; this story only exposes its
 *     existing output.
 *   - Cursor pagination correctness itself — Story 3.4's own contract
 *     already proves that; this contract only proves the new field rides
 *     along correctly.
 *   - Rendering bodyMarkdown as formatted HTML — that is
 *     social-listening-admin's own half of this story, a separate contract
 *     in that repo.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { createTenant } from '../../src/tenants/tenantStore';
import { startIngestionRun, completeIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { insertSocialPost } from '../../src/posts/socialPostStore';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';

jest.setTimeout(20000);

afterAll(async () => {
  await closePool();
});

describe('Story 6.19 — body_markdown exposed over GET /v1/posts and GET /v1/posts/:id', () => {
  const app = createApp();

  async function makeTenant() {
    const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 5 });
    return tenant.id;
  }

  it('GET /v1/posts returns a real, non-null bodyMarkdown for a post that has one stored', async () => {
    const tenantId = await makeTenant();
    const run = await startIngestionRun(tenantId, { platformId: 'gnews', triggerType: 'poll', connectorVersion: '1.0.0' });
    await insertSocialPost({
      tenantId,
      authorId: null,
      acquisitionId: run.id,
      rawPayload: { providerId: 'gnews', title: 'Real headline' },
      bodyMarkdown: '# Real Headline\n\nSome **bold** text and a [link](https://example.com).',
      bodyMarkdownVersion: 1,
    });
    await completeIngestionRun(tenantId, run.id, { status: 'succeeded', postsIngested: 1, postsSkipped: 0 });

    const res = await request(app)
      .get('/v1/posts')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: 'u-1', role: 'tenant_user' }));

    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0].bodyMarkdown).toBe('# Real Headline\n\nSome **bold** text and a [link](https://example.com).');
  });

  it('GET /v1/posts returns bodyMarkdown: null honestly for a post that never had one, never omitted or defaulted to empty string', async () => {
    const tenantId = await makeTenant();
    const run = await startIngestionRun(tenantId, { platformId: 'newswire', triggerType: 'poll', connectorVersion: '1.0.0' });
    await insertSocialPost({
      tenantId,
      authorId: null,
      acquisitionId: run.id,
      rawPayload: { providerId: 'newswire', title: 'No markdown here' },
    });
    await completeIngestionRun(tenantId, run.id, { status: 'succeeded', postsIngested: 1, postsSkipped: 0 });

    const res = await request(app)
      .get('/v1/posts')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: 'u-1', role: 'tenant_user' }));

    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0]).toHaveProperty('bodyMarkdown');
    expect(res.body.posts[0].bodyMarkdown).toBeNull();
  });

  it('GET /v1/posts/:id returns the same real bodyMarkdown value', async () => {
    const tenantId = await makeTenant();
    const run = await startIngestionRun(tenantId, { platformId: 'gnews', triggerType: 'poll', connectorVersion: '1.0.0' });
    const inserted = await insertSocialPost({
      tenantId,
      authorId: null,
      acquisitionId: run.id,
      rawPayload: { providerId: 'gnews', title: 'Detail view post' },
      bodyMarkdown: '## A real section header\n\n- one\n- two',
      bodyMarkdownVersion: 1,
    });
    await completeIngestionRun(tenantId, run.id, { status: 'succeeded', postsIngested: 1, postsSkipped: 0 });

    const res = await request(app)
      .get(`/v1/posts/${inserted.id}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: 'u-1', role: 'tenant_user' }));

    expect(res.status).toBe(200);
    expect(res.body.bodyMarkdown).toBe('## A real section header\n\n- one\n- two');
  });
});
