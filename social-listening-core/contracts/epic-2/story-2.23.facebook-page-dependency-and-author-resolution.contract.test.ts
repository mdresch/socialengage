// Contract: Story 2.23 (ADR-0067) — Facebook connector: Graph API `from` extraction,
// hosting Page post dependency, and two-tier author resolution.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-223
//
// Intent:
// 1. Widens FacebookPagePost with optional `from?: { id: string; name: string }`.
// 2. Widens fetchFacebookPagePosts() field list to include `from{id,name}`.
// 3. Establishes explicit hosting Page dependency by setting `rawPayload.pageId` and `rawPayload.pageName`.
// 4. Implements two-tier author resolution hierarchy:
//    - True Author (`from.name`): when `from.id` exists and `from.id !== pageMeta.id`, upserts/links author
//      `facebook:{from.id}` with `displayName = from.name`, setting `rawPayload.author = from.name` and `rawPayload.from = from`.
//    - Page Fallback: when `from` is absent or `from.id === pageMeta.id`, upserts/links author
//      `facebook:{pageMeta.id}` with `displayName = pageMeta.name`, setting `rawPayload.author = pageMeta.name`.
// 5. Preserves deduplication on (tenant_id, 'facebook', externalId) and emits post-ingested events.

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import {
  fetchFacebookPagePosts,
  FacebookPagePost,
} from '../../src/connectors/facebook/facebookConnector';
import { pollFacebookPage } from '../../src/connectors/facebook/pollFacebook';
import { getSocialPostById, findSocialPostByExternalId } from '../../src/posts/socialPostStore';
import { getAuthorById } from '../../src/authors/authorStore';
import type { FacebookConnectedPage } from '../../src/connectors/facebook/facebookConnectedPagesStore';
import * as facebookConnectorModule from '../../src/connectors/facebook/facebookConnector';
import * as credentialStore from '../../src/credentials/credentialStore';
import * as serviceBusPublisher from '../../src/events/serviceBusPublisher';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
  await closeAdminPool();
});

