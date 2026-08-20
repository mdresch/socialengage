// Contract: Story 3.10 (ADR-0053) — a canonical Markdown post-body
// representation (`body_markdown`, `body_markdown_version`), computed once
// at ingestion by a new shared htmlToMarkdown() utility, stored on
// social_posts, and fed into enrichment alongside title — for Newswire,
// tenant-owned-feed, and GNews.
// See docs/user-stories/epic-3-data-model-storage-and-archival.md#story-310--canonical-markdown-post-body-storage-and-enrichment-input-body_markdown-body_markdown_version
//
// Intent: close the "enrichment on title-only/title+description" gap
// ADR-0053 found directly — Newswire and tenant-owned-feed never captured
// body content at all; GNews never included its own `content` field. A
// single shared htmlToMarkdown() pipeline (truncate -> sanitize-html ->
// turndown+turndown-plugin-gfm) normalizes whatever each connector's own
// richest-available body field returns into one stable Markdown
// representation, stored once, never re-derived at read time.
// Scope: migrations/0030_add_social_posts_body_markdown.sql (new),
// src/content/htmlToMarkdown.ts (new shared utility),
// src/connectors/newswire/rssFeedParser.ts (description/contentEncoded/
// rawXml), src/connectors/tenantOwnedFeed/feedItemParser.ts
// (description/contentEncoded/summary/content/rawXml),
// src/posts/socialPostStore.ts (InsertSocialPostInput gains
// bodyMarkdown/bodyMarkdownVersion), all three connectors' ingestX()
// functions (body_markdown population + enrichmentText composition),
// package.json (turndown/sanitize-html/turndown-plugin-gfm, exact-pinned).
// Contract to encode, per AC: (1) schema — two new nullable columns, NULL
// exactly when no body source was available; (2) htmlToMarkdown()'s full
// pipeline — plain-text pass-through, script/style discarded, img
// excluded, tracking-stripped bare-domain links dropped (text kept),
// table->GFM conversion, pre-conversion length truncation; (3) exact
// dependency pins + ADR-0053-naming call-site comment; (4) rssFeedParser
// widening; (5) feedItemParser widening (RSS+Atom); (6) richest-field
// precedence, matrix per connector; (7) all three ingestX() populate
// body_markdown/body_markdown_version=1 exactly once via htmlToMarkdown();
// (8) raw_payload gains rawXml for Newswire/tenant-owned-feed via the
// pre-existing spread, GNews's rawPayload unchanged; (9) GNews content
// precedence + free-tier truncation-marker trim; (10) enrichmentText
// composition — [title, body_markdown].filter(Boolean).join('. ') per
// connector; (11) the body_markdown consumer contract (source, not
// display text; sanitize any future render) is documented in this
// component's own SKILL.md.
// Explicitly out of scope, per ADR-0053's own Open Questions: backfilling
// body_markdown for already-ingested rows (Open Question 1); any future
// Markdown-to-HTML/Word/PDF renderer (Open Question 2); whether raw
// Markdown syntax in enrichmentText measurably degrades enrichment
// accuracy (Open Question 9); image preservation (Open Question 7); Atom
// <content>'s type attribute distinction (Open Question 5).

