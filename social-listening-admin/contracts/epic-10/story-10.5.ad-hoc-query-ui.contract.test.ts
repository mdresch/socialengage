/**
 * Contract: Story 10.5 (ADR-0088, BRD-0088, FDD-0088) — Ad-Hoc Analytics Query Builder UI.
 * See docs/user-stories/epic-10-adr-0086-to-0094.md#story-105
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 10.5 — Ad-Hoc Analytics Query Builder UI Contract', () => {
  describe('AC1: core-client.ts exports executeAdHocAnalyticsQuery', () => {
    it('exports executeAdHocAnalyticsQuery and types', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+executeAdHocAnalyticsQuery\s*\(/);
      expect(src).toMatch(/authenticatedCoreFetch\s*\(\s*['"`]\/v1\/analytics\/query['"`]/);
    });
  });

  describe('AC2: Proxy Route Handler exists for client component', () => {
    it('exists at /api/analytics/query', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'analytics', 'query', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'analytics', 'query', 'route.ts');
      expect(src).toMatch(/executeAdHocAnalyticsQuery\s*\(/);
    });
  });

  describe('AC3: UI Component & Page', () => {
    it('provides AdHocQueryBuilder client component', () => {
      const componentPath = path.join(ADMIN_ROOT, 'src', 'components', 'analytics', 'AdHocQueryBuilder.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
      const src = readSrc('components', 'analytics', 'AdHocQueryBuilder.tsx');
      expect(src).toMatch(/AdHocQueryBuilder/);
      expect(src).toMatch(/btn-run-adhoc-query/);
      expect(src).toMatch(/ALL_DIMENSIONS/);
      expect(src).toMatch(/ALL_METRICS/);
      expect(src).toMatch(/handleDownloadCsv/);
    });

    it('renders server page at tenant/analytics/query', () => {
      const pagePath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'analytics', 'query', 'page.tsx');
      expect(fs.existsSync(pagePath)).toBe(true);
      const src = readSrc('app', 'tenant', 'analytics', 'query', 'page.tsx');
      expect(src).toMatch(/AdHocQueryBuilder/);
    });
  });
});
