/**
 * Contract: Story 10.2 (ADR-0086, BRD-0086, FDD-0086) — Prospecting Lists & Social Selling UI.
 * See docs/user-stories/epic-10-adr-0086-to-0094.md#story-102
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 10.2 — Prospecting Lists & Social Selling UI Contract', () => {
  describe('AC1: core-client.ts exports prospecting API client methods', () => {
    it('exports listProspectingLists, createProspectingList, getProspectingList, updateProspectingList, deleteProspectingList', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+listProspectingLists\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+createProspectingList\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+getProspectingList\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+updateProspectingList\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+deleteProspectingList\s*\(/);
    });

    it('exports entry methods: listProspectingEntries, addProspectingEntry, updateProspectingEntry, deleteProspectingEntry', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+listProspectingEntries\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+addProspectingEntry\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+updateProspectingEntry\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+deleteProspectingEntry\s*\(/);
    });
  });

  describe('AC2: Proxy Route Handlers exist for client components', () => {
    it('exists for /api/prospecting-lists', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'prospecting-lists', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'prospecting-lists', 'route.ts');
      expect(src).toMatch(/listProspectingLists\s*\(/);
      expect(src).toMatch(/createProspectingList\s*\(/);
    });

    it('exists for /api/prospecting-lists/[id]', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'prospecting-lists', '[id]', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'prospecting-lists', '[id]', 'route.ts');
      expect(src).toMatch(/getProspectingList\s*\(/);
      expect(src).toMatch(/updateProspectingList\s*\(/);
      expect(src).toMatch(/deleteProspectingList\s*\(/);
    });

    it('exists for /api/prospecting-lists/[id]/entries', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'prospecting-lists', '[id]', 'entries', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'prospecting-lists', '[id]', 'entries', 'route.ts');
      expect(src).toMatch(/listProspectingEntries\s*\(/);
      expect(src).toMatch(/addProspectingEntry\s*\(/);
    });

    it('exists for /api/prospecting-lists/[id]/entries/[entryId]', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'prospecting-lists', '[id]', 'entries', '[entryId]', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'prospecting-lists', '[id]', 'entries', '[entryId]', 'route.ts');
      expect(src).toMatch(/updateProspectingEntry\s*\(/);
      expect(src).toMatch(/deleteProspectingEntry\s*\(/);
    });
  });

  describe('AC3: UI Pages and Components', () => {
    it('provides ProspectingListsView and index page at tenant/prospecting', () => {
      const pagePath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'prospecting', 'page.tsx');
      const viewPath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'prospecting', 'ProspectingListsView.tsx');
      expect(fs.existsSync(pagePath)).toBe(true);
      expect(fs.existsSync(viewPath)).toBe(true);

      const viewSrc = readSrc('app', 'tenant', 'prospecting', 'ProspectingListsView.tsx');
      expect(viewSrc).toMatch(/ProspectingListsView/);
      expect(viewSrc).toMatch(/btn-new-prospecting-list/);
    });

    it('provides ProspectingListDetailView and detail page at tenant/prospecting/[id]', () => {
      const pagePath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'prospecting', '[id]', 'page.tsx');
      const viewPath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'prospecting', 'ProspectingListDetailView.tsx');
      expect(fs.existsSync(pagePath)).toBe(true);
      expect(fs.existsSync(viewPath)).toBe(true);

      const viewSrc = readSrc('app', 'tenant', 'prospecting', 'ProspectingListDetailView.tsx');
      expect(viewSrc).toMatch(/ProspectingListDetailView/);
      expect(viewSrc).toMatch(/STAGE_LABELS/);
    });

    it('includes Prospecting in AppSidebar navigation', () => {
      const sidebarSrc = readSrc('components', 'shell', 'AppSidebar.tsx');
      expect(sidebarSrc).toMatch(/\/tenant\/prospecting/);
    });
  });
});