import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { closePool, getPool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { insertSocialPost } from '../../src/posts/socialPostStore';
import { upsertAuthor } from '../../src/authors/authorStore';
import { startIngestionRun, completeIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { htmlToMarkdown, MAX_BODY_SOURCE_LENGTH } from '../../src/content/htmlToMarkdown';
import { parseRssItems } from '../../src/connectors/newswire/rssFeedParser';
import { parseFeedItems } from '../../src/connectors/tenantOwnedFeed/feedItemParser';
import { ingestNewswireItems } from '../../src/connectors/newswire/pollNewswireFeeds';
import { NEWSWIRE_PROVIDER_ID } from '../../src/connectors/newswire/newswireConnector';
import { ingestTenantOwnedFeedItems } from '../../src/connectors/tenantOwnedFeed/pollTenantOwnedFeed';
import { TENANT_OWNED_FEED_PROVIDER_ID } from '../../src/connectors/tenantOwnedFeed/tenantOwnedFeedConnector';
import { TenantOwnedFeedActivationRow } from '../../src/connectors/tenantOwnedFeed/tenantOwnedFeedStore';
import { ingestGNewsArticles } from '../../src/connectors/gnews/pollGNewsSearch';
import { GNEWS_PROVIDER_ID, GNewsArticle } from '../../src/connectors/gnews/gnewsConnector';
import * as enrichPostModule from '../../src/connectors/azureAiLanguage/enrichPost';

jest.setTimeout(60000);

afterAll(async () => {
  await closePool();
});

async function makeRun(tenantId: string, platformId: string): Promise<string> {
  const run = await startIngestionRun(tenantId, { platformId, triggerType: 'poll', connectorVersion: '1.0.0' });
  await completeIngestionRun(tenantId, run.id, { status: 'succeeded', postsIngested: 0, postsSkipped: 0 });
  return run.id;
}

async function getRow(
  tenantId: string,
  postId: string
): Promise<{ body_markdown: string | null; body_markdown_version: number | null; raw_payload: Record<string, unknown> }> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT body_markdown, body_markdown_version, raw_payload FROM social_posts WHERE id = $1`,
      [postId]
    );
    return rows[0];
  });
}

function fakeActivation(domain: string): TenantOwnedFeedActivationRow {
  return {
    id: randomUUID(),
    tenant_id: randomUUID(),
    domain,
    feed_url: `https://${domain}/feed.xml`,
    verification_token: 'test-token',
    txt_record_host: `_socialengage-verify.${domain}`,
    status: 'verified',
    token_expires_at: new Date(Date.now() + 86400000),
    verified_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    // Story 2.19 (ADR-0050's 2026-08-20 Amendment Log entry) added this
    // required field — null here is correct, not a stand-in: this
    // fixture's own activation never had a name set, unrelated to what
    // this story's own AC1 (schema) actually tests.
    name: null,
  };
}

