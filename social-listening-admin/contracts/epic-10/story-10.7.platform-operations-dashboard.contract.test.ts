/**
 * Contract: Story 10.7 (ADR-0089, BRD-0089, FDD-0089) — Platform Operations Telemetry UI.
 * See docs/user-stories/epic-10-adr-0086-to-0094.md#story-107
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 10.7 — Platform Operations Dashboard UI Contract', () => {
  describe('AC1: core-client.ts exports getPlatformDashboard', () => {
    it('exports getPlatformDashboard and PlatformDashboardData type', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+getPlatformDashboard\s*\(/);
      expect(src).toMatch(/authenticatedCoreFetch\s*\(\s*['"`]\/v1\/admin\/platform-dashboard['"`]/);
    });
  });

  describe('AC2: Proxy Route Handler exists for platform dashboard', () => {
    it('exists at /api/admin/platform-dashboard', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'admin', 'platform-dashboard', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'admin', 'platform-dashboard', 'route.ts');
      expect(src).toMatch(/getPlatformDashboard\s*\(/);
    });
  });

  describe('AC3: UI Component & Page', () => {
    it('provides PlatformOperationsDashboard client component with metric tiles and connector table', () => {
      const componentPath = path.join(ADMIN_ROOT, 'src', 'components', 'operations', 'PlatformOperationsDashboard.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
      const src = readSrc('components', 'operations', 'PlatformOperationsDashboard.tsx');
      expect(src).toMatch(/PlatformOperationsDashboard/);
      expect(src).toMatch(/btn-refresh-telemetry/);
      expect(src).toMatch(/throughputPostsSec/);
      expect(src).toMatch(/avgIngestionLagSec/);
      expect(src).toMatch(/estimatedCostLast30dUsd/);
    });

    it('renders server page at admin/operations', () => {
      const pagePath = path.join(ADMIN_ROOT, 'src', 'app', 'admin', 'operations', 'page.tsx');
      expect(fs.existsSync(pagePath)).toBe(true);
      const src = readSrc('app', 'admin', 'operations', 'page.tsx');
      expect(src).toMatch(/PlatformOperationsDashboard/);
    });
  });
});
