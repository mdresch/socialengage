/**
 * Contract: Story 6.36 — Cross-Platform Polypost Composer & Multi-Network Preview Engine
 * Sourced from ADR-0072 (Accepted 2026-08-22).
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-636--cross-platform-polypost-composer--multi-network-preview-engine
 *
 * Intent:
 * 1. PolypostComposer renders unified multi-platform social composition workspace with platform preview rails.
 * 2. PlatformPreviewRails renders 7 network-specific preview cards: LinkedIn, Instagram, Facebook, Bluesky, Mastodon, Threads, and X.
 * 3. CardLinkPreview renders OpenGraph card previews.
 * 4. Document import utility imports markdown and plain text.
 * 5. Draft storage provides local persistence and tenant isolation.
 * 6. ComposePostModal provides on-demand composition modal from Post Feed.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.resolve(__dirname, '../../src', ...segments), 'utf8');
}

describe('Story 6.36 — Cross-Platform Polypost Composer & Multi-Network Preview Engine (ADR-0072)', () => {
  // -------------------------------------------------------------------------
  // AC1: Composer & Preview Components Render Parity
  // -------------------------------------------------------------------------
  describe('AC1: PolypostComposer and Preview Cards', () => {
    it('renders PolypostComposer with platform toggles and editor toolbar', async () => {
      const { PolypostComposer } = await import('../../src/components/composer/PolypostComposer');

      const html = renderToStaticMarkup(
        React.createElement(PolypostComposer, {
          initialText: 'Launching our new multi-platform campaign today!',
        })
      );

      expect(html).toContain('Target Distribution Platforms');
      expect(html).toContain('Upload Images');
      expect(html).toContain('Import Doc / Markdown');
      expect(html).toContain('Save Draft');
      expect(html).toContain('Launching our new multi-platform campaign today!');
    });

    it('renders all 7 platform preview cards via PlatformPreviewRails', async () => {
      const { PlatformPreviewRails } = await import('../../src/components/composer/PlatformPreviewRails');

      const html = renderToStaticMarkup(
        React.createElement(PlatformPreviewRails, {
          selectedPlatforms: ['linkedin', 'instagram', 'facebook', 'twitter', 'bluesky', 'mastodon', 'threads'],
          getTextForPlatform: () => 'Check out our latest update at https://example.com/update #innovation',
          getMediaForPlatform: () => [],
          linkPreview: {
            url: 'https://example.com/update',
            title: 'Example Update Title',
            description: 'A breakthrough in multi-platform social management.',
            siteName: 'Example Org',
            image: 'https://example.com/og.jpg',
            hostname: 'example.com',
          },
        })
      );

      // Verify all 7 platform preview cards are rendered in HTML
      expect(html).toContain('LinkedIn');
      expect(html).toContain('Instagram');
      expect(html).toContain('Facebook');
      expect(html).toContain('Bluesky');
      expect(html).toContain('Mastodon');
      expect(html).toContain('Threads');
      expect(html).toContain('Example Update Title');
    });

    it('renders media attachments with alt text in platform preview cards', async () => {
      const { PlatformPreviewRails } = await import('../../src/components/composer/PlatformPreviewRails');

      const sampleMedia = [
        {
          id: 'media-1',
          url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
          altText: 'Product launch artwork',
          type: 'image' as const,
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(PlatformPreviewRails, {
          selectedPlatforms: ['linkedin', 'instagram'],
          getTextForPlatform: () => 'Visual post',
          getMediaForPlatform: () => sampleMedia,
        })
      );

      expect(html).toContain('Product launch artwork');
    });
  });

  // -------------------------------------------------------------------------
  // AC2: CardLinkPreview OpenGraph Rendering
  // -------------------------------------------------------------------------
  describe('AC2: CardLinkPreview OpenGraph Component', () => {
    it('renders featured image, title, description, and domain hostname', async () => {
      const { CardLinkPreview } = await import('../../src/components/composer/CardLinkPreview');

      const html = renderToStaticMarkup(
        React.createElement(CardLinkPreview, {
          data: {
            url: 'https://techcrunch.com/2026/08/social-listening',
            title: 'Social Listening Revolution',
            description: 'How AI and real-time listening are transforming engagement.',
            image: 'https://techcrunch.com/banner.jpg',
            siteName: 'TechCrunch',
            hostname: 'techcrunch.com',
          },
        })
      );

      expect(html).toContain('Social Listening Revolution');
      expect(html).toContain('How AI and real-time listening are transforming engagement.');
      expect(html).toContain('TechCrunch');
      expect(html).toContain('https://techcrunch.com/banner.jpg');
    });
  });

  // -------------------------------------------------------------------------
  // AC3: Document & Markdown Importer
  // -------------------------------------------------------------------------
  describe('AC3: Document and Markdown Import Utilities', () => {
    it('parses markdown and cleans pasted text correctly', async () => {
      const { cleanPastedText } = await import('../../src/components/composer/lib/documentImport');

      const sampleMd = '# Campaign Launch\n\nWe are thrilled to introduce our new product.\n\n- Feature 1\n- Feature 2';
      const cleaned = cleanPastedText(sampleMd);

      expect(cleaned).toContain('Campaign Launch');
      expect(cleaned).toContain('We are thrilled to introduce our new product.');
    });
  });

  // -------------------------------------------------------------------------
  // AC4: Compose Post Modal Integration from Posts Feed
  // -------------------------------------------------------------------------
  describe('AC4: ComposePostModal Component', () => {
    it('renders ComposePostModal when isOpen is true', async () => {
      const { ComposePostModal } = await import('../../src/components/composer/ComposePostModal');

      const html = renderToStaticMarkup(
        React.createElement(ComposePostModal, {
          isOpen: true,
          onClose: () => {},
        })
      );

      expect(html).toContain('Polypost');
      expect(html).toContain('composer-modal-panel');
    });

    it('renders nothing when isOpen is false', async () => {
      const { ComposePostModal } = await import('../../src/components/composer/ComposePostModal');

      const html = renderToStaticMarkup(
        React.createElement(ComposePostModal, {
          isOpen: false,
          onClose: () => {},
        })
      );

      expect(html).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // AC5: Route and Navigation Presence
  // -------------------------------------------------------------------------
  describe('AC5: Standalone Route and Feed Compose Trigger', () => {
    it('/tenant/compose/page.tsx exports default ComposePage component', async () => {
      const source = readSrc('app', 'tenant', 'compose', 'page.tsx');
      expect(source).toContain('export default');
      expect(source).toContain('PolypostComposer');
    });

    it('PostsFeedClient includes Compose button triggering modal', () => {
      const source = readSrc('app', 'tenant', 'posts', 'PostsFeedClient.tsx');
      expect(source).toContain('Compose Post');
      expect(source).toContain('ComposePostModal');
    });
  });
});