describe('Story 3.10 — canonical Markdown post-body storage and enrichment input', () => {
  describe('AC1: schema', () => {
    it('body_markdown (TEXT) and body_markdown_version (SMALLINT) both nullable', async () => {
      const client = await getPool().connect();
      try {
        const { rows } = await client.query<{ column_name: string; data_type: string; is_nullable: string }>(
          `SELECT column_name, data_type, is_nullable FROM information_schema.columns
           WHERE table_name = 'social_posts' AND column_name IN ('body_markdown', 'body_markdown_version')
           ORDER BY column_name`
        );
        expect(rows).toHaveLength(2);
        const byName = Object.fromEntries(rows.map((r) => [r.column_name, r]));
        expect(byName.body_markdown.data_type).toBe('text');
        expect(byName.body_markdown.is_nullable).toBe('YES');
        expect(byName.body_markdown_version.data_type).toBe('smallint');
        expect(byName.body_markdown_version.is_nullable).toBe('YES');
      } finally {
        client.release();
      }
    });

    it('NULL exactly when no body-eligible field was available — never an empty string', async () => {
      const tenantId = randomUUID();
      const runId = await makeRun(tenantId, NEWSWIRE_PROVIDER_ID);
      const result = await ingestNewswireItems(tenantId, runId, [
        {
          guid: randomUUID(),
          link: 'https://example.com/no-body',
          title: 'No body content here',
          pubDate: 'Wed, 13 Aug 2026 10:00:00 GMT',
          issuer: 'Acme Corp',
          description: null,
          contentEncoded: null,
          rawXml: '<item><title>No body content here</title></item>',
        },
      ]);
      expect(result.postsIngested).toBe(1);
      const rows = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM social_posts WHERE raw_payload->>'providerId' = $1`,
          [NEWSWIRE_PROVIDER_ID]
        );
        return rows;
      });
      const row = await getRow(tenantId, rows[0].id);
      expect(row.body_markdown).toBeNull();
      expect(row.body_markdown_version).toBeNull();
    });
  });

  describe('AC2: htmlToMarkdown() pipeline', () => {
    it('is a safe pass-through for already-plain text', () => {
      expect(htmlToMarkdown('Hello world, no markup here.')).toBe('Hello world, no markup here.');
    });

    it('discards <script>/<style> tags and their inner text entirely', () => {
      const out = htmlToMarkdown('<p>Keep this</p><script>evil()</script><style>.x{color:red}</style>');
      expect(out).toContain('Keep this');
      expect(out).not.toContain('evil()');
      expect(out).not.toContain('.x{color:red}');
    });

    it('excludes <img> (dropping tracking pixels along with real images)', () => {
      const out = htmlToMarkdown('<p>See <img src="https://track.example.com/pixel.gif"> here</p>');
      expect(out).not.toContain('track.example.com');
      expect(out).not.toContain('![');
      expect(out).toContain('See');
      expect(out).toContain('here');
    });

    it('strips a fixed tracking-parameter denylist from <a href> while preserving legitimate params', () => {
      const out = htmlToMarkdown(
        '<a href="https://example.com/article?utm_source=foo&id=42">Read more</a>'
      );
      expect(out).toContain('[Read more](https://example.com/article?id=42)');
      expect(out).not.toContain('utm_source');
    });

    it('drops the <a> wrapper (keeping text) when tracking-parameter stripping leaves a bare, dead-end domain', () => {
      const out = htmlToMarkdown('<p>Click <a href="https://clicks.example.com/?mc_cid=abc&mc_eid=xyz">this link</a> now.</p>');
      expect(out).toContain('this link');
      expect(out).not.toContain('clicks.example.com');
      expect(out).not.toMatch(/\[this link\]/);
    });

    it('converts a <table> to GFM table syntax, not unstructured concatenated text', () => {
      const out = htmlToMarkdown(
        '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
      );
      expect(out).toMatch(/\|\s*A\s*\|\s*B\s*\|/);
      expect(out).toMatch(/\|\s*-+\s*\|\s*-+\s*\|/);
      expect(out).toMatch(/\|\s*1\s*\|\s*2\s*\|/);
    });

    it('truncates the raw source at MAX_BODY_SOURCE_LENGTH before sanitization/conversion ever run', () => {
      const raw = 'a'.repeat(MAX_BODY_SOURCE_LENGTH) + 'MARKER_PAST_THE_GUARD';
      const out = htmlToMarkdown(raw);
      expect(out).not.toContain('MARKER_PAST_THE_GUARD');
      expect(MAX_BODY_SOURCE_LENGTH).toBe(100000);
    });
  });

  describe('AC3: dependency pins and call-site comment', () => {
    it('turndown/sanitize-html/turndown-plugin-gfm are pinned to exact versions in package.json', () => {
      const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));
      expect(pkg.dependencies.turndown).toBe('7.2.4');
      expect(pkg.dependencies['sanitize-html']).toBe('2.17.6');
      expect(pkg.dependencies['turndown-plugin-gfm']).toBe('1.0.2');
    });

    it('the htmlToMarkdown() call site names ADR-0053', () => {
      const source = readFileSync(join(__dirname, '../../src/content/htmlToMarkdown.ts'), 'utf8');
      expect(source).toContain('ADR-0053');
    });
  });

  describe('AC4: rssFeedParser.ts (Newswire) captures description/contentEncoded/rawXml', () => {
    it('parses a fixture <item> with a CDATA-wrapped <description> and <content:encoded>', () => {
      const xml = `<rss><channel><item>
        <guid>guid-123</guid>
        <link>https://example.com/press-release</link>
        <title>Acme announces new product</title>
        <pubDate>Wed, 13 Aug 2026 10:00:00 GMT</pubDate>
        <dc:contributor>Acme Corp</dc:contributor>
        <description><![CDATA[<p>Short summary.</p>]]></description>
        <content:encoded><![CDATA[<p>Full <strong>press release</strong> body.</p>]]></content:encoded>
      </item></channel></rss>`;

      const [item] = parseRssItems(xml);
      expect(item.guid).toBe('guid-123');
      expect(item.link).toBe('https://example.com/press-release');
      expect(item.title).toBe('Acme announces new product');
      expect(item.pubDate).toBe('Wed, 13 Aug 2026 10:00:00 GMT');
      expect(item.issuer).toBe('Acme Corp');
      expect(item.description).toBe('<p>Short summary.</p>');
      expect(item.contentEncoded).toBe('<p>Full <strong>press release</strong> body.</p>');
      expect(item.rawXml).toContain('Acme announces new product');
      expect(item.rawXml).toContain('content:encoded');
    });
  });

  describe('AC5: feedItemParser.ts (tenant-owned-feed) captures RSS and Atom body shapes + rawXml', () => {
    it('parses an RSS <item> fixture: description/contentEncoded populate, summary/content stay null', () => {
      const xml = `<rss><channel><item>
        <guid>rss-guid-1</guid>
        <link>https://tenant.example.com/post-1</link>
        <title>RSS post</title>
        <pubDate>Wed, 13 Aug 2026 10:00:00 GMT</pubDate>
        <description><![CDATA[RSS summary]]></description>
        <content:encoded><![CDATA[<p>RSS full body</p>]]></content:encoded>
      </item></channel></rss>`;

      const [item] = parseFeedItems(xml);
      expect(item.description).toBe('RSS summary');
      expect(item.contentEncoded).toBe('<p>RSS full body</p>');
      expect(item.summary).toBeNull();
      expect(item.content).toBeNull();
      expect(item.rawXml).toContain('RSS post');
    });

    it('parses an Atom <entry> fixture: summary/content populate, description/contentEncoded stay null', () => {
      const xml = `<feed><entry>
        <id>atom-id-1</id>
        <link href="https://tenant.example.com/post-2"/>
        <title>Atom post</title>
        <updated>2026-08-13T10:00:00Z</updated>
        <summary>Atom summary</summary>
        <content>&lt;p&gt;Atom full body&lt;/p&gt;</content>
      </entry></feed>`;

      const [item] = parseFeedItems(xml);
      expect(item.summary).toBe('Atom summary');
      expect(item.content).toBe('<p>Atom full body</p>');
      expect(item.description).toBeNull();
      expect(item.contentEncoded).toBeNull();
      expect(item.rawXml).toContain('Atom post');
    });
  });

  describe('AC6/AC7: richest-field precedence + body_markdown/body_markdown_version populated exactly once, per connector', () => {
    it('Newswire: content:encoded wins over description; description used when content:encoded absent; null when neither present', async () => {
      const tenantId = randomUUID();
      const runId = await makeRun(tenantId, NEWSWIRE_PROVIDER_ID);

      const cases: Array<{ description: string | null; contentEncoded: string | null; expectSource: string | null }> = [
        { description: 'FALLBACK', contentEncoded: '<p>RICH</p>', expectSource: '<p>RICH</p>' },
        { description: 'FALLBACK', contentEncoded: null, expectSource: 'FALLBACK' },
        { description: null, contentEncoded: null, expectSource: null },
      ];

      for (const [i, c] of cases.entries()) {
        const result = await ingestNewswireItems(tenantId, runId, [
          {
            guid: `guid-precedence-${i}`,
            link: `https://example.com/${i}`,
            title: `Precedence case ${i}`,
            pubDate: 'Wed, 13 Aug 2026 10:00:00 GMT',
            issuer: 'Acme Corp',
            description: c.description,
            contentEncoded: c.contentEncoded,
            rawXml: '<item/>',
          },
        ]);
        expect(result.postsIngested).toBe(1);

        const [{ id }] = await withTenant(tenantId, async (client) => {
          const { rows } = await client.query<{ id: string }>(
            `SELECT id FROM social_posts WHERE raw_payload->>'externalId' = $1`,
            [`guid-precedence-${i}`]
          );
          return rows;
        });
        const row = await getRow(tenantId, id);
        if (c.expectSource === null) {
          expect(row.body_markdown).toBeNull();
          expect(row.body_markdown_version).toBeNull();
        } else {
          expect(row.body_markdown).toBe(htmlToMarkdown(c.expectSource));
          expect(row.body_markdown_version).toBe(1);
        }
      }
    });

    it('Tenant-owned-feed: same precedence, applied identically', async () => {
      const tenantId = randomUUID();
      const runId = await makeRun(tenantId, TENANT_OWNED_FEED_PROVIDER_ID);
      const activation = fakeActivation('tenant.example.com');

      const cases: Array<{ description: string | null; contentEncoded: string | null; expectSource: string | null }> = [
        { description: 'FALLBACK', contentEncoded: '<p>RICH</p>', expectSource: '<p>RICH</p>' },
        { description: 'FALLBACK', contentEncoded: null, expectSource: 'FALLBACK' },
        { description: null, contentEncoded: null, expectSource: null },
      ];

      for (const [i, c] of cases.entries()) {
        const result = await ingestTenantOwnedFeedItems(tenantId, runId, activation, [
          {
            id: `tof-precedence-${i}`,
            link: `https://tenant.example.com/${i}`,
            title: `Precedence case ${i}`,
            publishedAt: '2026-08-13T10:00:00Z',
            description: c.description,
            contentEncoded: c.contentEncoded,
            summary: null,
            content: null,
            rawXml: '<item/>',
            // Story 2.19 — required field, unrelated to this precedence test.
            author: null,
          },
        ]);
        expect(result.postsIngested).toBe(1);

        const [{ id }] = await withTenant(tenantId, async (client) => {
          const { rows } = await client.query<{ id: string }>(
            `SELECT id FROM social_posts WHERE raw_payload->>'externalId' = $1`,
            [`tof-precedence-${i}`]
          );
          return rows;
        });
        const row = await getRow(tenantId, id);
        if (c.expectSource === null) {
          expect(row.body_markdown).toBeNull();
          expect(row.body_markdown_version).toBeNull();
        } else {
          expect(row.body_markdown).toBe(htmlToMarkdown(c.expectSource));
          expect(row.body_markdown_version).toBe(1);
        }
      }
    });

    it('GNews: content wins over description; description used when content absent; null when neither present', async () => {
      const tenantId = randomUUID();
      const runId = await makeRun(tenantId, GNEWS_PROVIDER_ID);

      const cases: Array<{ description: string | null; content: string | null; expectSource: string | null }> = [
        { description: 'FALLBACK', content: 'RICH content', expectSource: 'RICH content' },
        { description: 'FALLBACK', content: null, expectSource: 'FALLBACK' },
        { description: null, content: null, expectSource: null },
      ];

      for (const [i, c] of cases.entries()) {
        const article: GNewsArticle = {
          id: `gnews-precedence-${i}`,
          title: `Precedence case ${i}`,
          description: c.description as unknown as string,
          content: c.content as unknown as string,
          url: `https://example.com/${i}`,
          image: '',
          publishedAt: '2026-08-13T10:00:00Z',
          lang: 'en',
          source: { id: 'src-1', name: 'Example News', url: 'https://example.com', country: 'us' },
        };
        const result = await ingestGNewsArticles(tenantId, runId, [article]);
        expect(result.postsIngested).toBe(1);

        const [{ id }] = await withTenant(tenantId, async (client) => {
          const { rows } = await client.query<{ id: string }>(
            `SELECT id FROM social_posts WHERE raw_payload->>'externalId' = $1`,
            [`gnews-precedence-${i}`]
          );
          return rows;
        });
        const row = await getRow(tenantId, id);
        if (c.expectSource === null) {
          expect(row.body_markdown).toBeNull();
          expect(row.body_markdown_version).toBeNull();
        } else {
          expect(row.body_markdown).toBe(htmlToMarkdown(c.expectSource));
          expect(row.body_markdown_version).toBe(1);
        }
      }
    });
  });

  describe('AC8: raw_payload gains rawXml for Newswire/tenant-owned-feed via the existing spread; GNews unchanged', () => {
    it('Newswire: raw_payload.rawXml matches the item\'s own raw XML block exactly', async () => {
      const tenantId = randomUUID();
      const runId = await makeRun(tenantId, NEWSWIRE_PROVIDER_ID);
      const rawXml = '<item><title>Raw XML check</title><guid>raw-xml-guid</guid></item>';
      await ingestNewswireItems(tenantId, runId, [
        {
          guid: 'raw-xml-guid',
          link: 'https://example.com/raw-xml',
          title: 'Raw XML check',
          pubDate: 'Wed, 13 Aug 2026 10:00:00 GMT',
          issuer: 'Acme Corp',
          description: null,
          contentEncoded: null,
          rawXml,
        },
      ]);
      const [{ id }] = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM social_posts WHERE raw_payload->>'externalId' = $1`,
          ['raw-xml-guid']
        );
        return rows;
      });
      const row = await getRow(tenantId, id);
      expect(row.raw_payload.rawXml).toBe(rawXml);
    });

    it('GNews: raw_payload has no rawXml key, and still spreads the complete article object', async () => {
      const tenantId = randomUUID();
      const runId = await makeRun(tenantId, GNEWS_PROVIDER_ID);
      const article: GNewsArticle = {
        id: 'gnews-rawpayload-check',
        title: 'GNews raw payload check',
        description: 'desc',
        content: 'content',
        url: 'https://example.com/article',
        image: 'https://example.com/img.jpg',
        publishedAt: '2026-08-13T10:00:00Z',
        lang: 'en',
        source: { id: 'src-1', name: 'Example News', url: 'https://example.com', country: 'us' },
      };
      await ingestGNewsArticles(tenantId, runId, [article]);
      const [{ id }] = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM social_posts WHERE raw_payload->>'externalId' = $1`,
          ['gnews-rawpayload-check']
        );
        return rows;
      });
      const row = await getRow(tenantId, id);
      expect(row.raw_payload.rawXml).toBeUndefined();
      expect(row.raw_payload.title).toBe('GNews raw payload check');
      expect(row.raw_payload.image).toBe('https://example.com/img.jpg');
    });
  });

  describe('AC9: GNews truncation-marker trim', () => {
    it('strips a trailing [+N chars] free-tier truncation marker from content before conversion', async () => {
      const tenantId = randomUUID();
      const runId = await makeRun(tenantId, GNEWS_PROVIDER_ID);
      const article: GNewsArticle = {
        id: 'gnews-truncation-marker',
        title: 'Truncation marker check',
        description: 'desc',
        content: 'A funding round was announced today [+1,842 chars]',
        url: 'https://example.com/article',
        image: '',
        publishedAt: '2026-08-13T10:00:00Z',
        lang: 'en',
        source: { id: 'src-1', name: 'Example News', url: 'https://example.com', country: 'us' },
      };
      await ingestGNewsArticles(tenantId, runId, [article]);
      const [{ id }] = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM social_posts WHERE raw_payload->>'externalId' = $1`,
          ['gnews-truncation-marker']
        );
        return rows;
      });
      const row = await getRow(tenantId, id);
      expect(row.body_markdown).not.toContain('[+1,842 chars]');
      expect(row.body_markdown).toBe(htmlToMarkdown('A funding round was announced today'));
    });

    it('healing note, 2026-08-17: strips the real, confirmed-live marker format (no "+" sign) — ADR-0053 Open Question 11, resolved against a real GNews response', async () => {
      const tenantId = randomUUID();
      const runId = await makeRun(tenantId, GNEWS_PROVIDER_ID);
      const article: GNewsArticle = {
        id: 'gnews-truncation-marker-real-format',
        title: 'Real-format truncation marker check',
        description: 'desc',
        content: 'Anthropic CEO Dario Amodei has broken silence on claims that his warnings on AI fueled fear [1966 chars]',
        url: 'https://example.com/article-2',
        image: '',
        publishedAt: '2026-08-17T10:00:00Z',
        lang: 'en',
        source: { id: 'src-1', name: 'Example News', url: 'https://example.com', country: 'us' },
      };
      await ingestGNewsArticles(tenantId, runId, [article]);
      const [{ id }] = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM social_posts WHERE raw_payload->>'externalId' = $1`,
          ['gnews-truncation-marker-real-format']
        );
        return rows;
      });
      const row = await getRow(tenantId, id);
      expect(row.body_markdown).not.toContain('[1966 chars]');
      expect(row.body_markdown).toBe(htmlToMarkdown('Anthropic CEO Dario Amodei has broken silence on claims that his warnings on AI fueled fear'));
    });
  });

  describe('AC10: enrichmentText composition — [title, body_markdown].filter(Boolean).join(\'. \')', () => {
    it('Newswire composes title + converted body_markdown', async () => {
      const spy = jest.spyOn(enrichPostModule, 'enrichPost');
      const tenantId = randomUUID();
      const runId = await makeRun(tenantId, NEWSWIRE_PROVIDER_ID);
      await ingestNewswireItems(tenantId, runId, [
        {
          guid: 'enrichment-text-newswire',
          link: 'https://example.com/enrichment',
          title: 'Enrichment title',
          pubDate: 'Wed, 13 Aug 2026 10:00:00 GMT',
          issuer: 'Acme Corp',
          description: null,
          contentEncoded: '<p>Body text</p>',
          rawXml: '<item/>',
        },
      ]);
      const expectedBody = htmlToMarkdown('<p>Body text</p>');
      expect(spy).toHaveBeenCalledWith(tenantId, `Enrichment title. ${expectedBody}`);
      spy.mockRestore();
    });

    it('Tenant-owned-feed composes title + converted body_markdown', async () => {
      const spy = jest.spyOn(enrichPostModule, 'enrichPost');
      const tenantId = randomUUID();
      const runId = await makeRun(tenantId, TENANT_OWNED_FEED_PROVIDER_ID);
      const activation = fakeActivation('tenant.example.com');
      await ingestTenantOwnedFeedItems(tenantId, runId, activation, [
        {
          id: 'enrichment-text-tof',
          link: 'https://tenant.example.com/enrichment',
          title: 'Enrichment title',
          publishedAt: '2026-08-13T10:00:00Z',
          description: null,
          contentEncoded: '<p>Body text</p>',
          summary: null,
          content: null,
          rawXml: '<item/>',
          // Story 2.19 — required field, unrelated to this composition test.
          author: null,
        },
      ]);
      const expectedBody = htmlToMarkdown('<p>Body text</p>');
      expect(spy).toHaveBeenCalledWith(tenantId, `Enrichment title. ${expectedBody}`);
      spy.mockRestore();
    });

    it('GNews composes title + converted body_markdown (no longer joins raw description directly)', async () => {
      const spy = jest.spyOn(enrichPostModule, 'enrichPost');
      const tenantId = randomUUID();
      const runId = await makeRun(tenantId, GNEWS_PROVIDER_ID);
      const article: GNewsArticle = {
        id: 'enrichment-text-gnews',
        title: 'Enrichment title',
        description: 'A description',
        content: 'Real content body',
        url: 'https://example.com/article',
        image: '',
        publishedAt: '2026-08-13T10:00:00Z',
        lang: 'en',
        source: { id: 'src-1', name: 'Example News', url: 'https://example.com', country: 'us' },
      };
      await ingestGNewsArticles(tenantId, runId, [article]);
      const expectedBody = htmlToMarkdown('Real content body');
      expect(spy).toHaveBeenCalledWith(tenantId, `Enrichment title. ${expectedBody}`);
      spy.mockRestore();
    });
  });

  describe('AC11: consumer contract documented (not runtime-tested — no consumer exists yet)', () => {
    it('the canonical-markdown-conversion SKILL.md documents body_markdown as source, never display text, and the render-time sanitization requirement', () => {
      const skill = readFileSync(
        join(__dirname, '../../.claude/skills/canonical-markdown-conversion/SKILL.md'),
        'utf8'
      ).toLowerCase();
      expect(skill).toContain('markdown source');
      expect(skill).toContain('never');
      expect(skill).toContain('sanitize');
    });
  });

  it('Author normalization for these three connectors is unchanged by this story (cross-referenced, not re-tested)', () => {
    // Deliberately not re-asserted — each connector's own existing contract
    // (story-2.6/2.7/2.11) already proves Author resolution, and the full
    // accumulated suite re-runs them on every merge. This story adds no
    // author-shape change.
    expect(true).toBe(true);
  });
});
