/**
 * Contract: Story 18.1 (ADR-0134, BRD-0134, FDD-0134) — Watchlist volume confidence UI and cost projection (Frontend).
 * See docs/user-stories/epic-18-adr-0134-to-0135.md#story-181
 *
 * Intent: Story 18.1 — Watchlist volume confidence UI and cost projection (ADR-0134, Accepted 2026-08-28)
 * Scope:
 *   social-listening-admin:
 *     src/lib/core-client.ts (export previewWatchlistVolume, WatchlistVolumePreview, ConnectorVolumeItem, VolumeCostProjection),
 *     src/app/api/watchlists/preview-volume/route.ts (proxy route handler),
 *     src/components/watchlists/VolumePreviewPanel.tsx (confidence display & cost projection panel),
 *     src/app/tenant/watchlists/WatchlistForm.tsx (preview volume button and panel integration),
 *     contracts/epic-18/story-18.1.watchlist-volume-confidence-ui.contract.test.ts (this contract),
 *     .claude/skills/watchlist-management/SKILL.md
 * Contract to encode:
 *   AC5: core-client.ts exports typed previewWatchlistVolume and response shapes.
 *        POST /api/watchlists/preview-volume route proxies calls with session headers.
 *   AC6: VolumePreviewPanel visually distinguishes confidence: 'exact' ("12,340")
 *        from 'estimate' ("~45,000 (estimated)") and 'unavailable'.
 *   AC7: VolumePreviewPanel renders the estimatedCost card with monthly storage (GB/month),
 *        AI enrichment calls (calls/month), currency (USD), and confidence badge.
 *   AC8: WatchlistForm mounts "Preview volume" button and displays VolumePreviewPanel before saving.
 * Explicitly out of scope:
 *   - Exporting preview to CSV or PDF (deferred by ADR-0134 §4).
 *   - Modifying saved watchlist AST or platform persistence schemas.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 18.1 — Watchlist Volume Confidence UI and Cost Projection Contract', () => {
  describe('AC5: core-client.ts exports previewWatchlistVolume and proxy route exists', () => {
    it('exports previewWatchlistVolume and volume preview interfaces in core-client.ts', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+interface\s+WatchlistVolumePreview/);
      expect(src).toMatch(/export\s+interface\s+ConnectorVolumeItem/);
      expect(src).toMatch(/export\s+interface\s+VolumeCostProjection/);
      expect(src).toMatch(/export\s+async\s+function\s+previewWatchlistVolume\s*\(/);
      expect(src).toMatch(/authenticatedCoreFetch\s*\(\s*['"`]\/v1\/watchlists\/preview-volume['"`]/);
    });

    it('creates POST /api/watchlists/preview-volume route handler proxying core-client', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'watchlists', 'preview-volume', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'watchlists', 'preview-volume', 'route.ts');
      expect(src).toMatch(/previewWatchlistVolume\s*\(/);
    });
  });

  describe('AC6: VolumePreviewPanel visual confidence distinction (exact vs estimate vs unavailable)', () => {
    it('implements VolumePreviewPanel component displaying confidence-specific formatting', () => {
      const panelPath = path.join(ADMIN_ROOT, 'src', 'components', 'watchlists', 'VolumePreviewPanel.tsx');
      expect(fs.existsSync(panelPath)).toBe(true);
      const src = readSrc('components', 'watchlists', 'VolumePreviewPanel.tsx');
      expect(src).toMatch(/['"`]use client['"`]/);
      // Tests for explicit visual distinction:
      // Exact: clean formatted count (e.g. 12,340)
      // Estimate: prefix ~ and suffix (estimated) per ADR-0134 Decision §3
      expect(src).toMatch(/formatEstimatedPosts/);
      expect(src).toMatch(/`~\$\{.*\}\s*\(estimated\)`/);
      // Unavailable rendering
      expect(src).toMatch(/confidence === ['"]unavailable['"]/);
      // Warning badges
      expect(src).toMatch(/high_volume/);
      expect(src).toMatch(/quota_risk/);
      expect(src).toMatch(/unsupported_query/);
    });
  });

  describe('AC7: VolumePreviewPanel renders estimatedCost projection card', () => {
    it('renders storageGbPerMonth, aiEnrichmentCallsPerMonth, and confidence badge in cost projection card', () => {
      const src = readSrc('components', 'watchlists', 'VolumePreviewPanel.tsx');
      expect(src).toMatch(/id="watchlist-cost-projection"/);
      expect(src).toMatch(/storageGbPerMonth/);
      expect(src).toMatch(/aiEnrichmentCallsPerMonth/);
      expect(src).toMatch(/GB\s*\/\s*month/);
      expect(src).toMatch(/calls\s*\/\s*month/);
      expect(src).toMatch(/estimatedCost\.confidence/);
      expect(src).toMatch(/USD/);
    });
  });

  describe('AC8: WatchlistForm integration', () => {
    it('integrates Preview volume button and mounts VolumePreviewPanel before save', () => {
      const src = readSrc('app', 'tenant', 'watchlists', 'WatchlistForm.tsx');
      expect(src).toMatch(/VolumePreviewPanel/);
      expect(src).toMatch(/data-testid="preview-volume-btn"/);
      expect(src).toMatch(/\/api\/watchlists\/preview-volume/);
      expect(src).toMatch(/handlePreview/);
    });
  });
});
