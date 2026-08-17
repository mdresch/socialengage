/**
 * Contract: Story 6.11 (Phase 1/Phase 3 "also build, not storied") — Post
 * feed (browse ingested posts).
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-611--post-feed-browse-ingested-posts
 *
 * Intent: Story 6.11 — Post feed screen
 * Scope: social-listening-admin/{src/lib/core-client.ts (extended —
 *   listPosts(), getPost()), src/app/tenant/posts/page.tsx (new),
 *   src/app/tenant/posts/[id]/page.tsx (new),
 *   src/app/tenant/posts/postDisplay.ts (new)}.
 *
 * Contract to encode: a `/tenant/posts` screen that calls the real,
 *   already-Accepted/built `GET /v1/posts` (ADR-0011, Story 3.4) and renders
 *   each post — a reasonable per-shape title/snippet extraction from
 *   `rawPayload` (GNews: title+description; Newswire/tenant-owned-feed:
 *   title+link, extraction only ever looks for title+optional description
 *   so both shapes work without hardcoding a providerId branch; anything
 *   else falls back to raw JSON), `publishedAt`, and a provider badge from
 *   `rawPayload.providerId`. Pagination is the real, opaque `nextCursor`
 *   (a "next page" link, never a page-number control, never a
 *   client-constructed cursor value — the href embeds the exact string the
 *   API returned). `enrichment` (sentiment/entities/keyPhrases), when
 *   present, is shown; when absent, no enrichment section renders at all.
 *   Selecting a post navigates to `/tenant/posts/:id`, a real Server
 *   Component calling the real `GET /v1/posts/:id` (ADR-0012, Story 5.1),
 *   showing authorId (or "No author recorded") and acquisitionId as the
 *   ingestion-run lineage reference — there is no REST endpoint anywhere
 *   that resolves either into a friendlier name, so the raw id itself is
 *   the honest, real "derived context" this v1 can offer. A 404 renders a
 *   real "not found" message, not a crash.
 *
 * Per this story's own AC5 (and the Story 6.4/6.5 "string-containment
 * checks are not sufficient" correction lesson this story explicitly
 * cites): every behavioral assertion below is a real Page() render against
 * a real encrypted session and mocked fetch (the same pattern
 * story-6.5.connector-status-view's own corrected contract established),
 * not a source-string check standing in for proof of behavior. Structural
 * checks are used only for things that are genuinely structural (file
 * exists, no OFFSET/page-number control anywhere in the source).
 *
 * --- Enhancement, 2026-08-12, at Menno's own direct request ("enhance the
 * post details page with the ai providers enrichment") ---
 * The detail screen now also shows `enrichment.modelUsed` (e.g.
 * "azure-ai-language:2025-01-01" or "azure-openai:2025-08-07") — the one
 * field that answers, per post, which of the two AI providers actually
 * produced its enrichment. Surfaced directly from a real, related question
 * Menno asked: `enrichPost.ts` tries providers in a fixed order and a
 * tenant can have both active at once, so `modelUsed` is the only honest,
 * after-the-fact answer for a specific post — see
 * `social-listening-core/contracts/epic-2/story-2.9...contract.test.ts`'s
 * own same-day dated note for the backend-side finding this surfaced (AI
 * provider activation wasn't gating enrichment at all before that fix).
 *
 * --- Enhancement, 2026-08-17, at Menno's own direct request ("could you
 * include the language in the post output slide window?") ---
 * Both post-detail surfaces (the `[id]/page.tsx` standalone route and
 * `PostsFeedClient.tsx`'s own Slideover, extended by Story 6.19 with an
 * `initialActivePostId` testability seam) now also show
 * `enrichment.detectedLanguage` (`PostEnrichmentSummary.language`,
 * `postDisplay.ts` — already extracted since Story 8.5/ADR-0055 for the
 * Analytics Dashboard's language-breakdown widget, but never rendered on
 * either post-detail surface until now). No new extraction logic — this
 * only wires an already-derived field into two more places it was
 * previously missing from. Absent (`language: null`, e.g. a post enriched
 * before Story 8.5 shipped) renders nothing, the same convention every
 * other enrichment field in this panel already follows.
 *
 * Explicitly out of scope for this contract:
 *   - Re-proving GET /v1/posts's / GET /v1/posts/:id's own backend behavior
 *     (cursor pagination correctness, RLS scoping) — Story 3.4's and Story
 *     5.1's own contracts already prove that; this contract only proves the
 *     admin UI calls them correctly and renders what they return.
 *   - Filtering by watchlistId/platformId, full-text/date-range search, any
 *     change to either endpoint's response shape — named in the story's own
 *     text as real backend dependencies for a later story, not built here.
 *   - A friendlier author name or ingestion-run summary — no REST endpoint
 *     exposes either today (confirmed directly: no /v1/authors route, and
 *     getIngestionRunForPost() has no HTTP route mounted anywhere); building
 *     one is real, separate social-listening-core scope this story's own
 *     Source line (Stories 3.4/5.1 only) does not cover.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const listPagePath = ['app', 'tenant', 'posts', 'page.tsx'];
const detailPagePath = ['app', 'tenant', 'posts', '[id]', 'page.tsx'];
const displayUtilPath = ['app', 'tenant', 'posts', 'postDisplay.ts'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

const TENANT_USER = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'u-1', role: 'tenant_user' as const };

async function renderPageAs(
  modulePath: string,
  fetchImpl: (url: string) => Response,
  identity: unknown = TENANT_USER
) {
  jest.resetModules();
  const sessionModule = await import('../../src/lib/session');
  const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity });

  jest.doMock('next/headers', () => ({
    cookies: async () => ({
      get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
    }),
  }));
  jest.doMock('next/navigation', () => ({
    redirect: jest.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
  }));
  jest.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => fetchImpl(String(input)));

  const { default: Page } = await import(modulePath);
  return Page;
}

const GNEWS_POST = {
  id: 'p-1',
  createdAt: '2026-08-12T09:00:00.000Z',
  publishedAt: '2026-08-12T08:00:00.000Z',
  enrichment: null,
  rawPayload: {
    providerId: 'gnews',
    externalId: 'ext-1',
    title: 'Breaking news headline',
    description: 'A short summary of the article.',
    url: 'https://example.com/article',
  },
};

const NEWSWIRE_POST = {
  id: 'p-2',
  createdAt: '2026-08-12T09:05:00.000Z',
  publishedAt: '2026-08-12T08:05:00.000Z',
  enrichment: {
    sentiment: 'positive',
    keyPhrases: ['quarterly results'],
    entities: [{ text: 'Acme Corp', category: 'Organization', confidenceScore: 0.9 }],
    modelUsed: 'azure-ai-language:2025-01-01',
  },
  rawPayload: {
    providerId: 'newswire',
    externalId: 'ext-2',
    guid: 'guid-2',
    title: 'Acme Corp announces results',
    link: 'https://example.com/press-release',
    pubDate: 'Wed, 12 Aug 2026 08:05:00 GMT',
    issuer: 'Acme Corp',
  },
};

const UNKNOWN_SHAPE_POST = {
  id: 'p-3',
  createdAt: '2026-08-12T09:10:00.000Z',
  publishedAt: null,
  enrichment: null,
  rawPayload: { providerId: 'mystery-connector', someField: 'no title here' },
};

afterEach(() => {
  jest.dontMock('next/headers');
  jest.dontMock('next/navigation');
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('Story 6.11 — Post feed (browse ingested posts)', () => {
  describe('AC1: a real GET /v1/posts call, per-shape title/text extraction, publishedAt, provider badge', () => {
    it('creates the /tenant/posts screen route and its display-extraction util', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...listPagePath))).toBe(true);
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...displayUtilPath))).toBe(true);
    });

    it('gates on the tenant shell like every other tenant screen (Story 6.2)', () => {
      const source = readSrc(...listPagePath);
      expect(source).toContain("isShellAllowed(identity, 'tenant')");
    });

    it('renders a real GNews-shaped post (title+description) from a real mocked GET /v1/posts response', async () => {
      const Page = await renderPageAs(
        '../../src/app/tenant/posts/page',
        (url) => {
          expect(url).toContain('/v1/posts');
          return new Response(JSON.stringify({ posts: [GNEWS_POST], nextCursor: null }), { status: 200 });
        }
      );

      const element = await Page({ searchParams: Promise.resolve({}) });
      const rendered = JSON.stringify(element);
      expect(rendered).toContain('Breaking news headline');
      expect(rendered).toContain('A short summary of the article.');
      expect(rendered).toContain('gnews');
      expect(rendered).toContain('2026-08-12T08:00:00.000Z');
    });

    it('renders a real Newswire-shaped post (title+link, no description field) using the same extraction, no crash', async () => {
      const Page = await renderPageAs('../../src/app/tenant/posts/page', () =>
        new Response(JSON.stringify({ posts: [NEWSWIRE_POST], nextCursor: null }), { status: 200 })
      );

      const element = await Page({ searchParams: Promise.resolve({}) });
      const rendered = JSON.stringify(element);
      expect(rendered).toContain('Acme Corp announces results');
      expect(rendered).toContain('newswire');
    });

    it('falls back to raw JSON for a connector shape with no recognizable title field, rather than crashing', async () => {
      const Page = await renderPageAs('../../src/app/tenant/posts/page', () =>
        new Response(JSON.stringify({ posts: [UNKNOWN_SHAPE_POST], nextCursor: null }), { status: 200 })
      );

      const element = await Page({ searchParams: Promise.resolve({}) });
      const rendered = JSON.stringify(element);
      expect(rendered).toContain('mystery-connector');
      expect(rendered).toContain('no title here');
    });

    it('opens a post in the in-page Slideover, not a navigation to a separate /tenant/posts/:id route', async () => {
      // Healing pass, 2026-08-17 (Menno's explicit sign-off, same session
      // as Story 8.1): this project's real post feed now opens a post's
      // detail via PostsFeedClient's own Slideover (activePost state),
      // never a navigation href — confirmed by reading PostsFeedClient.tsx
      // in full: no `/tenant/posts/${id}` href is constructed anywhere in
      // it. Treated as intentional, not a regression to restore, per
      // Menno's explicit choice this session. The standalone
      // /tenant/posts/[id]/page.tsx detail route itself still exists and
      // is still covered by AC4's own tests below — it's simply no longer
      // linked to from the feed.
      const Page = await renderPageAs('../../src/app/tenant/posts/page', () =>
        new Response(JSON.stringify({ posts: [GNEWS_POST], nextCursor: null }), { status: 200 })
      );

      const element = await Page({ searchParams: Promise.resolve({}) });
      const clientProps = element.props.children.props;
      expect(clientProps.posts).toEqual([GNEWS_POST]);

      const clientSource = fs.readFileSync(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'posts', 'PostsFeedClient.tsx'),
        'utf8'
      );
      expect(clientSource).not.toMatch(/\/tenant\/posts\/\$\{/);
      expect(clientSource).toMatch(/setActivePost/);
      expect(clientSource).toContain('Slideover');
    });

    it('healing note, 2026-08-17: the Provider filter\'s tenant-owned-feed option value matches the real, hyphenated providerId (never the underscored form), found live — selecting it returned zero posts despite real ones existing', async () => {
      const source = fs.readFileSync(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'posts', 'PostsFeedClient.tsx'),
        'utf8'
      );
      expect(source).toMatch(/<option value=["']tenant-owned-feed["']/);
      expect(source).not.toMatch(/<option value=["']tenant_owned_feed["']/);
    });
  });

  describe('AC2: pagination via the real, opaque nextCursor — a next-page link only, never a page-number control or a client-constructed cursor', () => {
    // 2026-08-17, Story 6.18: this AC's own single-page-plus-cursor-link
    // mechanism was deliberately superseded by design — page.tsx now pages
    // through the tenant's *entire* real post set upfront (so search/filter
    // can operate over all of it, not just the first 20), and the
    // server-round-trip "?cursor=" next-page link was replaced by a
    // client-side "Show more" control. This is the same anticipated
    // in-epic-handoff pattern Stories 8.2/8.3 already established against
    // Story 8.1's own contract — not a foreign regression. The four tests
    // that specifically proved the now-retired mechanism (first-page-no-
    // cursor, the rendered next-page link, no-link-when-null, and
    // searchParams.cursor forwarding) are retired outright, since all four
    // exercised behavior that no longer exists by design; Story 6.18's own
    // contract (`story-6.18.post-feed-search-all-posts.contract.test.ts`)
    // covers the real, current pagination shape. The one test below that
    // remains — no page-number control anywhere in the source — is a
    // still-true, still-relevant general constraint, unaffected by the
    // supersession.
    it('the page-number anti-pattern is structurally absent from the source', () => {
      const source = readSrc(...listPagePath);
      expect(source).not.toMatch(/page\s*[:=]\s*\d/);
      expect(source).not.toMatch(/currentPage/i);
    });
  });

  describe('AC3: enrichment fields shown when present, no enrichment section rendered when absent', () => {
    it('shows sentiment/entities/keyPhrases for a post with enrichment set', async () => {
      const Page = await renderPageAs('../../src/app/tenant/posts/page', () =>
        new Response(JSON.stringify({ posts: [NEWSWIRE_POST], nextCursor: null }), { status: 200 })
      );

      const element = await Page({ searchParams: Promise.resolve({}) });
      const rendered = JSON.stringify(element);
      expect(rendered).toContain('positive');
      expect(rendered).toContain('quarterly results');
      expect(rendered).toContain('Acme Corp');
    });

    it('renders no enrichment section for a post whose enrichment is null', async () => {
      const Page = await renderPageAs('../../src/app/tenant/posts/page', () =>
        new Response(JSON.stringify({ posts: [GNEWS_POST], nextCursor: null }), { status: 200 })
      );

      const element = await Page({ searchParams: Promise.resolve({}) });
      const rendered = JSON.stringify(element);
      expect(rendered).not.toMatch(/sentiment/i);
      expect(rendered).not.toMatch(/key ?phrases/i);
    });
  });

  describe('AC4: selecting a post calls the real GET /v1/posts/:id and shows fuller detail; a 404 is a real "not found" state, not a crash', () => {
    it('creates the /tenant/posts/[id] detail screen route', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...detailPagePath))).toBe(true);
    });

    it('renders the real post detail — title, authorId-derived context, and acquisitionId lineage', async () => {
      const Page = await renderPageAs('../../src/app/tenant/posts/[id]/page', (url) => {
        expect(url).toContain('/v1/posts/p-1');
        return new Response(
          JSON.stringify({ ...GNEWS_POST, authorId: 'author-123', acquisitionId: 'run-456' }),
          { status: 200 }
        );
      });

      const element = await Page({ params: Promise.resolve({ id: 'p-1' }) });
      const rendered = JSON.stringify(element);
      expect(rendered).toContain('Breaking news headline');
      expect(rendered).toContain('author-123');
      expect(rendered).toContain('run-456');
    });

    it('enhancement, 2026-08-12: shows which AI provider/model actually enriched this post (modelUsed)', async () => {
      const Page = await renderPageAs('../../src/app/tenant/posts/[id]/page', () =>
        new Response(
          JSON.stringify({ ...NEWSWIRE_POST, id: 'p-2', authorId: 'author-123', acquisitionId: 'run-456' }),
          { status: 200 }
        )
      );

      const element = await Page({ params: Promise.resolve({ id: 'p-2' }) });
      const rendered = JSON.stringify(element);
      expect(rendered).toContain('azure-ai-language:2025-01-01');
    });

    it('enhancement, 2026-08-17: shows the post\'s detected language on the standalone detail route', async () => {
      const Page = await renderPageAs('../../src/app/tenant/posts/[id]/page', () =>
        new Response(
          JSON.stringify({
            ...NEWSWIRE_POST,
            id: 'p-2',
            authorId: 'author-123',
            acquisitionId: 'run-456',
            enrichment: { ...NEWSWIRE_POST.enrichment, detectedLanguage: 'en' },
          }),
          { status: 200 }
        )
      );

      const element = await Page({ params: Promise.resolve({ id: 'p-2' }) });
      const rendered = JSON.stringify(element);
      expect(rendered).toMatch(/Language[^a-zA-Z][\s\S]{0,20}\ben\b/);
    });

    it('enhancement, 2026-08-17: renders no language line when detectedLanguage is absent', async () => {
      const Page = await renderPageAs('../../src/app/tenant/posts/[id]/page', () =>
        new Response(
          JSON.stringify({ ...NEWSWIRE_POST, id: 'p-2', authorId: 'author-123', acquisitionId: 'run-456' }),
          { status: 200 }
        )
      );

      const element = await Page({ params: Promise.resolve({ id: 'p-2' }) });
      const rendered = JSON.stringify(element);
      // Case-sensitive, colon-anchored: modelUsed's own value
      // ("azure-ai-language:2025-01-01") legitimately contains the
      // substring "language" and must not trip this assertion.
      expect(rendered).not.toMatch(/Language: /);
    });

    it('enhancement, 2026-08-17: PostsFeedClient\'s own Slideover shows the detected language too', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { PostsFeedClient } = require('../../src/app/tenant/posts/PostsFeedClient');

      const withLanguage = {
        ...NEWSWIRE_POST,
        id: 'p-2',
        enrichment: { ...NEWSWIRE_POST.enrichment, detectedLanguage: 'fr' },
      };
      const html = renderToStaticMarkup(
        React.createElement(PostsFeedClient, { posts: [withLanguage], watchlists: [], initialActivePostId: 'p-2' })
      );
      expect(html).toMatch(/Language[^a-zA-Z][\s\S]{0,20}\bfr\b/i);
    });

    it('a post with no author recorded (authorId null) renders an honest "no author" state, not a blank or a crash', async () => {
      const Page = await renderPageAs('../../src/app/tenant/posts/[id]/page', () =>
        new Response(JSON.stringify({ ...GNEWS_POST, authorId: null, acquisitionId: 'run-456' }), { status: 200 })
      );

      const element = await Page({ params: Promise.resolve({ id: 'p-1' }) });
      const rendered = JSON.stringify(element);
      expect(rendered.toLowerCase()).toMatch(/no author/);
    });

    it('a 404 from GET /v1/posts/:id renders a real "not found" state, not a thrown error', async () => {
      const Page = await renderPageAs('../../src/app/tenant/posts/[id]/page', () =>
        new Response(JSON.stringify({ error: 'Not found.' }), { status: 404 })
      );

      const element = await Page({ params: Promise.resolve({ id: 'unknown-id' }) });
      const rendered = JSON.stringify(element);
      expect(rendered.toLowerCase()).toMatch(/not found/);
    });

    it('gates the detail screen on the tenant shell too', () => {
      const source = readSrc(...detailPagePath);
      expect(source).toContain("isShellAllowed(identity, 'tenant')");
    });
  });

  describe('core-client.ts: listPosts() and getPost()', () => {
    it('listPosts() GETs /v1/posts with the session bearer token and returns posts + nextCursor', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({
        idToken: 'x',
        accessToken: 'contract-test-access-token',
        identity: null,
      });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify({ posts: [GNEWS_POST], nextCursor: 'c1' }), { status: 200 }));

      const { listPosts } = await import('../../src/lib/core-client');
      const page = await listPosts();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/posts'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer contract-test-access-token' }) })
      );
      expect(page.posts).toHaveLength(1);
      expect(page.nextCursor).toBe('c1');
    });

    it('listPosts() throws on a non-2xx response rather than silently returning an empty page', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity: null });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'bad cursor' }), { status: 400 }));

      const { listPosts } = await import('../../src/lib/core-client');
      await expect(listPosts()).rejects.toThrow();
    });

    it('getPost() returns null on a 404, rather than throwing', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity: null });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Not found.' }), { status: 404 }));

      const { getPost } = await import('../../src/lib/core-client');
      await expect(getPost('unknown-id')).resolves.toBeNull();
    });

    it('getPost() throws on a non-404, non-2xx response', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity: null });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'boom' }), { status: 500 }));

      const { getPost } = await import('../../src/lib/core-client');
      await expect(getPost('p-1')).rejects.toThrow();
    });
  });

  describe('core-client.ts stays the sole Bearer-attachment choke point (re-checked after this story\'s additions)', () => {
    it('no second ad hoc fetch-with-Authorization-header call exists anywhere else in src/', () => {
      const offenders: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
            continue;
          }
          if (!full.endsWith('.ts') && !full.endsWith('.tsx')) continue;
          if (full === path.join(ADMIN_ROOT, 'src', 'lib', 'core-client.ts')) continue;
          const content = fs.readFileSync(full, 'utf8');
          if (/Authorization/.test(content) && /fetch\(/.test(content)) {
            offenders.push(full);
          }
        }
      };
      walk(path.join(ADMIN_ROOT, 'src'));
      expect(offenders).toEqual([]);
    });
  });

  it('documents this component in a SKILL.md', () => {
    expect(fs.existsSync(path.join(ADMIN_ROOT, '.claude', 'skills', 'post-feed', 'SKILL.md'))).toBe(true);
  });
});
