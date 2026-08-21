// Contract: Story 2.19 (ADR-0050's 2026-08-20 Amendment Log entry) —
// tenant-owned-feed per-feed display naming, and per-item author (byline)
// extraction from the feed itself.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-219
//
// Intent: requested directly by Menno ("give feeds a name... let the feed
// owner give the feed a separate name" / "review the feeds for a mandatory
// field that is designated to be the Author"). Two additive, backward-
// compatible extensions of the already-Accepted ADR-0050, neither requiring
// re-acceptance — see that ADR's own 2026-08-20 Amendment Log entry for the
// full reasoning this contract encodes:
//   (a) an optional, tenant-owner-set `name` on a tenant_owned_feed_activation
//       (migrations/0037), returned by every serialized response, settable
//       at connect time and editable via PATCH independent of feedUrl —
//       never required, never touching Author/providerId modeling.
//   (b) feedItemParser.ts now extracts a per-item byline when the feed
//       itself provides one (dc:creator, then flat RSS <author>, then
//       Atom's nested <author><name>) — display-only (rawPayload.author),
//       never changing the Author entity, which stays the verified domain.
// Scope: migrations/0037_add_tenant_owned_feed_activations_name.sql (new),
//   src/connectors/tenantOwnedFeed/feedItemParser.ts (extended —
//   extractByline(), ParsedFeedItem.author),
//   src/connectors/tenantOwnedFeed/tenantOwnedFeedStore.ts (extended —
//   TenantOwnedFeedActivationRow.name, CreateActivationInput.name,
//   updateFeedName()), src/connectors/tenantOwnedFeed/pollTenantOwnedFeed.ts
//   (extended — rawPayload.feedName denormalization),
//   src/http/versions/v1/tenantOwnedFeedRouter.ts (extended — connect/PATCH
//   accept name, serializeActivation() returns it).
// Contract to encode:
// - AC1: POST /connect accepts an optional `name`; when supplied it must be
//   a non-empty string (400 otherwise); the created activation's `name` is
//   returned in the response and by GET /activations.
// - AC2: POST /connect without `name` leaves it null — never required.
// - AC3: PATCH /:id accepts `name` and/or `feedUrl` independently — at
//   least one must be present (400 otherwise, a genuine widening: no prior
//   contract exercised "PATCH with feedUrl missing" specifically, confirmed
//   directly before this change). `name: null` clears a previously-set name.
// - AC4: extractByline() (feedItemParser.ts, tested directly): dc:creator
//   wins when present; falls back to flat RSS <author> (extracted as-is,
//   e.g. "email (Name)" — never further parsed); falls back to Atom's
//   nested <author><name>; null when none are present — never fabricated.
// - AC5: ingestTenantOwnedFeedItems() denormalizes activation.name into
//   rawPayload.feedName (present only when set) and the parsed item's own
//   byline into rawPayload.author — while the post's real authorId/Author
//   row still resolves to the verified domain, unchanged, proving this is
//   genuinely display-only.
// Explicitly out of scope: replacing organization-as-Author (domain) with
// individual-as-Author for the Author entity/topic-signals/analytics
// grouping — ADR-0050's own Amendment Log entry names this as a separate,
// not-yet-decided question; using `name`/`feedName` for any Analytics
// Dashboard/Provider-filter grouping key (still keyed on the fixed
// `tenant-owned-feed` providerId, unchanged); a name-uniqueness constraint
// (none decided — two feeds may share a name, it is a label, not an id);
// surfacing `rawPayload.feedName`/`.author` anywhere in social-listening-
// admin's UI beyond social-listening-admin's own already-existing
// extractAuthor() picking up `.author` for free (a separate, admin-repo
// commit, not this one).

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { createActivation, TenantOwnedFeedActivationRow } from '../../src/connectors/tenantOwnedFeed/tenantOwnedFeedStore';
import { ingestTenantOwnedFeedItems } from '../../src/connectors/tenantOwnedFeed/pollTenantOwnedFeed';
import { parseFeedItems, ParsedFeedItem } from '../../src/connectors/tenantOwnedFeed/feedItemParser';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';

jest.setTimeout(30000);

afterAll(async () => {
  await closePool();
});

function adminHeader(tenantId: string): string {
  return testIdentityHeaderValue(tenantId, { role: 'tenant_admin' });
}

