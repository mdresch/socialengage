/**
 * Contract: Story 6.31 — Human-in-the-Loop Post Enrichment Cascading Edit Drawer
 * Sourced from ADR-0071 (Accepted 2026-08-20).
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-631
 *
 * Intent:
 * 1. PostDetailPanel renders an "Edit" icon button (aria-label="Edit enrichment details") in the AI analysis header.
 * 2. Cascading dual-drawer layout allows editing enrichment side-by-side with post details on wide viewports (>= 1200px)
 *    and as an overlay on compact viewports (< 1200px).
 * 3. EnrichmentEditDrawer exposes rich form controls: sentiment segmented buttons (Positive/Neutral/Negative),
 *    key phrases tag editor (add/remove, deduplication, 50-phrase limit), ISO 639-1 language selector,
 *    ISO 3166-1 alpha-2 country selector, and executive summary/notes textarea (max 1000 chars).
 * 4. Optimistic update and core client integration: updatePostEnrichment() client method and PATCH /api/posts/[id]/enrichment
 *    BFF proxy route. POST /api/posts/[id]/enrich forwards { force: true } on confirmation.
 * 5. Visual "Edited by user" badge (.pf-override-badge) with audit tooltip (timestamp, user) rendered on overridden posts.
 * 6. Re-enrichment conflict confirmation modal prevents accidental overwrites of manual edits without user confirmation.
 * 7. Accessibility (role="dialog", aria-modal="true", aria-labelledby) and scoped Escape dismissal closing only the edit drawer.
 *
 * Scope:
 * - social-listening-admin/src/app/tenant/posts/PostDetailPanel.tsx
 * - social-listening-admin/src/app/tenant/posts/EnrichmentEditDrawer.tsx (new)
 * - social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx
 * - social-listening-admin/src/app/tenant/posts/RunEnrichmentButton.tsx
 * - social-listening-admin/src/app/tenant/posts/postDisplay.ts
 * - social-listening-admin/src/lib/core-client.ts (updatePostEnrichment, runPostEnrichment force option)
 * - social-listening-admin/src/app/api/posts/[id]/enrichment/route.ts (new)
 * - social-listening-admin/src/app/api/posts/[id]/enrich/route.ts
 * - social-listening-admin/src/app/globals.css
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 6.31 — Human-in-the-Loop Post Enrichment Cascading Edit Drawer', () => {
  // -------------------------------------------------------------------------
  // AC1: Edit Trigger on Enrichment Card (PostDetailPanel.tsx)
  // -------------------------------------------------------------------------
  describe('AC1: Edit Trigger on Enrichment Card', () => {
    it('PostDetailPanel renders an edit button with aria-label="Edit enrichment details" when enrichment is present and onEdit is provided', async () => {
      const { PostDetailPanel } = await import('../../src/app/tenant/posts/PostDetailPanel');
      const samplePost = {
        id: 'post-123',
        createdAt: '2026-08-20T10:00:00Z',
        rawPayload: { title: 'Test Article' },
        bodyMarkdown: 'Test markdown content',
        snippet: 'Test snippet',
        provider: 'gnews',
        enrichmentSummary: {
          sentiment: 'positive',
          sentimentScores: { positive: 0.9, neutral: 0.08, negative: 0.02 },
          entities: ['TechCorp'],
          keyPhrases: ['innovation', 'cloud'],
          modelUsed: 'azure-openai:gpt-5-mini',
          language: 'en',
          summary: 'AI executive summary',
          geoCountry: 'US',
          geoCountryName: 'United States',
          geoRegion: null,
          geoSource: 'source' as const,
          geoConfidence: 'high' as const,
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(PostDetailPanel, { post: samplePost, onEdit: () => {} })
      );

      expect(html).toContain('aria-label="Edit enrichment details"');
      expect(html).toContain('pf-enrich-edit-btn');
    });

    it('PostDetailPanel renders entity type/category badge when namedEntities carries categories', async () => {
      const { PostDetailPanel } = await import('../../src/app/tenant/posts/PostDetailPanel');
      const samplePost = {
        id: 'post-124',
        createdAt: '2026-08-20T10:00:00Z',
        rawPayload: { title: 'Test Article' },
        bodyMarkdown: 'Test markdown content',
        snippet: 'Test snippet',
        provider: 'gnews',
        enrichmentSummary: {
          sentiment: 'neutral',
          sentimentScores: null,
          entities: ['Satya Nadella', 'Microsoft'],
          namedEntities: [
            { text: 'Satya Nadella', category: 'Person' },
            { text: 'Microsoft', category: 'Organization' },
          ],
          keyPhrases: [],
          modelUsed: 'azure-ai-language',
          language: 'en',
          summary: null,
          geoCountry: 'US',
          geoCountryName: 'United States',
          geoRegion: null,
          geoSource: 'source' as const,
          geoConfidence: 'high' as const,
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(PostDetailPanel, { post: samplePost })
      );

      expect(html).toContain('Satya Nadella');
      expect(html).toContain('Person');
      expect(html).toContain('Microsoft');
      expect(html).toContain('Organization');
      expect(html).toContain('pf-chip-entity-category');
    });
  });

  // -------------------------------------------------------------------------
  // AC2: Cascading Multi-Drawer Layout & CSS Classes
  // -------------------------------------------------------------------------
  describe('AC2: Cascading Multi-Drawer Layout & Styling', () => {
    it('globals.css defines .slideover-shifted and .enrichment-edit-drawer classes', () => {
      const css = readSrc('app', 'globals.css');
      expect(css).toContain('.slideover-shifted');
      expect(css).toContain('.enrichment-edit-drawer');
      expect(css).toContain('.pf-override-badge');
      expect(css).toContain('.pf-segmented-control');
      expect(css).toContain('.pf-tag-editor');
    });

    it('PostsFeedClient.tsx manages isEditingEnrichment state and integrates EnrichmentEditDrawer', () => {
      const source = readSrc('app', 'tenant', 'posts', 'PostsFeedClient.tsx');
      expect(source).toContain('EnrichmentEditDrawer');
      expect(source).toContain('slideover-shifted');
    });
  });

  // -------------------------------------------------------------------------
  // AC3: Enrichment Form Controls (EnrichmentEditDrawer.tsx)
  // -------------------------------------------------------------------------
  describe('AC3: Enrichment Form Controls in EnrichmentEditDrawer', () => {
    it('EnrichmentEditDrawer renders sentiment segmented controls, key phrases tag editor, language dropdown, country dropdown, and summary textarea', async () => {
      const { EnrichmentEditDrawer } = await import('../../src/app/tenant/posts/EnrichmentEditDrawer');
      const samplePost = {
        id: 'post-456',
        enrichmentSummary: {
          sentiment: 'neutral',
          sentimentScores: { positive: 0.2, neutral: 0.6, negative: 0.2 },
          entities: [],
          keyPhrases: ['Artificial Intelligence', 'Machine Learning'],
          modelUsed: 'azure-openai',
          language: 'en',
          summary: 'Original summary',
          geoCountry: 'GB',
          geoCountryName: 'United Kingdom',
          geoRegion: null,
          geoSource: 'source' as const,
          geoConfidence: 'high' as const,
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(EnrichmentEditDrawer, {
          isOpen: true,
          onClose: () => {},
          post: samplePost as any,
          onSave: async () => {},
        })
      );

      // Dialog accessibility
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');

      // Sentiment controls
      expect(html).toContain('Positive');
      expect(html).toContain('Neutral');
      expect(html).toContain('Negative');

      // Key phrases
      expect(html).toContain('Artificial Intelligence');
      expect(html).toContain('Machine Learning');

      // Form inputs
      expect(html).toContain('name="detectedLanguage"');
      expect(html).toContain('name="geoCountry"');
      expect(html).toContain('name="summary"');
      expect(html).toContain('Save Changes');
    });
  });

  // -------------------------------------------------------------------------
  // AC4: Core Client and Proxy Endpoints (core-client.ts, routes)
  // -------------------------------------------------------------------------
  describe('AC4: Core Client and BFF Proxy Routes', () => {
    it('core-client.ts exports updatePostEnrichment and extends runPostEnrichment with force option', () => {
      const source = readSrc('lib', 'core-client.ts');
      expect(source).toMatch(/export async function updatePostEnrichment\(/);
      expect(source).toMatch(/force\?: boolean/);
    });

    it('PATCH /api/posts/[id]/enrichment proxy route exists and calls updatePostEnrichment', () => {
      const routeSource = readSrc('app', 'api', 'posts', '[id]', 'enrichment', 'route.ts');
      expect(routeSource).toContain('updatePostEnrichment');
      expect(routeSource).toContain('PATCH');
    });

    it('POST /api/posts/[id]/enrich proxy route parses body and passes force flag', () => {
      const routeSource = readSrc('app', 'api', 'posts', '[id]', 'enrich', 'route.ts');
      expect(routeSource).toContain('runPostEnrichment');
      expect(routeSource).toContain('force');
    });
  });

  // -------------------------------------------------------------------------
  // AC5: Visual "Edited by user" Badge & Lineage
  // -------------------------------------------------------------------------
  describe('AC5: "Edited by user" Badge & Lineage', () => {
    it('postDisplay.ts extracts override metadata into PostEnrichmentSummary', async () => {
      const { extractEnrichmentSummary } = await import('../../src/app/tenant/posts/postDisplay');
      const enrichmentWithOverride = {
        sentiment: 'positive',
        sentimentScore: 0.85,
        keyPhrases: ['crypto'],
        override: {
          isOverridden: true,
          overriddenAt: '2026-08-20T18:00:00Z',
          overriddenByUserId: 'user-789',
          overriddenFields: ['sentiment'],
          originalValues: { sentiment: 'neutral' },
        },
      };

      const summary = extractEnrichmentSummary(enrichmentWithOverride);
      expect(summary).toBeDefined();
      expect(summary?.override?.isOverridden).toBe(true);
      expect(summary?.override?.overriddenByUserId).toBe('user-789');
    });

    it('PostDetailPanel renders the "Edited by user" badge when isOverridden is true', async () => {
      const { PostDetailPanel } = await import('../../src/app/tenant/posts/PostDetailPanel');
      const samplePost = {
        id: 'post-789',
        createdAt: '2026-08-20T10:00:00Z',
        rawPayload: { title: 'Overridden Post' },
        bodyMarkdown: 'Content',
        snippet: 'Snippet',
        provider: 'gnews',
        enrichmentSummary: {
          sentiment: 'positive',
          sentimentScores: { positive: 0.8, neutral: 0.15, negative: 0.05 },
          entities: [],
          keyPhrases: ['edited phrase'],
          modelUsed: 'azure-openai',
          language: 'en',
          summary: 'Human note',
          geoCountry: 'US',
          geoCountryName: 'United States',
          geoRegion: null,
          geoSource: 'source' as const,
          geoConfidence: 'high' as const,
          override: {
            isOverridden: true,
            overriddenAt: '2026-08-20T18:00:00Z',
            overriddenByUserId: 'user-789',
            overriddenFields: ['sentiment', 'summary'],
          },
        },
      };

      const html = renderToStaticMarkup(React.createElement(PostDetailPanel, { post: samplePost }));
      expect(html).toContain('pf-override-badge');
      expect(html).toContain('Edited by user');
    });
  });

  // -------------------------------------------------------------------------
  // AC6: Re-Enrichment Precedence Confirmation Dialog
  // -------------------------------------------------------------------------
  describe('AC6: Re-Enrichment Precedence Confirmation', () => {
    it('RunEnrichmentButton renders a confirmation prompt when post is manually overridden', () => {
      const source = readSrc('app', 'tenant', 'posts', 'RunEnrichmentButton.tsx');
      expect(source).toContain('isOverridden');
      expect(source).toMatch(/force:\s*true/);
    });
  });
});
