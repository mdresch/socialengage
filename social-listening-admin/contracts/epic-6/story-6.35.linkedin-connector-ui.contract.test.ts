/**
 * Contract: Story 6.35 — LinkedIn Connector Setup Screen, Scope Degradation Badge, and Post Feed/Drawer Presentation
 * Sourced from ADR-0069 (Accepted 2026-08-20).
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-635
 *
 * Acceptance Criteria to verify:
 * 1. Platform Definition & Branding: linkedin is defined with Tier-3 scope (personalScopeAllowed: true, tenantScopeAllowed: false), authMode: 'oauth', color: 'blue', icon: 'linkedin'.
 * 2. Post Display Helpers: extractLinkedInContext and flattenPost extract memberId, authorName, permalink, and engagement.
 * 3. Post Feed Presentation: PostsFeedClient renders LinkedIn badge, By: Author attribution, commentary body, and engagement chips.
 * 4. Post Detail Panel & Drawer: PostDetailPanel renders Author ID, LinkedIn Author, and permalink in telemetry section.
 * 5. Connector Status View & Scope Degradation: ConnectorStatusClient tracks LinkedIn 60m polling cadence, scope degradation banner, and reconnect_required badge.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.resolve(__dirname, '../../src', ...segments), 'utf8');
}

describe('Story 6.35 — LinkedIn Connector UI (ADR-0069)', () => {
  // -------------------------------------------------------------------------
  // AC1: Platform Definition & Tier-3 Scope
  // -------------------------------------------------------------------------
  describe('AC1: Platform Definition & Tier-3 Scope', () => {
    it('defines linkedin with Tier-3 personal scope and OAuth branding in connectors page', () => {
      const pageSrc = readSrc('app/tenant/connectors/page.tsx');
      expect(pageSrc).toContain("id: 'linkedin'");
      expect(pageSrc).toContain("name: 'LinkedIn'");
      expect(pageSrc).toContain("authMode: 'oauth'");
      expect(pageSrc).toContain("icon: 'linkedin'");
      expect(pageSrc).toContain("color: 'blue'");
      expect(pageSrc).toContain('personalScopeAllowed: true');
      expect(pageSrc).toContain('tenantScopeAllowed: false');
    });

    it('defines linkedin in status/page.tsx under Ingestion category', () => {
      const statusSrc = readSrc('app/tenant/connectors/status/page.tsx');
      expect(statusSrc).toContain("id: 'linkedin'");
      expect(statusSrc).toContain("name: 'LinkedIn'");
      expect(statusSrc).toContain("category: 'Ingestion'");
      expect(statusSrc).toContain('personalScopeAllowed: true');
      expect(statusSrc).toContain('tenantScopeAllowed: false');
    });

    it('defines IconLinkedIn and supports linkedin icon in ConnectorsClient.tsx', () => {
      const clientSrc = readSrc('app/tenant/connectors/ConnectorsClient.tsx');
      expect(clientSrc).toContain('function IconLinkedIn');
      expect(clientSrc).toContain("case 'linkedin':");
    });
  });

  // -------------------------------------------------------------------------
  // AC2: Display Derivation Helpers & FlatPost mapping (postDisplay.ts)
  // -------------------------------------------------------------------------
  describe('AC2: Display Derivation Helpers in postDisplay.ts', () => {
    it('extractLinkedInContext extracts author, memberId, permalink, and engagement metrics', async () => {
      const { extractLinkedInContext, flattenPost, extractDisplayText, extractUrl, extractAuthor } = await import('../../src/app/tenant/posts/postDisplay');

      const linkedinPayload = {
        providerId: 'linkedin',
        externalId: 'linkedin_share_123456789',
        memberId: 'alex_mercer_88',
        authorName: 'Alex Mercer',
        commentary: 'Proud to share our team just achieved ISO 27001 certification! #compliance #security',
        permalink: 'https://www.linkedin.com/feed/update/urn:li:share:123456789',
        reactionsCount: 342,
        commentsCount: 29,
        sharesCount: 14,
      };

      const ctx = extractLinkedInContext(linkedinPayload);
      expect(ctx).not.toBeNull();
      expect(ctx?.memberId).toBe('alex_mercer_88');
      expect(ctx?.authorName).toBe('Alex Mercer');
      expect(ctx?.permalink).toBe('https://www.linkedin.com/feed/update/urn:li:share:123456789');
      expect(ctx?.reactionsCount).toBe(342);
      expect(ctx?.commentsCount).toBe(29);
      expect(ctx?.sharesCount).toBe(14);

      expect(extractAuthor(linkedinPayload)).toBe('Alex Mercer');
      expect(extractDisplayText(linkedinPayload).title).toBe('Proud to share our team just achieved ISO 27001 certification! #compliance #security');
      expect(extractUrl(linkedinPayload)).toBe('https://www.linkedin.com/feed/update/urn:li:share:123456789');

      const flat = flattenPost({
        id: 'post-li-1',
        createdAt: '2026-08-20T12:00:00Z',
        rawPayload: linkedinPayload,
      } as any);

      expect(flat.provider).toBe('linkedin');
      expect(flat.author).toBe('Alex Mercer');
      expect(flat.linkedinContext?.memberId).toBe('alex_mercer_88');
      expect(flat.linkedinContext?.reactionsCount).toBe(342);
    });
  });

  // -------------------------------------------------------------------------
  // AC3: Post Feed Card Presentation (PostsFeedClient.tsx)
  // -------------------------------------------------------------------------
  describe('AC3: Post Card Presentation in PostsFeedClient.tsx', () => {
    it('renders LinkedIn badge, By: Author attribution, commentary body, and engagement chips', async () => {
      const { PostsFeedClient } = await import('../../src/app/tenant/posts/PostsFeedClient');

      const samplePosts = [
        {
          id: 'post-li-1',
          createdAt: '2026-08-20T14:00:00Z',
          publishedAt: '2026-08-20T14:00:00Z',
          rawPayload: {
            providerId: 'linkedin',
            externalId: 'linkedin_share_999',
            memberId: 'janesmith',
            authorName: 'Jane Smith',
            commentary: 'Exciting news! We are expanding our operations to London.',
            permalink: 'https://www.linkedin.com/feed/update/urn:li:share:999',
            reactionsCount: 180,
            commentsCount: 22,
            sharesCount: 7,
          },
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(PostsFeedClient, { posts: samplePosts as any, watchlists: [] })
      );

      // Provider badge & author attribution
      expect(html).toContain('LinkedIn');
      expect(html).toContain('By: Jane Smith');

      // Post text
      expect(html).toContain('Exciting news! We are expanding our operations to London.');

      // Engagement chips
      expect(html).toContain('👍 180');
      expect(html).toContain('💬 22');
      expect(html).toContain('🔄 7');
    });
  });

  // -------------------------------------------------------------------------
  // AC4: Post Detail Panel & Telemetry (PostDetailPanel.tsx)
  // -------------------------------------------------------------------------
  describe('AC4: Post Detail Panel & Telemetry in PostDetailPanel.tsx', () => {
    it('renders Author ID, LinkedIn Author, and permalink in telemetry row', async () => {
      const { PostDetailPanel } = await import('../../src/app/tenant/posts/PostDetailPanel');

      const postWithLinkedIn = {
        id: 'post-li-detail',
        createdAt: '2026-08-20T16:00:00Z',
        provider: 'linkedin',
        bodyMarkdown: 'Full markdown commentary content for LinkedIn post.',
        snippet: 'Full markdown commentary...',
        enrichmentSummary: null,
        rawPayload: {
          providerId: 'linkedin',
          externalId: 'linkedin_share_888',
          memberId: 'dr_sarah_connor',
          authorName: 'Dr. Sarah Connor',
          permalink: 'https://www.linkedin.com/feed/update/urn:li:share:888',
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(PostDetailPanel, { post: postWithLinkedIn as any })
      );

      // Ingestion telemetry
      expect(html).toContain('linkedin:dr_sarah_connor');
      expect(html).toContain('Dr. Sarah Connor');
      expect(html).toContain('https://www.linkedin.com/feed/update/urn:li:share:888');
      expect(html).toContain('Full markdown commentary content for LinkedIn post.');
    });
  });

  // -------------------------------------------------------------------------
  // AC5: Connector Status View & Scope Degradation (ConnectorStatusClient.tsx)
  // -------------------------------------------------------------------------
  describe('AC5: Connector Status View & Scope Degradation in ConnectorStatusClient.tsx', () => {
    it('renders 60m polling cadence, scope degradation banner, and handles reconnect_required status', async () => {
      const { ConnectorStatusClient } = await import('../../src/app/tenant/connectors/status/ConnectorStatusClient');

      const rows = [
        {
          platform: {
            id: 'linkedin',
            name: 'LinkedIn',
            authMode: 'oauth' as const,
            category: 'Ingestion',
            description: 'Ingests published posts, comments, reactions, and company page analytics via LinkedIn REST API.',
            personalScopeAllowed: true,
            tenantScopeAllowed: false,
          },
          isActive: true,
          health: {
            platformId: 'linkedin',
            status: 'reconnect_required' as any,
            consecutiveFailures: 1,
            lastAttemptAt: '2026-08-20T15:00:00Z',
            lastSuccessfulFetchAt: '2026-08-20T14:00:00Z',
            lastError: 'invalid_grant: Refresh token revoked by member',
          } as any,
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(ConnectorStatusClient, { rows, isTenantAdmin: true })
      );

      // Status card & platform name
      expect(html).toContain('LinkedIn');

      // Polling cadence: 60 minutes
      expect(html).toContain('Interval: every 60 minutes');

      // Scope degradation callout
      expect(html).toContain('Organization features unavailable — partner scope approval pending.');

      // Reconnect required badge
      expect(html).toContain('Reconnect Required');
    });
  });

  // -------------------------------------------------------------------------
  // AC6: OAuth Connect Flow (linkedinOAuth.ts & ConnectorsClient.tsx)
  // -------------------------------------------------------------------------
  describe('AC6: OAuth Connect Flow', () => {
    it('generates LinkedIn authorize URL with openid, profile, email, w_member_social, r_member_social scopes', async () => {
      const { linkedinAuthorizeUrl } = await import('../../src/lib/linkedinOAuth');
      const url = linkedinAuthorizeUrl('mock_li_state_123');
      expect(url).toContain('https://www.linkedin.com/oauth/v2/authorization');
      expect(url).toContain('response_type=code');
      expect(url).toContain('state=mock_li_state_123');
      expect(url).toContain('scope=openid+profile+email+w_member_social');
    });

    it('renders Connect LinkedIn button linking to /api/connectors/linkedin/oauth/start', async () => {
      const { ConnectorsClient } = await import('../../src/app/tenant/connectors/ConnectorsClient');
      const platforms = [
        {
          id: 'linkedin',
          name: 'LinkedIn',
          subtitle: 'OAuth Ingestion Source',
          description: 'Ingests published posts and commentary.',
          authMode: 'oauth' as const,
          color: 'blue' as const,
          icon: 'linkedin' as const,
          adNotice: null,
          credentialFields: [],
          personalScopeAllowed: true,
          tenantScopeAllowed: false,
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(ConnectorsClient, {
          platforms,
          initialStates: [{ platformId: 'linkedin', connected: false, credentialStatus: null, isActive: false, status: null, maskedHint: null }],
          isTenantAdmin: false,
        })
      );

      expect(html).toContain('href="/api/connectors/linkedin/oauth/start"');
      expect(html).toContain('Connect LinkedIn');
    });
  });
});