describe('Story 2.23 Contract: Facebook Graph API `from` extraction and two-tier author resolution (ADR-0067)', () => {
  let tenantId: string;
  let userId: string;
  let pageId: string;
  let credentialId: string;

  beforeAll(async () => {
    const { rows: tenantRows } = await getPlatformAdminPool().query<{ id: string }>(
      `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
      [`FB Author Test ${randomUUID().slice(0, 8)}`, 5]
    );
    tenantId = tenantRows[0].id;

    const { rows: userRows } = await getAdminPool().query<{ id: string }>(
      `INSERT INTO users (tenant_id, email, role, status) VALUES ($1, $2, 'tenant_user', 'active') RETURNING id`,
      [tenantId, `user-${randomUUID().slice(0, 8)}@example.com`]
    );
    userId = userRows[0].id;

    pageId = `page-${randomUUID().slice(0, 8)}`;
    credentialId = `cred-${randomUUID().slice(0, 8)}`;

    // Mock readCredential to return valid JSON credential
    jest.spyOn(credentialStore, 'readCredential').mockResolvedValue(
      JSON.stringify({
        pageId,
        pageAccessToken: 'EAAB_mock_token_123',
        pageName: 'Acme Official Page',
      })
    );

    // Mock publishEvent
    jest.spyOn(serviceBusPublisher, 'publishEvent').mockResolvedValue();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  function createConnectedPageMock(id: string): FacebookConnectedPage {
    const now = new Date().toISOString();
    return {
      id,
      tenantId,
      userId,
      pageId,
      pageName: 'Acme Official Page',
      credentialId,
      status: 'connected',
      createdAt: now,
      updatedAt: now,
    };
  }

  // -------------------------------------------------------------------------
  // AC1: Graph API fields parameter widening
  // -------------------------------------------------------------------------
  describe('AC1: Graph API request fields widening', () => {
    it('fetchFacebookPagePosts includes from{id,name} in the Graph API fields query parameter', async () => {
      let capturedUrl = '';
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: '123_456',
                message: 'Hello from Facebook',
                created_time: '2026-08-20T12:00:00Z',
                permalink_url: 'https://facebook.com/123_456',
                from: { id: 'user_789', name: 'Jane Doe' },
                reactions: { summary: { total_count: 10 } },
                comments: { summary: { total_count: 2 } },
                shares: { count: 1 },
              },
            ],
          }),
        } as unknown as Response;
      });

      try {
        const posts = await fetchFacebookPagePosts('mock_page_id', 'mock_token');
        expect(capturedUrl).toContain('from{id,name}');
        expect(posts).toHaveLength(1);
        expect(posts[0].from).toEqual({ id: 'user_789', name: 'Jane Doe' });
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // -------------------------------------------------------------------------
  // AC2, AC3 & AC4: Two-Tier Author Resolution & Hosting Page Dependency
  // -------------------------------------------------------------------------
  describe('AC2-AC4: Ingestion Two-Tier Author Resolution and Page Dependency', () => {
    it('ingests post with distinct from object, linking true author and recording hosting Page dependency', async () => {
      const distinctAuthorPost: FacebookPagePost = {
        id: `${pageId}_post_individual`,
        message: 'Community member post on Acme Page',
        created_time: '2026-08-20T14:00:00Z',
        permalink_url: `https://facebook.com/${pageId}/posts/101`,
        from: { id: 'member_999', name: 'John Specialist' },
      };

      jest.spyOn(facebookConnectorModule, 'fetchFacebookPagePosts').mockResolvedValue([distinctAuthorPost]);
      jest.spyOn(facebookConnectorModule, 'fetchFacebookPageMetadata').mockResolvedValue({
        id: pageId,
        name: 'Acme Official Page',
        fan_count: 5000,
      });

      const outcome = await pollFacebookPage(
        tenantId,
        userId,
        createConnectedPageMock(randomUUID())
      );

      expect(outcome.status).toBe('succeeded');

      // Verify post in database
      const found = await findSocialPostByExternalId(
        tenantId,
        'facebook',
        distinctAuthorPost.id
      );
      expect(found).toBeDefined();

      const post = await getSocialPostById(tenantId, found!.id);
      expect(post).toBeDefined();
      expect(post?.rawPayload).toBeDefined();

      const raw = post!.rawPayload as Record<string, unknown>;
      // Hosting Page Dependency
      expect(raw.pageId).toBe(pageId);
      expect(raw.pageName).toBe('Acme Official Page');

      // True Author Attribution
      expect(raw.author).toBe('John Specialist');
      expect(raw.from).toEqual({ id: 'member_999', name: 'John Specialist' });

      // Verify linked Author entity in authors table
      expect(post?.authorId).toBeDefined();
      const author = await getAuthorById(tenantId, post!.authorId!);
      expect(author).toBeDefined();
      expect(author?.authorExternalId).toBe('member_999');
      expect(author?.displayName).toBe('John Specialist');
    });

    it('falls back to Page author when post has no from or from.id === pageId', async () => {
      const pageAuthoredPost: FacebookPagePost = {
        id: `${pageId}_post_page_official`,
        message: 'Official announcement from Acme',
        created_time: '2026-08-20T15:00:00Z',
        permalink_url: `https://facebook.com/${pageId}/posts/102`,
        from: { id: pageId, name: 'Acme Official Page' },
      };

      const noFromPost: FacebookPagePost = {
        id: `${pageId}_post_no_from`,
        message: 'Post with omitted from field',
        created_time: '2026-08-20T16:00:00Z',
        permalink_url: `https://facebook.com/${pageId}/posts/103`,
      };

      jest.spyOn(facebookConnectorModule, 'fetchFacebookPagePosts').mockResolvedValue([
        pageAuthoredPost,
        noFromPost,
      ]);
      jest.spyOn(facebookConnectorModule, 'fetchFacebookPageMetadata').mockResolvedValue({
        id: pageId,
        name: 'Acme Official Page',
        fan_count: 5000,
      });

      const outcome = await pollFacebookPage(
        tenantId,
        userId,
        createConnectedPageMock(randomUUID())
      );

      expect(outcome.status).toBe('succeeded');

      // Verify first post (from.id === pageId)
      const found1 = await findSocialPostByExternalId(
        tenantId,
        'facebook',
        pageAuthoredPost.id
      );
      expect(found1).toBeDefined();
      const post1 = await getSocialPostById(tenantId, found1!.id);
      expect(post1).toBeDefined();
      const raw1 = post1!.rawPayload as Record<string, unknown>;
      expect(raw1.pageId).toBe(pageId);
      expect(raw1.pageName).toBe('Acme Official Page');
      expect(raw1.author).toBe('Acme Official Page');

      expect(post1?.authorId).toBeDefined();
      const author1 = await getAuthorById(tenantId, post1!.authorId!);
      expect(author1?.authorExternalId).toBe(pageId);
      expect(author1?.displayName).toBe('Acme Official Page');

      // Verify second post (from is undefined)
      const found2 = await findSocialPostByExternalId(
        tenantId,
        'facebook',
        noFromPost.id
      );
      expect(found2).toBeDefined();
      const post2 = await getSocialPostById(tenantId, found2!.id);
      expect(post2).toBeDefined();
      const raw2 = post2!.rawPayload as Record<string, unknown>;
      expect(raw2.pageId).toBe(pageId);
      expect(raw2.pageName).toBe('Acme Official Page');
      expect(raw2.author).toBe('Acme Official Page');
      expect(post2?.authorId).toBeDefined();
      const author2 = await getAuthorById(tenantId, post2!.authorId!);
      expect(author2?.authorExternalId).toBe(pageId);
      expect(author2?.displayName).toBe('Acme Official Page');
    });
  });
});
