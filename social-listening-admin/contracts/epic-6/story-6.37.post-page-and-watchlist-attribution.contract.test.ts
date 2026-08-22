/**
 * Contract: Story 6.37 — Post Feed and Post Detail Facebook Page & Matched Watchlist Attribution
 * Sourced from ADR-0067 (Accepted 2026-08-20; amended 2026-08-22).
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-637
 *
 * Intent:
 * 1. postDisplay.ts resolves the hosting Facebook Page for a post using the caller's connected Pages list,
 *    explicit rawPayload fields, the externalId prefix, and the post URL, with a generic fallback.
 * 2. postDisplay.ts extracts and falls back to a matched watchlist id from rawPayload, deriving the watchlist
 *    name client-side when needed.
 * 3. PostsFeedClient renders the hosting Facebook Page badge ("Page: <Name>") and a distinct author
 *    ("By: <Author>") for Facebook posts, and a matched watchlist chip for posts with a watchlistName.
 * 4. PostDetailPanel renders a clickable "Hosting Facebook Page" link, a distinct "Post Creator / Author" row,
 *    and a "Matched Watchlist" link row.
 * 5. page.tsx loads the caller's own connected Facebook Pages and passes them to PostsFeedClient.
 * 6. pollWikipedia.ts denormalizes the effective watchlist id into rawPayload.watchlistId and
 *    rawPayload.discoveringWatchlistId so the UI does not have to re-derive it for Wikipedia posts.
 *
 * Scope (Step 2):
 * - social-listening-admin/src/app/tenant/posts/postDisplay.ts
 * - social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx
 * - social-listening-admin/src/app/tenant/posts/PostDetailPanel.tsx
 * - social-listening-admin/src/app/tenant/posts/page.tsx
 * - social-listening-core/src/connectors/wikipedia/pollWikipedia.ts
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.resolve(__dirname, '../../src', ...segments), 'utf8');
}

function readCoreSrc(...segments: string[]): string {
  return fs.readFileSync(path.resolve(__dirname, '../../../social-listening-core/src', ...segments), 'utf8');
}

describe('Story 6.37 — Post Feed & Post Detail Facebook Page & Matched Watchlist Attribution (ADR-0067)', () => {
  // -------------------------------------------------------------------------
  // AC1: Facebook Page resolution from connected Pages, raw fields, and URL
  // -------------------------------------------------------------------------
  describe('AC1: extractFacebookPageContext resolves the hosting Page', () => {
    it('uses the connected Pages list to resolve the Page name from pageId', async () => {
      const { extractFacebookPageContext } = await import('../../src/app/tenant/posts/postDisplay');

      const ctx = extractFacebookPageContext(
        {
          providerId: 'facebook',
          externalId: '123_456',
          pageId: 'page_999',
        },
        [{ pageId: 'page_999', pageName: 'Acme Europe' }]
      );

      expect(ctx).toEqual({
        pageId: 'page_999',
        pageName: 'Acme Europe',
        author: null,
        isPageAuthor: true,
      });
    });

    it('falls back to rawPayload pageName / from.name and then to URL extraction', async () => {
      const { extractFacebookPageContext } = await import('../../src/app/tenant/posts/postDisplay');

      const ctx = extractFacebookPageContext(
        {
          providerId: 'facebook',
          externalId: 'fb_1',
          url: 'https://www.facebook.com/AcmeGlobal/posts/123',
          from: { id: 'user_1', name: 'Jane Writer' },
        },
        []
      );

      expect(ctx?.pageName).toBe('AcmeGlobal');
      expect(ctx?.author).toBe('Jane Writer');
      expect(ctx?.isPageAuthor).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // AC2: Watchlist id extraction and FlatPost watchlist name resolution
  // -------------------------------------------------------------------------
  describe('AC2: extractWatchlistId and flattenPost resolve the matched watchlist', () => {
    it('extractWatchlistId reads watchlistId, discoveringWatchlistId, and legacy snake_case fields', async () => {
      const { extractWatchlistId } = await import('../../src/app/tenant/posts/postDisplay');

      expect(extractWatchlistId({ watchlistId: 'wl-1' })).toBe('wl-1');
      expect(extractWatchlistId({ discoveringWatchlistId: 'wl-2' })).toBe('wl-2');
      expect(extractWatchlistId({ matchedWatchlistId: 'wl-3' })).toBe('wl-3');
      expect(extractWatchlistId({ watchlist_id: 'wl-4' })).toBe('wl-4');
      expect(extractWatchlistId({ discovering_watchlist_id: 'wl-5' })).toBe('wl-5');
    });

    it('flattenPost derives watchlistName from explicit watchlistId', async () => {
      const { flattenPost } = await import('../../src/app/tenant/posts/postDisplay');

      const flat = flattenPost(
        {
          id: 'post-wl',
          createdAt: '2026-08-22T12:00:00Z',
          rawPayload: { providerId: 'wikipedia', watchlistId: 'wl-climate', externalId: 'wiki:1' },
        } as any,
        [{ id: 'wl-climate', name: 'Climate' }]
      );

      expect(flat.watchlistId).toBe('wl-climate');
      expect(flat.watchlistName).toBe('Climate');
    });

    it('flattenPost falls back to a term match and then to the generic Wikipedia watchlist', async () => {
      const { flattenPost } = await import('../../src/app/tenant/posts/postDisplay');

      const flat = flattenPost(
        {
          id: 'post-wl-fallback',
          createdAt: '2026-08-22T12:00:00Z',
          bodyMarkdown: 'Article about climate adaptation',
          rawPayload: { providerId: 'wikipedia', externalId: 'wiki:2' },
        } as any,
        [
          { id: 'wl-tech', name: 'Technology', terms: ['AI'], platformIds: [] },
          { id: 'wl-climate', name: 'Climate', terms: ['climate'], platformIds: ['wikipedia'] },
        ]
      );

      expect(flat.watchlistId).toBe('wl-climate');
      expect(flat.watchlistName).toBe('Climate');
    });
  });

  // -------------------------------------------------------------------------
  // AC3: PostsFeedClient renders Page and watchlist attribution chips
  // -------------------------------------------------------------------------
  describe('AC3: PostsFeedClient renders Facebook Page and watchlist chips', () => {
    it('renders Facebook Page badge, distinct author, and matched watchlist chip', async () => {
      const { PostsFeedClient } = await import('../../src/app/tenant/posts/PostsFeedClient');

      const samplePosts = [
        {
          id: 'post-fb-37',
          createdAt: '2026-08-22T14:00:00Z',
          publishedAt: '2026-08-22T14:00:00Z',
          rawPayload: {
            providerId: 'facebook',
            externalId: 'fb_37_1',
            pageId: 'page_101',
            author: 'Jane Writer',
            message: 'Launch details.',
          },
        },
        {
          id: 'post-wiki-37',
          createdAt: '2026-08-22T15:00:00Z',
          publishedAt: '2026-08-22T15:00:00Z',
          rawPayload: {
            providerId: 'wikipedia',
            externalId: 'wiki:37',
            watchlistId: 'wl-climate',
            title: 'Climate change mitigation',
          },
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(PostsFeedClient, {
          posts: samplePosts as any,
          watchlists: [{ id: 'wl-climate', name: 'Climate', terms: [], platformIds: ['wikipedia'] }] as any,
          facebookPages: [{ pageId: 'page_101', pageName: 'Acme Europe' }],
        })
      );

      expect(html).toContain('Page: Acme Europe');
      expect(html).toContain('By: Jane Writer');
      expect(html).toContain('Climate');
      expect(html).toContain('pf-chip-entity');
    });
  });

  // -------------------------------------------------------------------------
  // AC4: PostDetailPanel renders Page link, distinct author, and watchlist row
  // -------------------------------------------------------------------------
  describe('AC4: PostDetailPanel renders hosting Page and matched watchlist rows', () => {
    it('renders a clickable Hosting Facebook Page and a Matched Watchlist row', async () => {
      const { PostDetailPanel } = await import('../../src/app/tenant/posts/PostDetailPanel');

      const samplePost = {
        id: 'post-detail-37',
        createdAt: '2026-08-22T16:00:00Z',
        provider: 'facebook',
        pageName: 'Acme Europe',
        pageId: 'page_101',
        author: 'Jane Writer',
        watchlistId: 'wl-climate',
        watchlistName: 'Climate',
        rawPayload: {
          providerId: 'facebook',
          externalId: 'fb_37_2',
          pageId: 'page_101',
          author: 'Jane Writer',
          message: 'Launch details.',
        },
        bodyMarkdown: null,
        snippet: null,
        enrichmentSummary: null,
      };

      const html = renderToStaticMarkup(
        React.createElement(PostDetailPanel, {
          post: samplePost as any,
          facebookPages: [{ pageId: 'page_101', pageName: 'Acme Europe' }],
        })
      );

      expect(html).toContain('Hosting Facebook Page');
      expect(html).toContain('Acme Europe');
      expect(html).toContain('ID: page_101');
      expect(html).toContain('https://facebook.com/page_101');
      expect(html).toContain('Post Creator / Author');
      expect(html).toContain('Jane Writer');
      expect(html).toContain('Matched Watchlist');
      expect(html).toContain('Climate');
      expect(html).toContain('/tenant/watchlists');
    });
  });

  // -------------------------------------------------------------------------
  // AC5: page.tsx loads connected Facebook Pages and passes them through
  // -------------------------------------------------------------------------
  describe('AC5: page.tsx fetches and passes facebookPages', () => {
    it('imports listFacebookPages and passes facebookPages to PostsFeedClient', () => {
      const page = readSrc('app', 'tenant', 'posts', 'page.tsx');
      expect(page).toContain('listFacebookPages');
      expect(page).toContain('facebookPages={facebookPages}');
    });
  });

  // -------------------------------------------------------------------------
  // AC6: pollWikipedia.ts denormalizes the effective watchlist id into rawPayload
  // -------------------------------------------------------------------------
  describe('AC6: pollWikipedia.ts persists watchlistId and discoveringWatchlistId', () => {
    it('sets watchlistId and discoveringWatchlistId to effectiveWatchlistId in rawPayload and publish call', () => {
      const source = readCoreSrc('connectors', 'wikipedia', 'pollWikipedia.ts');
      expect(source).toContain('const effectiveWatchlistId =');
      expect(source).toContain('watchlistId: effectiveWatchlistId');
      expect(source).toContain('discoveringWatchlistId: effectiveWatchlistId');
    });
  });
});