describe('Story 2.19 — tenant-owned-feed naming and byline extraction', () => {
  describe('AC1/AC2: POST /connect accepts an optional name', () => {
    it('a supplied name is returned by the connect response and by GET /activations', async () => {
      const app = createApp();
      const tenantId = randomUUID();

      const res = await request(app)
        .post('/v1/connectors/tenant-owned-feed/connect')
        .set('X-Test-Identity', adminHeader(tenantId))
        .send({ domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed', name: 'Company Blog' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Company Blog');

      const list = await request(app)
        .get('/v1/connectors/tenant-owned-feed/activations')
        .set('X-Test-Identity', adminHeader(tenantId));
      expect(list.body.activations[0].name).toBe('Company Blog');
    });

    it('omitting name leaves it null — never required', async () => {
      const app = createApp();
      const tenantId = randomUUID();

      const res = await request(app)
        .post('/v1/connectors/tenant-owned-feed/connect')
        .set('X-Test-Identity', adminHeader(tenantId))
        .send({ domain: 'blog2.example.com', feedUrl: 'https://blog2.example.com/feed' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBeNull();
    });

    it('an empty-string name is rejected with a 400', async () => {
      const app = createApp();
      const tenantId = randomUUID();

      const res = await request(app)
        .post('/v1/connectors/tenant-owned-feed/connect')
        .set('X-Test-Identity', adminHeader(tenantId))
        .send({ domain: 'blog3.example.com', feedUrl: 'https://blog3.example.com/feed', name: '   ' });

      expect(res.status).toBe(400);
    });
  });

  describe('AC3: PATCH /:id accepts name and/or feedUrl independently', () => {
    it('updates name only, leaving feedUrl unchanged', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const activation = await createActivation(tenantId, { domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed' });

      const res = await request(app)
        .patch(`/v1/connectors/tenant-owned-feed/${activation.id}`)
        .set('X-Test-Identity', adminHeader(tenantId))
        .send({ name: 'Newsroom' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Newsroom');
      expect(res.body.feedUrl).toBe('https://blog.example.com/feed');
    });

    it('updates feedUrl only, leaving name unchanged', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const activation = await createActivation(tenantId, { domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed', name: 'Original Name' });

      const res = await request(app)
        .patch(`/v1/connectors/tenant-owned-feed/${activation.id}`)
        .set('X-Test-Identity', adminHeader(tenantId))
        .send({ feedUrl: 'https://blog.example.com/feed2' });

      expect(res.status).toBe(200);
      expect(res.body.feedUrl).toBe('https://blog.example.com/feed2');
      expect(res.body.name).toBe('Original Name');
    });

    it('name: null clears a previously-set name', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const activation = await createActivation(tenantId, { domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed', name: 'Will Be Cleared' });

      const res = await request(app)
        .patch(`/v1/connectors/tenant-owned-feed/${activation.id}`)
        .set('X-Test-Identity', adminHeader(tenantId))
        .send({ name: null });

      expect(res.status).toBe(200);
      expect(res.body.name).toBeNull();
    });

    it('rejects a request with neither feedUrl nor name with a 400', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const activation = await createActivation(tenantId, { domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed' });

      const res = await request(app)
        .patch(`/v1/connectors/tenant-owned-feed/${activation.id}`)
        .set('X-Test-Identity', adminHeader(tenantId))
        .send({});

      expect(res.status).toBe(400);
    });

    it('rejects an empty-string name with a 400', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const activation = await createActivation(tenantId, { domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed' });

      const res = await request(app)
        .patch(`/v1/connectors/tenant-owned-feed/${activation.id}`)
        .set('X-Test-Identity', adminHeader(tenantId))
        .send({ name: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('AC4: extractByline() (feedItemParser.ts, tested directly via parseFeedItems())', () => {
    function rssWith(extra: string): string {
      return `<rss><channel><item>
        <guid>g-1</guid>
        <title>A post</title>
        <pubDate>Wed, 12 Aug 2026 08:00:00 GMT</pubDate>
        ${extra}
      </item></channel></rss>`;
    }

    it('prefers dc:creator when present', () => {
      const items = parseFeedItems(rssWith('<dc:creator>Jane Doe</dc:creator><author>other@example.com (Other)</author>'));
      expect(items[0].author).toBe('Jane Doe');
    });

    it('falls back to flat RSS <author> when dc:creator is absent (extracted as-is, not further parsed)', () => {
      const items = parseFeedItems(rssWith('<author>jane@example.com (Jane Doe)</author>'));
      expect(items[0].author).toBe('jane@example.com (Jane Doe)');
    });

    it('falls back to Atom-style nested <author><name> when present', () => {
      const items = parseFeedItems(rssWith('<author><name>Jane Doe</name><email>jane@example.com</email></author>'));
      expect(items[0].author).toBe('Jane Doe');
    });

    it('is null when the feed provides no byline at all — never fabricated', () => {
      const items = parseFeedItems(rssWith(''));
      expect(items[0].author).toBeNull();
    });
  });

  describe('AC5: ingestTenantOwnedFeedItems() denormalizes feedName/author display-only — Author/authorId still resolves to the verified domain', () => {
    async function fetchInsertedRawPayload(tenantId: string, providerId: string, externalId: string): Promise<Record<string, unknown>> {
      const { rows } = await withTenant(tenantId, (client) =>
        client.query<{ raw_payload: Record<string, unknown> }>(
          `SELECT raw_payload FROM social_posts WHERE tenant_id = $1 AND raw_payload->>'providerId' = $2 AND raw_payload->>'externalId' = $3`,
          [tenantId, providerId, externalId]
        )
      );
      expect(rows.length).toBeGreaterThan(0);
      return rows[0].raw_payload;
    }

    function syntheticItem(overrides: Partial<ParsedFeedItem>): ParsedFeedItem {
      return {
        id: `ext-${randomUUID()}`,
        link: 'https://blog.example.com/post-1',
        title: 'A synthetic post',
        publishedAt: 'Wed, 12 Aug 2026 08:00:00 GMT',
        description: 'A short synthetic body.',
        contentEncoded: null,
        summary: null,
        content: null,
        rawXml: '<item></item>',
        author: null,
        ...overrides,
      };
    }

    it("denormalizes activation.name into rawPayload.feedName when set, and the item's own byline into rawPayload.author", async () => {
      const tenantId = randomUUID();
      const activation: TenantOwnedFeedActivationRow = await createActivation(tenantId, {
        domain: 'blog.example.com',
        feedUrl: 'https://blog.example.com/feed',
        name: 'Company Blog',
      });
      const item = syntheticItem({ author: 'Jane Doe' });

      await ingestTenantOwnedFeedItems(tenantId, randomUUID(), activation, [item]);

      const rawPayload = await fetchInsertedRawPayload(tenantId, 'tenant-owned-feed', item.id);
      expect(rawPayload.feedName).toBe('Company Blog');
      expect(rawPayload.author).toBe('Jane Doe');
    });

    it('omits rawPayload.feedName entirely (not a null placeholder) when the activation has no name set', async () => {
      const tenantId = randomUUID();
      const activation: TenantOwnedFeedActivationRow = await createActivation(tenantId, {
        domain: 'blog.example.com',
        feedUrl: 'https://blog.example.com/feed',
      });
      const item = syntheticItem({});

      await ingestTenantOwnedFeedItems(tenantId, randomUUID(), activation, [item]);

      const rawPayload = await fetchInsertedRawPayload(tenantId, 'tenant-owned-feed', item.id);
      expect(Object.prototype.hasOwnProperty.call(rawPayload, 'feedName')).toBe(false);
    });

    it("the post's real Author row still resolves to the verified domain, regardless of the item's own byline — proving this is display-only, not an Author-modeling change", async () => {
      const tenantId = randomUUID();
      const activation: TenantOwnedFeedActivationRow = await createActivation(tenantId, {
        domain: 'blog.example.com',
        feedUrl: 'https://blog.example.com/feed',
      });
      const item = syntheticItem({ author: 'Jane Doe' });

      await ingestTenantOwnedFeedItems(tenantId, randomUUID(), activation, [item]);

      const { rows } = await withTenant(tenantId, (client) =>
        client.query<{ display_name: string; external_author_id: string }>(
          `SELECT a.display_name, a.external_author_id FROM social_posts p
           JOIN authors a ON a.id = p.author_id
           WHERE p.tenant_id = $1 AND p.raw_payload->>'externalId' = $2`,
          [tenantId, item.id]
        )
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].display_name).toBe('blog.example.com');
      expect(rows[0].external_author_id).toBe('blog.example.com');
    });
  });
});
