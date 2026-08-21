/**
 * Contract: Story 6.34 — Instagram Business Connector Setup, Multi-Account Picker, and Post Feed/Drawer Presentation
 * Sourced from ADR-0068 (Accepted 2026-08-20).
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-634
 *
 * Acceptance Criteria to verify:
 * 1. Platform Definition & Branding: instagram is defined with Tier-3 scope (personalScopeAllowed: true, tenantScopeAllowed: false), authMode: 'oauth', color: 'pink', icon: 'instagram'.
 * 2. Post Display Helpers: extractInstagramContext and flattenPost extract handle, media type, gallery children, and engagement.
 * 3. Post Feed Presentation: PostsFeedClient renders Instagram Business badge, @username handle badge, media preview, and engagement chips.
 * 4. Post Detail Panel & Carousel Gallery: PostDetailPanel renders carousel gallery for CAROUSEL_ALBUM, truncated link notice, and Hosting Instagram Account telemetry row.
 * 5. Connector Status View: ConnectorStatusClient tracks Instagram status, polling cadence, and reconnect_required alerts.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.resolve(__dirname, '../../src', ...segments), 'utf8');
}

describe('Story 6.34 — Instagram Business Connector UI (ADR-0068)', () => {
  // -------------------------------------------------------------------------
  // AC1: Platform Definition & Tier-3 Scope
  // -------------------------------------------------------------------------
  describe('AC1: Platform Definition & Tier-3 Scope', () => {
    it('defines instagram with Tier-3 personal scope and Meta Graph API branding in connectors page', () => {
      const pageSrc = readSrc('app/tenant/connectors/page.tsx');
      expect(pageSrc).toContain("id: 'instagram'");
      expect(pageSrc).toContain("name: 'Instagram Business'");
      expect(pageSrc).toContain("authMode: 'oauth'");
      expect(pageSrc).toContain("icon: 'instagram'");
      expect(pageSrc).toContain('personalScopeAllowed: true');
      expect(pageSrc).toContain('tenantScopeAllowed: false');
    });

    it('defines instagram in status/page.tsx under Ingestion category', () => {
      const statusSrc = readSrc('app/tenant/connectors/status/page.tsx');
      expect(statusSrc).toContain("id: 'instagram'");
      expect(statusSrc).toContain("category: 'Ingestion'");
      expect(statusSrc).toContain('personalScopeAllowed: true');
      expect(statusSrc).toContain('tenantScopeAllowed: false');
    });

    it('defines IconInstagram and supports pink color in ConnectorsClient.tsx', () => {
      const clientSrc = readSrc('app/tenant/connectors/ConnectorsClient.tsx');
      expect(clientSrc).toContain('function IconInstagram');
      expect(clientSrc).toContain("case 'instagram':");
      expect(clientSrc).toContain("'pink'");
    });
  });

  // -------------------------------------------------------------------------
  // AC2: Display Derivation Helpers & FlatPost mapping (postDisplay.ts)
  // -------------------------------------------------------------------------
  describe('AC2: Display Derivation Helpers in postDisplay.ts', () => {
    it('extractInstagramContext extracts account, media, carousel children, and engagement', async () => {
      const { extractInstagramContext, flattenPost, extractDisplayText, extractUrl } = await import('../../src/app/tenant/posts/postDisplay');

      const carouselPayload = {
        providerId: 'instagram',
        externalId: 'instagram_17841400_987654',
        igUserId: '17841400123',
        username: 'acme_official',
        pageId: 'page_456',
        pageName: 'Acme Global',
        caption: 'Look at our new summer product line! #summer #launch',
        mediaType: 'CAROUSEL_ALBUM',
        permalink: 'https://www.instagram.com/p/C-123456789/',
        likeCount: 420,
        commentsCount: 35,
        children: [
          { id: 'child_1', mediaType: 'IMAGE', mediaUrl: 'https://cdn.instagram.com/pic1.jpg', thumbnailUrl: 'https://cdn.instagram.com/thumb1.jpg' },
          { id: 'child_2', mediaType: 'IMAGE', mediaUrl: 'https://cdn.instagram.com/pic2.jpg', thumbnailUrl: 'https://cdn.instagram.com/thumb2.jpg' },
        ],
        childrenTruncated: true,
      };

      const ctx = extractInstagramContext(carouselPayload);
      expect(ctx).not.toBeNull();
      expect(ctx?.igUserId).toBe('17841400123');
      expect(ctx?.username).toBe('acme_official');
      expect(ctx?.pageName).toBe('Acme Global');
      expect(ctx?.mediaType).toBe('CAROUSEL_ALBUM');
      expect(ctx?.likeCount).toBe(420);
      expect(ctx?.commentsCount).toBe(35);
      expect(ctx?.children).toHaveLength(2);
      expect(ctx?.childrenTruncated).toBe(true);

      expect(extractDisplayText(carouselPayload).title).toBe('Look at our new summer product line! #summer #launch');
      expect(extractUrl(carouselPayload)).toBe('https://www.instagram.com/p/C-123456789/');

      const flat = flattenPost({
        id: 'post-ig-1',
        createdAt: '2026-08-20T12:00:00Z',
        rawPayload: carouselPayload,
      } as any);

      expect(flat.provider).toBe('instagram');
      expect(flat.author).toBe('acme_official');
      expect(flat.pageName).toBe('Acme Global');
      expect(flat.instagramContext?.username).toBe('acme_official');
      expect(flat.instagramContext?.children).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // AC3: Post Feed Card Presentation (PostsFeedClient.tsx)
  // -------------------------------------------------------------------------
  describe('AC3: Post Card Presentation in PostsFeedClient.tsx', () => {
    it('renders Instagram Business badge, @username handle, media preview, and engagement chips', async () => {
      const { PostsFeedClient } = await import('../../src/app/tenant/posts/PostsFeedClient');

      const samplePosts = [
        {
          id: 'post-ig-1',
          createdAt: '2026-08-20T14:00:00Z',
          publishedAt: '2026-08-20T14:00:00Z',
          rawPayload: {
            providerId: 'instagram',
            externalId: 'instagram_101_202',
            igUserId: '101',
            username: 'acme_design',
            caption: 'Behind the scenes at our design studio.',
            mediaType: 'IMAGE',
            thumbnailUrl: 'https://cdn.instagram.com/preview_thumb.jpg',
            mediaUrl: 'https://cdn.instagram.com/preview_full.jpg',
            likeCount: 1540,
            commentsCount: 88,
          },
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(PostsFeedClient, { posts: samplePosts as any, watchlists: [] })
      );

      // Provider badge & handle badge
      expect(html).toContain('Instagram Business');
      expect(html).toContain('📍 @acme_design');

      // Caption / title
      expect(html).toContain('Behind the scenes at our design studio.');

      // Media thumbnail preview
      expect(html).toContain('src="https://cdn.instagram.com/preview_thumb.jpg"');
      expect(html).toContain('pf-media-thumbnail');

      // Engagement chips
      expect(html).toContain('❤️ 1540');
      expect(html).toContain('💬 88');
    });
  });

  // -------------------------------------------------------------------------
  // AC4: Post Detail Panel & Carousel Gallery (PostDetailPanel.tsx)
  // -------------------------------------------------------------------------
  describe('AC4: Post Detail Panel & Carousel Gallery in PostDetailPanel.tsx', () => {
    it('renders carousel gallery items, truncation link, and hosting Instagram account telemetry row', async () => {
      const { PostDetailPanel } = await import('../../src/app/tenant/posts/PostDetailPanel');

      const postWithGallery = {
        id: 'post-ig-carousel',
        createdAt: '2026-08-20T16:00:00Z',
        provider: 'instagram',
        bodyMarkdown: null,
        snippet: 'Carousel caption sample',
        enrichmentSummary: null,
        rawPayload: {
          providerId: 'instagram',
          externalId: 'ig_car_1',
          igUserId: '17841400999',
          username: 'brand_creator',
          pageName: 'Brand Page Official',
          mediaType: 'CAROUSEL_ALBUM',
          permalink: 'https://www.instagram.com/p/gallery123/',
          children: [
            { id: 'c1', mediaType: 'IMAGE', thumbnailUrl: 'https://cdn.instagram.com/c1_thumb.jpg' },
            { id: 'c2', mediaType: 'IMAGE', thumbnailUrl: 'https://cdn.instagram.com/c2_thumb.jpg' },
            { id: 'c3', mediaType: 'VIDEO', thumbnailUrl: 'https://cdn.instagram.com/c3_thumb.jpg' },
          ],
          childrenTruncated: true,
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(PostDetailPanel, { post: postWithGallery as any })
      );

      // Section title & gallery container
      expect(html).toContain('Instagram Carousel Gallery (3 items)');
      expect(html).toContain('pf-carousel-gallery');

      // Child thumbnails
      expect(html).toContain('src="https://cdn.instagram.com/c1_thumb.jpg"');
      expect(html).toContain('src="https://cdn.instagram.com/c2_thumb.jpg"');
      expect(html).toContain('src="https://cdn.instagram.com/c3_thumb.jpg"');

      // Truncation notice link
      expect(html).toContain('href="https://www.instagram.com/p/gallery123/"');
      expect(html).toContain('View full gallery on Instagram →');

      // Telemetry row
      expect(html).toContain('Hosting Instagram Account');
      expect(html).toContain('@brand_creator');
      expect(html).toContain('(ID: 17841400999)');
      expect(html).toContain('via Brand Page Official');
    });
  });

  // -------------------------------------------------------------------------
  // AC5: Connector Status & Health Telemetry (ConnectorStatusClient.tsx)
  // -------------------------------------------------------------------------
  describe('AC5: Connector Status & Polling Cadence', () => {
    it('defines 30m polling cadence for instagram in ConnectorStatusClient.tsx', () => {
      const statusClientSrc = readSrc('app/tenant/connectors/status/ConnectorStatusClient.tsx');
      expect(statusClientSrc).toContain('instagram: 30');
    });

    it('renders reconnect_required alert badge and status metrics for instagram', async () => {
      const { ConnectorStatusClient } = await import('../../src/app/tenant/connectors/status/ConnectorStatusClient');

      const rows = [
        {
          platform: {
            id: 'instagram',
            name: 'Instagram Business',
            authMode: 'oauth' as const,
            category: 'Ingestion',
            description: 'Ingests photos and carousels.',
            personalScopeAllowed: true,
            tenantScopeAllowed: false,
          },
          isActive: true,
          health: {
            status: 'reconnect_required' as const,
            lastSuccessfulFetchAt: '2026-08-20T10:00:00Z',
            lastAttemptAt: '2026-08-20T11:00:00Z',
            consecutiveFailures: 2,
            credentialStatus: 'revoked' as const,
            isActive: true,
          },
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(ConnectorStatusClient, { rows: rows as any, isTenantAdmin: true })
      );

      expect(html).toContain('Instagram Business');
      expect(html).toContain('Interval: every 30 minutes');
      expect(html).toContain('Reconnect Required');
    });
  });

  // -------------------------------------------------------------------------
  // AC6: OAuth Connect Flow & Multi-Account Picker Modal (ConnectorsClient.tsx)
  // -------------------------------------------------------------------------
  describe('AC6: OAuth Connect Flow & Multi-Account Picker Modal', () => {
    it('generates authorize URL with instagram_basic, pages_show_list, pages_read_engagement scopes', async () => {
      const { instagramAuthorizeUrl } = await import('../../src/lib/instagramOAuth');
      const url = instagramAuthorizeUrl('mock_state_123');
      expect(url).toContain('scope=instagram_basic%2Cpages_show_list%2Cpages_read_engagement');
      expect(url).toContain('response_type=code');
      expect(url).toContain('state=mock_state_123');
    });

    it('renders Instagram account picker modal when pending OAuth session is present', async () => {
      const { ConnectorsClient } = await import('../../src/app/tenant/connectors/ConnectorsClient');
      const platforms = [
        {
          id: 'instagram',
          name: 'Instagram Business',
          subtitle: 'Meta Graph API Ingestion Source',
          description: 'Ingests photos, videos, reels.',
          authMode: 'oauth' as const,
          color: 'pink' as const,
          icon: 'instagram' as const,
          adNotice: null,
          credentialFields: [],
          personalScopeAllowed: true,
          tenantScopeAllowed: false,
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(ConnectorsClient, {
          platforms,
          initialStates: [{ platformId: 'instagram', connected: false, credentialStatus: null, isActive: false, status: null, maskedHint: null }],
          isTenantAdmin: false,
          initialInstagramPending: {
            sessionToken: 'sess_123',
            accounts: [
              { igUserId: 'ig_1', username: 'acme_store', name: 'Acme Store', pageId: 'pg_1', pageName: 'Acme Corp' },
              { igUserId: 'ig_2', username: 'acme_support', name: 'Acme Help', pageId: 'pg_2', pageName: 'Acme Support' },
            ],
          },
        })
      );

      expect(html).toContain('Choose Instagram Accounts');
      expect(html).toContain('@acme_store');
      expect(html).toContain('@acme_support');
      expect(html).toContain('Page: Acme Corp');
      expect(html).toContain('Page: Acme Support');
    });

    it('renders connected Instagram accounts list with handle and status', async () => {
      const { ConnectorsClient } = await import('../../src/app/tenant/connectors/ConnectorsClient');
      const platforms = [
        {
          id: 'instagram',
          name: 'Instagram Business',
          subtitle: 'Meta Graph API Ingestion Source',
          description: 'Ingests photos, videos, reels.',
          authMode: 'oauth' as const,
          color: 'pink' as const,
          icon: 'instagram' as const,
          adNotice: null,
          credentialFields: [],
          personalScopeAllowed: true,
          tenantScopeAllowed: false,
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(ConnectorsClient, {
          platforms,
          initialStates: [{ platformId: 'instagram', connected: true, credentialStatus: 'valid', isActive: true, status: 'healthy', maskedHint: null }],
          isTenantAdmin: false,
          initialInstagramAccounts: {
            parentConnectionActive: true,
            accounts: [
              {
                id: 'acc_row_1',
                igUserId: 'ig_1',
                username: 'brand_official',
                pageId: 'pg_1',
                pageName: 'Brand Main Page',
                status: 'connected',
                connectorHealth: {
                  status: 'healthy',
                  lastSuccessfulFetchAt: '2026-08-21T00:00:00Z',
                  lastAttemptAt: '2026-08-21T00:00:00Z',
                  consecutiveFailures: 0,
                  credentialStatus: 'valid',
                },
              },
            ],
          },
        })
      );

      expect(html).toContain('@brand_official');
      expect(html).toContain('Brand Main Page');
      expect(html).toContain('Disconnect this Account');
    });
  });
});
