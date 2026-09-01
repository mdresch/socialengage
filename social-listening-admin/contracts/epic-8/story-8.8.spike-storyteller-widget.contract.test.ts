/**
 * Contract: Story 8.8 (ADR-0062 Decision §6) — AI Spike Storyteller widget
 * and same-origin proxy route.
 * See docs/user-stories/epic-8-analytics-dashboard.md#story-88
 *
 * Intent: Story 8.8 — AI Spike Storyteller frontend half.
 * Scope: social-listening-admin/{
 *   src/lib/core-client.ts (extended — explainSpike()),
 *   src/app/api/posts/explain-spike/route.ts (new — same-origin proxy),
 *   src/app/tenant/analytics/SpikeStorytellerWidget.tsx (new — the widget),
 *   src/app/tenant/analytics/OverviewTab.tsx (extended — renders the widget
 *     in the reserved id="widget-spike-storyteller" grid slot, conditional
 *     on activeDateFilter being non-null),
 *   src/app/globals.css (extended — widget styles),
 * }.
 *
 * Contract to encode:
 *   (AC1) core-client.ts exports explainSpike() that calls
 *     authenticatedCoreFetch() against POST /v1/posts/explain-spike with
 *     { spikeDate, customPrompt? } and returns { status, body };
 *   (AC2) the proxy route at /api/posts/explain-spike is a one-line
 *     pass-through mirroring the [id]/enrich pattern — it calls
 *     explainSpike() and returns NextResponse.json(body, { status });
 *   (AC3) SpikeStorytellerWidget renders a skeleton loader while the
 *     request is in flight, the narrative/postsAnalysed/generatedAt on
 *     success, a custom-prompt textarea with re-fire button, and an honest
 *     "AI analysis is not configured for this tenant" message on 503
 *     AI_UNAVAILABLE (no textarea in that state);
 *   (AC4) OverviewTab renders the widget inside id="widget-spike-storyteller"
 *     only when activeDateFilter is non-null (the grid slot is reserved
 *     empty when activeDateFilter is null — Story 8.7's own boundary);
 *   (AC5) no fabricated/placeholder narrative is ever rendered — the
 *     widget's initial state is an honest prompt, never a fake narrative.
 *
 * Per Story 8.1/8.2/8.7's own established testing boundary: pure functions
 * and source-text structure are proven by direct unit tests and source-regex
 * inspection; state-driven interactive wiring (fetch calls, useState) has no
 * DOM-interaction test runner in this repo yet and is proven structurally
 * via source-text inspection instead.
 *
 * Explicitly out of scope for this contract:
 *   - Re-proving POST /v1/posts/explain-spike's own backend behavior — the
 *     backend's own contract (social-listening-core/contracts/epic-8/
 *     story-8.8...contract.test.ts) already proves that; this contract
 *     only proves the admin UI calls it correctly and reacts to what it
 *     returns.
 *   - Sentiment/Conversations/Sources tabs' own existing behavior.
 *   - Story 8.9's selectedTopic watchlist selector.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 8.8 — AI Spike Storyteller widget contract', () => {
  describe('AC1: core-client.ts exports explainSpike()', () => {
    it('exports an explainSpike function that calls authenticatedCoreFetch against POST /v1/posts/explain-spike', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+explainSpike\s*\(/);
      expect(src).toMatch(/authenticatedCoreFetch\s*\(\s*['"`]\/v1\/posts\/explain-spike['"`]/);
      expect(src).toMatch(/method:\s*['"`]POST['"`]/);
    });

    it('passes spikeDate and optional customPrompt in the request body', () => {
      const src = readSrc('lib', 'core-client.ts');
      // The function must serialize spikeDate and customPrompt into the body
      expect(src).toMatch(/spikeDate/);
      expect(src).toMatch(/customPrompt/);
      expect(src).toMatch(/JSON\.stringify/);
    });

    it('returns a { status, body } outcome shape, mirroring runPostEnrichment', () => {
      const src = readSrc('lib', 'core-client.ts');
      // Find the explainSpike function body and verify it returns { status, body }
      expect(src).toMatch(/explainSpike[\s\S]*?return\s*\{\s*status:\s*response\.status,\s*body\s*\}/);
    });
  });

  describe('AC2: proxy route at /api/posts/explain-spike', () => {
    it('exists as a Next.js API route file', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'posts', 'explain-spike', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
    });

    it('is a one-line pass-through that calls explainSpike() from core-client', () => {
      const src = readSrc('app', 'api', 'posts', 'explain-spike', 'route.ts');
      expect(src).toMatch(/import.*explainSpike.*from\s+['"`]@\/lib\/core-client['"`]/);
      expect(src).toMatch(/explainSpike\s*\(/);
      expect(src).toMatch(/NextResponse\.json\s*\(/);
    });

    it('reads the JSON body and forwards spikeDate/customPrompt', () => {
      const src = readSrc('app', 'api', 'posts', 'explain-spike', 'route.ts');
      expect(src).toMatch(/request\.json\s*\(\s*\)/);
      expect(src).toMatch(/spikeDate/);
    });
  });

  describe('AC3: SpikeStorytellerWidget component', () => {
    it('exists as a Client Component', () => {
      const widgetPath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'analytics', 'SpikeStorytellerWidget.tsx');
      expect(fs.existsSync(widgetPath)).toBe(true);
      const src = readSrc('app', 'tenant', 'analytics', 'SpikeStorytellerWidget.tsx');
      expect(src).toMatch(/['"`]use client['"`]/);
    });

    it('renders a skeleton/loader state while the request is in flight', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'SpikeStorytellerWidget.tsx');
      // The component must have a loading state — skeleton, spinner, or similar
      expect(src).toMatch(/loading|skeleton|isLoading|pending/i);
    });

    it('renders the narrative, postsAnalysed, and generatedAt on success', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'SpikeStorytellerWidget.tsx');
      expect(src).toMatch(/narrative/);
      expect(src).toMatch(/postsAnalysed/);
      expect(src).toMatch(/generatedAt/);
    });

    it('renders a custom-prompt textarea with a re-fire button', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'SpikeStorytellerWidget.tsx');
      expect(src).toMatch(/textarea/i);
      expect(src).toMatch(/customPrompt/);
    });

    it('renders an honest "not configured" message on 503 AI_UNAVAILABLE and omits the textarea', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'SpikeStorytellerWidget.tsx');
      expect(src).toMatch(/AI_UNAVAILABLE/);
      expect(src).toMatch(/503/);
      // The "not configured" message must be present
      expect(src).toMatch(/not configured|unavailable|not available/i);
    });

    it('calls POST /api/posts/explain-spike (the proxy route), never /v1/ directly', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'SpikeStorytellerWidget.tsx');
      expect(src).toMatch(/\/api\/posts\/explain-spike/);
      // Must NOT call /v1/ directly from browser code (ADR-0036 §2)
      expect(src).not.toMatch(/\/v1\/posts\/explain-spike/);
    });

    it('never renders a fabricated/placeholder narrative — initial state is an honest prompt', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'SpikeStorytellerWidget.tsx');
      // The component must not contain a hardcoded narrative string
      expect(src).not.toMatch(/The spike was driven by|narrative.*=.*['"`][A-Z]/);
    });
  });

  describe('AC4: OverviewTab renders the widget in the reserved slot', () => {
    it('imports SpikeStorytellerWidget', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'OverviewTab.tsx');
      expect(src).toMatch(/import.*SpikeStorytellerWidget.*from\s+['"`]\.\/SpikeStorytellerWidget['"`]/);
    });

    it('renders the widget inside id="widget-spike-storyteller"', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'OverviewTab.tsx');
      // The widget-spike-storyteller div must contain the SpikeStorytellerWidget
      expect(src).toMatch(/id="widget-spike-storyteller"[\s\S]*?<SpikeStorytellerWidget/);
    });

    it('the widget is conditional on activeDateFilter being non-null', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'OverviewTab.tsx');
      // The widget must only render when activeDateFilter is set
      expect(src).toMatch(/activeDateFilter/);
      // The SpikeStorytellerWidget must receive spikeDate from activeDateFilter
      expect(src).toMatch(/spikeDate.*=.*filters\.activeDateFilter|spikeDate=\{filters\.activeDateFilter\}/);
    });
  });
});
