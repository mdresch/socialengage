/**
 * Contract: Story 11.6 (ADR-0097, BRD-0097, FDD-0097) — Topic Evolution Timeline UI.
 * See docs/user-stories/epic-11-adr-0095-to-0100.md#story-116--topic-evolution-timeline-ui-frontend
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 11.6 — Topic Evolution Timeline UI Contract', () => {
  describe('AC1: core-client.ts exports Topic Evolution API client methods', () => {
    it('exports getTopicEvolution with typed query parameters and return value', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+getTopicEvolution\s*\(/);
      expect(src).toContain('TopicEvolutionPoint');
      expect(src).toContain('TopicEvolutionResponse');
    });
  });

  describe('AC2: BFF Route Proxy exists for topic evolution', () => {
    it('exists for /api/topics/evolution (GET)', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'topics', 'evolution', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'topics', 'evolution', 'route.ts');
      expect(src).toMatch(/getTopicEvolution\s*\(/);
    });
  });

  describe('AC3: TopicEvolutionTimeline renders controls for topic, granularity, and comparison', () => {
    it('provides granularity buttons (day/week/month) and comparison toggle', () => {
      const viewPath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'analytics', 'TopicEvolutionTimeline.tsx');
      expect(fs.existsSync(viewPath)).toBe(true);
      const src = readSrc('app', 'tenant', 'analytics', 'TopicEvolutionTimeline.tsx');
      expect(src).toContain('granularity');
      expect(src).toContain('day');
      expect(src).toContain('week');
      expect(src).toContain('month');
      expect(src).toContain('compareToPrevious');
    });
  });

  describe('AC4: TrendAnnotation component displays trend classifications', () => {
    it('renders rising, falling, and stable trend annotations', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'TopicEvolutionTimeline.tsx');
      expect(src).toContain('TrendAnnotation');
      expect(src).toContain('rising');
      expect(src).toContain('falling');
      expect(src).toContain('stable');
    });
  });

  describe('AC5: Author and Keyword breakdown widgets', () => {
    it('renders keyword clusters and top contributing author cards', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'TopicEvolutionTimeline.tsx');
      expect(src).toContain('topKeywords');
      expect(src).toContain('topAuthors');
      expect(src).toContain('sentiment');
    });
  });

  describe('AC6: Analytics Topics Page Integration', () => {
    it('dedicated route page /tenant/analytics/topics exists and renders TopicEvolutionTimeline', () => {
      const pagePath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'analytics', 'topics', 'page.tsx');
      expect(fs.existsSync(pagePath)).toBe(true);
      const src = readSrc('app', 'tenant', 'analytics', 'topics', 'page.tsx');
      expect(src).toContain('TopicEvolutionTimeline');
    });
  });
});
