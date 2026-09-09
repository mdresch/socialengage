/**
 * Contract: Story 11.8 (ADR-0098, BRD-0098, FDD-0098) — Publishing and Scheduling UI.
 * See docs/user-stories/epic-11-adr-0095-to-0100.md#story-118--unified-composer-ui-and-scheduling-frontend
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 11.8 — Publishing and Scheduling UI Contract', () => {
  describe('AC1: core-client.ts exports publishing and scheduling API client methods', () => {
    it('exports publishOutboundPost, listOutboundPosts, cancelOutboundActivity, rescheduleOutboundActivity, and getConnectorTargets', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+publishOutboundPost\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+listOutboundPosts\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+cancelOutboundActivity\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+rescheduleOutboundActivity\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+getConnectorTargets\s*\(/);
      expect(src).toContain('PublishOutboundPostInput');
      expect(src).toContain('PublishOutboundPostResult');
      expect(src).toContain('OutboundActivityItem');
      expect(src).toContain('ConnectorTargetItem');
    });
  });

  describe('AC2: BFF API Route Proxies for Outbound Publishing and Scheduling', () => {
    it('exists for /api/outbound/posts (POST & GET)', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'outbound', 'posts', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'outbound', 'posts', 'route.ts');
      expect(src).toMatch(/publishOutboundPost\s*\(/);
      expect(src).toMatch(/listOutboundPosts\s*\(/);
    });

    it('exists for /api/outbound/activities/[id]/cancel (PATCH)', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'outbound', 'activities', '[id]', 'cancel', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'outbound', 'activities', '[id]', 'cancel', 'route.ts');
      expect(src).toMatch(/cancelOutboundActivity\s*\(/);
    });

    it('exists for /api/outbound/activities/[id]/reschedule (PATCH)', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'outbound', 'activities', '[id]', 'reschedule', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'outbound', 'activities', '[id]', 'reschedule', 'route.ts');
      expect(src).toMatch(/rescheduleOutboundActivity\s*\(/);
    });

    it('exists for /api/connectors/[platformId]/targets (GET)', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'connectors', '[platformId]', 'targets', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'connectors', '[platformId]', 'targets', 'route.ts');
      expect(src).toMatch(/getConnectorTargets\s*\(/);
    });
  });

  describe('AC3: OutboundComposerModal provides network selection, targeting, and schedule/publish toggle', () => {
    it('provides multi-network selection, asset targets, and timing controls', () => {
      const modalPath = path.join(ADMIN_ROOT, 'src', 'components', 'composer', 'OutboundComposerModal.tsx');
      expect(fs.existsSync(modalPath)).toBe(true);
      const src = readSrc('components', 'composer', 'OutboundComposerModal.tsx');
      expect(src).toContain('selectedPlatforms');
      expect(src).toContain('selectedAssetTargets');
      expect(src).toContain('dispatchMode');
      expect(src).toContain('scheduledDate');
      expect(src).toContain('scheduledTime');
      expect(src).toContain('/api/outbound/posts');
    });
  });

  describe('AC4: OutboundPostsView renders queue table, status filtering, cancel, and reschedule', () => {
    it('provides status tabs, status badges, cancel button, and reschedule modal', () => {
      const viewPath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'posts', 'outbound', 'OutboundPostsView.tsx');
      expect(fs.existsSync(viewPath)).toBe(true);
      const src = readSrc('app', 'tenant', 'posts', 'outbound', 'OutboundPostsView.tsx');
      expect(src).toContain('STATUS_TABS');
      expect(src).toContain('handleCancelActivity');
      expect(src).toContain('handleSaveReschedule');
      expect(src).toContain('rescheduleDate');
      expect(src).toContain('rescheduleTime');
      expect(src).toContain('OutboundComposerModal');
    });
  });

  describe('AC5: Dedicated Outbound Page Route', () => {
    it('is mounted at /tenant/posts/outbound/page.tsx', () => {
      const pagePath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'posts', 'outbound', 'page.tsx');
      expect(fs.existsSync(pagePath)).toBe(true);
      const src = readSrc('app', 'tenant', 'posts', 'outbound', 'page.tsx');
      expect(src).toContain('OutboundPostsView');
    });
  });
});
