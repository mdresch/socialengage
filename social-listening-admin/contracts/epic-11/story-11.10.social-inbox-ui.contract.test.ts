/**
 * Contract: Story 11.10 (ADR-0099, BRD-0099, FDD-0099) — Unified Social Inbox and Reply UI.
 * See docs/user-stories/epic-11-adr-0095-to-0100.md#story-1110--unified-social-inbox-and-reply-ui-frontend
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 11.10 — Unified Social Inbox UI Contract', () => {
  describe('AC1: core-client.ts exports Inbox API client methods', () => {
    it('exports listInboxItems, getInboxItem, updateInboxItem, assignInboxItem, snoozeInboxItem, resolveInboxItem, and replyToInboxItem', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+listInboxItems\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+getInboxItem\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+updateInboxItem\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+assignInboxItem\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+snoozeInboxItem\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+resolveInboxItem\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+replyToInboxItem\s*\(/);
      expect(src).toContain('AdminInboxItem');
      expect(src).toContain('AdminInboxStatus');
      expect(src).toContain('AdminInboxPriority');
    });
  });

  describe('AC2: BFF API Route Proxies for Inbox', () => {
    it('exists for /api/inbox (GET)', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'inbox', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'inbox', 'route.ts');
      expect(src).toMatch(/listInboxItems\s*\(/);
    });

    it('exists for /api/inbox/[id] (GET & PATCH)', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'inbox', '[id]', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'inbox', '[id]', 'route.ts');
      expect(src).toMatch(/getInboxItem\s*\(/);
      expect(src).toMatch(/updateInboxItem\s*\(/);
    });

    it('exists for /api/inbox/[id]/assign (POST)', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'inbox', '[id]', 'assign', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'inbox', '[id]', 'assign', 'route.ts');
      expect(src).toMatch(/assignInboxItem\s*\(/);
    });

    it('exists for /api/inbox/[id]/snooze (POST)', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'inbox', '[id]', 'snooze', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'inbox', '[id]', 'snooze', 'route.ts');
      expect(src).toMatch(/snoozeInboxItem\s*\(/);
    });

    it('exists for /api/inbox/[id]/resolve (POST)', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'inbox', '[id]', 'resolve', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'inbox', '[id]', 'resolve', 'route.ts');
      expect(src).toMatch(/resolveInboxItem\s*\(/);
    });

    it('exists for /api/inbox/[id]/reply (POST)', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'inbox', '[id]', 'reply', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'inbox', '[id]', 'reply', 'route.ts');
      expect(src).toMatch(/replyToInboxItem\s*\(/);
    });
  });

  describe('AC3: InboxView renders priority tabs, search, and queue list', () => {
    it('provides priority filter tabs and search query input', () => {
      const viewPath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'inbox', 'InboxView.tsx');
      expect(fs.existsSync(viewPath)).toBe(true);
      const src = readSrc('app', 'tenant', 'inbox', 'InboxView.tsx');
      expect(src).toContain('PRIORITY_TABS');
      expect(src).toContain('selectedTab');
      expect(src).toContain('searchQuery');
      expect(src).toContain('filteredItems');
      expect(src).toContain('InboxItemDetail');
    });
  });

  describe('AC4: InboxItemDetail renders conversation details, notes, snooze, resolve, and reply composer', () => {
    it('provides snooze picker, resolve button, team notes, and inline reply form', () => {
      const detailPath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'inbox', 'InboxItemDetail.tsx');
      expect(fs.existsSync(detailPath)).toBe(true);
      const src = readSrc('app', 'tenant', 'inbox', 'InboxItemDetail.tsx');
      expect(src).toContain('handleSendReply');
      expect(src).toContain('handleResolve');
      expect(src).toContain('handleSnooze');
      expect(src).toContain('handleSaveNotes');
      expect(src).toContain('replyText');
      expect(src).toContain('/api/inbox');
    });
  });

  describe('AC5: Dedicated Inbox Page Route', () => {
    it('is mounted at /tenant/inbox/page.tsx', () => {
      const pagePath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'inbox', 'page.tsx');
      expect(fs.existsSync(pagePath)).toBe(true);
      const src = readSrc('app', 'tenant', 'inbox', 'page.tsx');
      expect(src).toContain('InboxView');
    });
  });
});
