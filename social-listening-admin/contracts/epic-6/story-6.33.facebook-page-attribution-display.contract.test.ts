/**
 * Contract: Story 6.33 — Facebook connector hosting Page attribution and author distinction display
 * Sourced from ADR-0067 (Accepted 2026-08-20).
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-633
 *
 * Intent:
 * 1. postDisplay.ts extracts Facebook Page context (pageId, pageName, author, isPageAuthor) and maps pageName/pageId into FlatPost.
 * 2. PostsFeedClient renders platform badge, explicit hosting Page badge (📍 Page: <Name>), and creator author ("By: <Author>") when author is distinct from pageName.
 * 3. PostDetailPanel renders a dedicated "Hosting Facebook Page" row in the telemetry section showing pageName and pageId.
 * 4. PostsFeedClient search filter matches against pageName so users can search for posts from a specific Page.
 * 5. Slideover header subtitle indicates "Published on Facebook Page: <Name>".
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.resolve(__dirname, '../../src', ...segments), 'utf8');
}

describe('Story 6.33 — Facebook Connector Hosting Page Attribution & Author Distinction Display (ADR-0067)', () => {
  // -------------------------------------------------------------------------
  // AC1: Display Derivation Helpers & FlatPost mapping (postDisplay.ts)
  // -------------------------------------------------------------------------
  describe('AC1: Display Derivation Helpers in postDisplay.ts', () => {
    it('extractFacebookPageContext extracts pageName, pageId, and author distinction', async () => {
      const { extractFacebookPageContext, flattenPost } = await import('../../src/app/tenant/posts/postDisplay');

      // Post with distinct author
      const distinctAuthorPayload = {
        providerId: 'facebook',
        externalId: '123_456',
        pageId: 'page_999',
        pageName: 'Acme Global Brand',
        author: 'Sarah Writer',
        from: { id: 'user_111', name: 'Sarah Writer' },
        message: 'Exciting announcement!',
      };

      const ctx1 = extractFacebookPageContext(distinctAuthorPayload);
      expect(ctx1).toEqual({
        pageId: 'page_999',
        pageName: 'Acme Global Brand',
        author: 'Sarah Writer',
        isPageAuthor: false,
      });

      // Post with page author
      const pageAuthorPayload = {
        providerId: 'facebook',
        externalId: '123_457',
        pageId: 'page_999',
        pageName: 'Acme Global Brand',
        author: 'Acme Global Brand',
        message: 'Official update',
      };

      const ctx2 = extractFacebookPageContext(pageAuthorPayload);
      expect(ctx2).toEqual({
        pageId: 'page_999',
        pageName: 'Acme Global Brand',
        author: 'Acme Global Brand',
        isPageAuthor: true,
      });

      // flattenPost derives pageName and pageId
      const flat = flattenPost({
        id: 'post-1',
        createdAt: '2026-08-20T12:00:00Z',
        rawPayload: distinctAuthorPayload,
      } as any);

      expect(flat.pageName).toBe('Acme Global Brand');
      expect(flat.pageId).toBe('page_999');
      expect(flat.author).toBe('Sarah Writer');
    });
  });

  // -------------------------------------------------------------------------
  // AC2: Post Card Presentation in PostsFeedClient.tsx
  // -------------------------------------------------------------------------
  describe('AC2: Post Card Header Attribution in PostsFeedClient.tsx', () => {
    it('renders hosting Page badge and creator author attribution on Facebook post cards', async () => {
      const { PostsFeedClient } = await import('../../src/app/tenant/posts/PostsFeedClient');

      const samplePosts = [
        {
          id: 'post-fb-creator',
          createdAt: '2026-08-20T14:00:00Z',
          publishedAt: '2026-08-20T14:00:00Z',
          rawPayload: {
            providerId: 'facebook',
            externalId: 'fb_1',
            pageId: 'page_101',
            pageName: 'Acme Europe',
            author: 'Jane Community Specialist',
            message: 'Community highlight of the week!',
          },
        },
        {
          id: 'post-fb-page',
          createdAt: '2026-08-20T15:00:00Z',
          publishedAt: '2026-08-20T15:00:00Z',
          rawPayload: {
            providerId: 'facebook',
            externalId: 'fb_2',
            pageId: 'page_101',
            pageName: 'Acme Europe',
            author: 'Acme Europe',
            message: 'Official press release.',
          },
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(PostsFeedClient, { posts: samplePosts as any, watchlists: [] })
      );

      // Facebook Page badge
      expect(html).toContain('Facebook Page');

      // Hosting Page badge for both posts
      expect(html).toContain('📍 Page: Acme Europe');
      expect(html).toContain('pf-post-page-badge');

      // Distinct creator author "By: Jane Community Specialist" rendered on first post
      expect(html).toContain('By: Jane Community Specialist');

      // Second post should NOT render "By: Acme Europe" redundant author badge
      expect(html).not.toContain('By: Acme Europe');
    });
  });

  // -------------------------------------------------------------------------
  // AC3: Post Detail Panel & Slideover Telemetry
  // -------------------------------------------------------------------------
  describe('AC3: PostDetailPanel and Slideover Telemetry', () => {
    it('PostDetailPanel renders Hosting Facebook Page row with pageName and pageId', async () => {
      const { PostDetailPanel } = await import('../../src/app/tenant/posts/PostDetailPanel');

      const samplePost = {
        id: 'post-fb-detail',
        createdAt: '2026-08-20T16:00:00Z',
        provider: 'facebook',
        rawPayload: {
          providerId: 'facebook',
          externalId: 'fb_3',
          pageId: 'page_555',
          pageName: 'Acme Global Marketing',
          author: 'Michael Editor',
          message: 'Product launch details',
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(PostDetailPanel, { post: samplePost as any })
      );

      expect(html).toContain('Hosting Facebook Page');
      expect(html).toContain('Acme Global Marketing');
      expect(html).toContain('ID: page_555');
    });
  });

  // -------------------------------------------------------------------------
  // AC4: Search Matching by Facebook Page Name
  // -------------------------------------------------------------------------
  describe('AC4: Search Matching by Facebook Page Name in PostsFeedClient.tsx', () => {
    it('source code includes pageName in search filtering predicate', () => {
      const source = readSrc('app', 'tenant', 'posts', 'PostsFeedClient.tsx');
      expect(source).toContain('post.pageName');
    });
  });

  // -------------------------------------------------------------------------
  // AC5: CSS Styles in globals.css
  // -------------------------------------------------------------------------
  describe('AC5: CSS Classes in globals.css', () => {
    it('globals.css defines .pf-post-page-badge and .pf-page-id-code', () => {
      const css = readSrc('app', 'globals.css');
      expect(css).toContain('.pf-post-page-badge');
      expect(css).toContain('.pf-page-id-code');
    });
  });
});
