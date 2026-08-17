/**
 * Contract: Story 6.19 (ADR-0053, Story 3.10) — Render the post detail body
 * as real, formatted Markdown.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-619
 *
 * Intent: Story 6.19 — post-detail body renders real Markdown, not raw
 *   HTML-in-a-string or unrendered Markdown syntax.
 * Scope: social-listening-admin/{
 *   src/lib/core-client.ts (SocialPostSummary gains bodyMarkdown: string | null,
 *     SocialPostFull inherits it),
 *   src/app/tenant/posts/PostsFeedClient.tsx (Slideover's "Ingested Article
 *     Body" section renders bodyMarkdown via react-markdown when present,
 *     falls back to the existing plain-text snippet when null; a minimal
 *     initialActivePostId testability seam, same precedent as Story 6.14's
 *     initialEntries — real usage (page.tsx) never passes it),
 *   src/app/tenant/posts/[id]/page.tsx (same bodyMarkdown-with-snippet-
 *     fallback rendering on the standalone detail route)
 * }. No social-listening-core change — this story only consumes the
 * already-exposed bodyMarkdown field (core's own half, story-6.19.post-
 * body-markdown-exposure.contract.test.ts, already shipped).
 *
 * Contract to encode: a post with a real, non-null bodyMarkdown renders real
 *   formatted HTML elements (an actual <h2>, <strong>, <ul>/<li>, <a href>)
 *   from Markdown source, not literal '#'/'**'/'-' characters and not raw
 *   HTML tags escaped as text; a post with bodyMarkdown: null falls back to
 *   the existing plain-text snippet display, never a blank body or a crash;
 *   the compact post-card list-view snippet (not the detail view) is
 *   unaffected by this story.
 *
 * Per this project's established pattern: react-markdown renders to real
 * React elements (never dangerouslySetInnerHTML) — proven directly via
 * renderToStaticMarkup, both at the library-usage level and through each of
 * the two real page/component surfaces.
 *
 * Explicitly out of scope for this contract:
 *   - htmlToMarkdown()/Story 3.10's own conversion pipeline (already correct,
 *     already shipped, social-listening-core-side).
 *   - Any change to rawPayload or the card-list snippet extraction.
 *   - Search/filter, pagination, enrichment panel, raw-JSON inspection —
 *     Story 6.11/6.18's own contracts already cover these and are unaffected.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const clientPath = ['app', 'tenant', 'posts', 'PostsFeedClient.tsx'];
const detailPagePath = ['app', 'tenant', 'posts', '[id]', 'page.tsx'];
const coreClientPath = ['lib', 'core-client.ts'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

const TENANT_USER = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'u-1', role: 'tenant_user' as const };

async function renderPageAs(modulePath: string, fetchImpl: (url: string) => Response, identity: unknown = TENANT_USER) {
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

const MARKDOWN_BODY =
  '## Trust is the real issue\n\nAnthropic CEO **Dario Amodei** rejects claims his AI warnings fueled public fear.\n\n- Real-world benefit\n- Not just warnings\n\nSee [the interview](https://example.com/interview) for more.';

function post(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    createdAt: '2026-08-17T09:00:00.000Z',
    publishedAt: '2026-08-17T08:00:00.000Z',
    enrichment: null,
    rawPayload: { providerId: 'gnews', title: 'Anthropic CEO Dario Amodei Rejects Claims', description: 'Short teaser.' },
    bodyMarkdown: MARKDOWN_BODY,
    ...overrides,
  };
}

afterEach(() => {
  jest.dontMock('next/headers');
  jest.dontMock('next/navigation');
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('Story 6.19 — post detail body renders real, formatted Markdown', () => {
  describe('core-client.ts: SocialPostSummary/SocialPostFull carry bodyMarkdown', () => {
    it('declares bodyMarkdown: string | null on SocialPostSummary', () => {
      const source = readSrc(...coreClientPath);
      const summaryBlock = source.slice(
        source.indexOf('interface SocialPostSummary'),
        source.indexOf('interface SocialPostsPage')
      );
      expect(summaryBlock).toMatch(/bodyMarkdown:\s*string \| null/);
    });
  });

  describe('AC3: react-markdown renders real formatted HTML, not raw syntax', () => {
    it('a heading, bold text, a list, and a link all render as real HTML elements from Markdown source', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const ReactMarkdown = require('react-markdown').default;
      const html = renderToStaticMarkup(React.createElement(ReactMarkdown, null, MARKDOWN_BODY));

      expect(html).toContain('<h2>Trust is the real issue</h2>');
      expect(html).toContain('<strong>Dario Amodei</strong>');
      expect(html).toMatch(/<ul>[\s\S]*<li>Real-world benefit<\/li>/);
      expect(html).toContain('<a href="https://example.com/interview">the interview</a>');
      // Never the raw, unrendered syntax leaking through as literal text.
      expect(html).not.toContain('## Trust is the real issue');
      expect(html).not.toContain('**Dario Amodei**');
    });
  });

  describe('AC3/AC4 — /tenant/posts/[id] standalone detail route', () => {
    it('renders bodyMarkdown as real formatted HTML when present', async () => {
      const Page = await renderPageAs('../../src/app/tenant/posts/[id]/page', () =>
        new Response(JSON.stringify({ ...post('p-1'), authorId: 'author-123', acquisitionId: 'run-456' }), { status: 200 })
      );

      const { renderToStaticMarkup } = require('react-dom/server');
      const element = await Page({ params: Promise.resolve({ id: 'p-1' }) });
      const html = renderToStaticMarkup(element);

      expect(html).toContain('<h2>Trust is the real issue</h2>');
      expect(html).toContain('<strong>Dario Amodei</strong>');
      expect(html).not.toContain('## Trust is the real issue');
    });

    it('falls back to the plain-text snippet when bodyMarkdown is null — never blank, never a crash', async () => {
      const Page = await renderPageAs('../../src/app/tenant/posts/[id]/page', () =>
        new Response(
          JSON.stringify({ ...post('p-2', { bodyMarkdown: null }), authorId: 'author-123', acquisitionId: 'run-456' }),
          { status: 200 }
        )
      );

      const { renderToStaticMarkup } = require('react-dom/server');
      const element = await Page({ params: Promise.resolve({ id: 'p-2' }) });
      const html = renderToStaticMarkup(element);

      expect(html).toContain('Short teaser.');
    });
  });

  describe('AC3/AC4 — PostsFeedClient.tsx Slideover ("Ingested Article Body")', () => {
    it('renders bodyMarkdown as real formatted HTML in the open Slideover', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { PostsFeedClient } = require('../../src/app/tenant/posts/PostsFeedClient');

      const html = renderToStaticMarkup(
        React.createElement(PostsFeedClient, {
          posts: [post('p-1')],
          watchlists: [],
          initialActivePostId: 'p-1',
        })
      );

      expect(html).toContain('<h2>Trust is the real issue</h2>');
      expect(html).toContain('<strong>Dario Amodei</strong>');
      expect(html).not.toContain('## Trust is the real issue');
    });

    it('falls back to the plain-text snippet in the Slideover when bodyMarkdown is null', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { PostsFeedClient } = require('../../src/app/tenant/posts/PostsFeedClient');

      const html = renderToStaticMarkup(
        React.createElement(PostsFeedClient, {
          posts: [post('p-1', { bodyMarkdown: null })],
          watchlists: [],
          initialActivePostId: 'p-1',
        })
      );

      expect(html).toContain('Short teaser.');
    });
  });

  describe('AC5: the compact post-card list-view snippet is unaffected', () => {
    it('the card-list snippet still renders plain text (extractDisplayText), unrelated to bodyMarkdown', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { PostsFeedClient } = require('../../src/app/tenant/posts/PostsFeedClient');

      const html = renderToStaticMarkup(
        React.createElement(PostsFeedClient, { posts: [post('p-1')], watchlists: [] })
      );

      expect(html).toContain('Short teaser.');
      // The card list itself (no post open) must never render the fuller
      // Markdown body — that only appears once a post is selected.
      expect(html).not.toContain('<h2>Trust is the real issue</h2>');
    });
  });

  describe('Structural: every scoped file exists and uses react-markdown, not dangerouslySetInnerHTML', () => {
    it('PostsFeedClient.tsx and [id]/page.tsx both exist and import react-markdown', () => {
      for (const segments of [clientPath, detailPagePath]) {
        expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...segments))).toBe(true);
      }
      expect(readSrc(...clientPath)).toMatch(/from ['"]react-markdown['"]/);
      expect(readSrc(...detailPagePath)).toMatch(/from ['"]react-markdown['"]/);
    });

    it('never uses dangerouslySetInnerHTML for the post body anywhere in this story\'s scope', () => {
      expect(readSrc(...clientPath)).not.toMatch(/dangerouslySetInnerHTML/);
      expect(readSrc(...detailPagePath)).not.toMatch(/dangerouslySetInnerHTML/);
    });
  });
});
