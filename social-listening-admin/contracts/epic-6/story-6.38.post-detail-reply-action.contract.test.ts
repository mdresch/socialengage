/**
 * Contract: Story 6.38 — Post Detail Reply Action, Composer Drawer, and Replies Tab
 * Sourced from ADR-0073 (Accepted 2026-08-22).
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-638
 *
 * Intent:
 * 1. PostDetailPanel shows a "Reply" button when the post's provider supports replies
 *    and the caller has a connected credential for that provider; otherwise disabled.
 * 2. Clicking Reply opens a cascading ReplyComposerDrawer (same slideover-shifted
 *    dual-drawer pattern as EnrichmentEditDrawer) reusing PolypostComposer's text
 *    area and character counter. Media upload and AI assist are not rendered for v1.
 * 3. Submitting calls POST /api/posts/[id]/replies; on 201 the drawer closes and the
 *    new reply is optimistically appended to a new "Replies" tab, with a success toast.
 *    On failure an error toast appears and the row shows a failed status.
 * 4. A "Replies" tab in PostDetailPanel fetches GET /api/posts/[id]/replies and shows
 *    each reply's body, sent/failed badge, timestamp, and live link for sent replies.
 * 5. Loading, empty ("No replies yet."), and error states are handled.
 * 6. Jest contract test asserts conditional button, composer UI, and failed reply display.
 *
 * Scope:
 * - social-listening-admin/src/app/tenant/posts/ReplyComposerDrawer.tsx (new)
 * - social-listening-admin/src/app/tenant/posts/PostRepliesTab.tsx (new)
 * - social-listening-admin/src/app/tenant/posts/PostDetailPanel.tsx (add Reply, Replies tab)
 * - social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx (state, optimistic update)
 * - social-listening-admin/src/lib/core-client.ts (submitReply, listReplies)
 * - social-listening-admin/src/app/api/posts/[id]/replies/route.ts (new BFF proxy)
 * - social-listening-admin/.claude/skills/post-feed/SKILL.md (update)
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

function makePost(provider: string, rawPayload: unknown = { providerId: provider }) {
  return {
    id: 'post-123',
    createdAt: '2026-08-22T10:00:00Z',
    rawPayload,
    bodyMarkdown: 'Ingested post body',
    snippet: 'Ingested post snippet',
    provider,
    enrichmentSummary: null,
  };
}

describe('Story 6.38 — Post Detail Reply Action, Composer Drawer, and Replies Tab', () => {
  // -----------------------------------------------------------------------
  // AC1: Reply button is conditionally rendered
  // -----------------------------------------------------------------------
  describe('AC1: Reply button is conditionally rendered', () => {
    it('PostDetailPanel renders an enabled Reply button for a supported provider with a credential', async () => {
      const { PostDetailPanel } = await import('../../src/app/tenant/posts/PostDetailPanel');
      const html = renderToStaticMarkup(
        React.createElement(PostDetailPanel, {
          post: makePost('facebook'),
          facebookPages: [{ pageId: 'p1', pageName: 'SocialEngage Page' }],
          onReply: () => {},
        })
      );
      expect(html).toContain('Reply');
      expect(html).toContain('aria-label="Reply"');
      expect(html).not.toContain('disabled="disabled"');
      expect(html).not.toContain('disabled');
    });

    it('PostDetailPanel disables the Reply button with a tooltip for an unsupported provider', async () => {
      const { PostDetailPanel } = await import('../../src/app/tenant/posts/PostDetailPanel');
      const html = renderToStaticMarkup(
        React.createElement(PostDetailPanel, { post: makePost('gnews') })
      );
      expect(html).toContain('Reply');
      expect(html).toContain('disabled');
      expect(html).toMatch(/not supported/i);
    });

    it('PostDetailPanel disables the Reply button with a credential tooltip when no credential is connected', async () => {
      const { PostDetailPanel } = await import('../../src/app/tenant/posts/PostDetailPanel');
      const html = renderToStaticMarkup(
        React.createElement(PostDetailPanel, {
          post: makePost('facebook'),
          facebookPages: [],
        })
      );
      expect(html).toContain('Reply');
      expect(html).toContain('disabled');
      expect(html).toMatch(/credential/i);
    });
  });

  // -----------------------------------------------------------------------
  // AC2: ReplyComposerDrawer UI
  // -----------------------------------------------------------------------
  describe('AC2: ReplyComposerDrawer reuses the text area and character counter', () => {
    it('ReplyComposerDrawer renders a dialog, a textarea, and a character counter', async () => {
      const { ReplyComposerDrawer } = await import('../../src/app/tenant/posts/ReplyComposerDrawer');
      const html = renderToStaticMarkup(
        React.createElement(ReplyComposerDrawer, {
          isOpen: true,
          onClose: () => {},
          post: makePost('facebook'),
          onSubmit: async () => {},
        })
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('<textarea');
      expect(html).toContain('Send Reply');
      // character counter of form N/maxChars
      expect(html).toMatch(/\d+\/\d+/);
      // v1 disables media/AI
      expect(html).not.toContain('type="file"');
      expect(html).not.toMatch(/AI Assist/i);
      expect(html).not.toMatch(/Upload media/i);
    });
  });

  // -----------------------------------------------------------------------
  // AC3: Replies tab
  // -----------------------------------------------------------------------
  describe('AC3: Replies tab displays status, timestamps, and live links', () => {
    it('PostRepliesTab renders "No replies yet." when the list is empty', async () => {
      const { PostRepliesTab } = await import('../../src/app/tenant/posts/PostRepliesTab');
      const html = renderToStaticMarkup(
        React.createElement(PostRepliesTab, { postId: 'post-123', initialReplies: [] })
      );
      expect(html).toContain('No replies yet.');
    });

    it('PostRepliesTab renders sent and failed replies with status badges and error codes', async () => {
      const { PostRepliesTab } = await import('../../src/app/tenant/posts/PostRepliesTab');
      const replies = [
        {
          id: 'r1',
          postId: 'post-123',
          providerId: 'facebook',
          userId: 'u1',
          credentialId: 'c1',
          activityType: 'reply' as const,
          body: 'Thanks for the mention!',
          status: 'sent' as const,
          externalId: 'e1',
          externalUrl: 'https://www.facebook.com/socialengage/posts/1/comments/2',
          errorCode: null,
          createdAt: '2026-08-22T10:05:00Z',
          sentAt: '2026-08-22T10:05:01Z',
          failedAt: null,
        },
        {
          id: 'r2',
          postId: 'post-123',
          providerId: 'facebook',
          userId: 'u1',
          credentialId: 'c1',
          activityType: 'reply' as const,
          body: 'Another attempt',
          status: 'failed' as const,
          externalId: null,
          externalUrl: null,
          errorCode: 'REPLY_NOT_AVAILABLE',
          createdAt: '2026-08-22T10:06:00Z',
          sentAt: null,
          failedAt: '2026-08-22T10:06:01Z',
        },
      ];
      const html = renderToStaticMarkup(
        React.createElement(PostRepliesTab, { postId: 'post-123', initialReplies: replies })
      );
      expect(html).toContain('Thanks for the mention!');
      expect(html).toContain('https://www.facebook.com/socialengage/posts/1/comments/2');
      expect(html).toContain('failed');
      expect(html).toContain('REPLY_NOT_AVAILABLE');
    });
  });

  // -----------------------------------------------------------------------
  // AC4: Core client and BFF proxy
  // -----------------------------------------------------------------------
  describe('AC4: Core client and BFF proxy', () => {
    it('core-client.ts exports submitReply and listReplies', () => {
      const source = readSrc('lib', 'core-client.ts');
      expect(source).toMatch(/export async function submitReply\(/);
      expect(source).toMatch(/export async function listReplies\(/);
    });

    it('POST /api/posts/[id]/replies and GET /api/posts/[id]/replies route proxies to core-client', () => {
      const routeSource = readSrc('app', 'api', 'posts', '[id]', 'replies', 'route.ts');
      expect(routeSource).toContain('submitReply');
      expect(routeSource).toContain('listReplies');
      expect(routeSource).toContain('POST');
      expect(routeSource).toContain('GET');
    });
  });

  // -----------------------------------------------------------------------
  // AC5: PostsFeedClient integration
  // -----------------------------------------------------------------------
  describe('AC5: PostsFeedClient integration', () => {
    it('PostsFeedClient.tsx integrates ReplyComposerDrawer and PostRepliesTab', () => {
      const source = readSrc('app', 'tenant', 'posts', 'PostsFeedClient.tsx');
      expect(source).toContain('ReplyComposerDrawer');
      expect(source).toContain('PostRepliesTab');
      expect(source).toContain('setIsReplying');
      expect(source).toContain('onReply');
    });

    it('PostsFeedClient.tsx applies the slideover-shifted class when the reply drawer is open', () => {
      const source = readSrc('app', 'tenant', 'posts', 'PostsFeedClient.tsx');
      expect(source).toMatch(/isReplying\s*\?\s*['"]slideover-shifted/);
      expect(source).toContain('slideover-shifted');
    });
  });
});
