/**
 * Contract: Story 10.10 (ADR-0091, BRD-0091, FDD-0091) — Real-Time Alerts & Rules Management UI.
 * See docs/user-stories/epic-10-adr-0086-to-0094.md#story-1010
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 10.10 — Real-Time Alerts UI Contract', () => {
  describe('AC1: core-client.ts exports Alert Rules & Inbox API helpers', () => {
    it('exports listAlertRules, createAlertRule, updateAlertRule, deleteAlertRule, listTenantAlerts, updateTenantAlertStatus', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+listAlertRules\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+createAlertRule\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+updateAlertRule\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+deleteAlertRule\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+listTenantAlerts\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+updateTenantAlertStatus\s*\(/);
    });
  });

  describe('AC2: Proxy Route Handlers exist for client components', () => {
    it('exists for /api/alerts/rules and /api/alerts/rules/[id]', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', 'app', 'api', 'alerts', 'rules', 'route.ts'))).toBe(true);
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', 'app', 'api', 'alerts', 'rules', '[id]', 'route.ts'))).toBe(true);
    });

    it('exists for /api/alerts/inbox and /api/alerts/inbox/[id]', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', 'app', 'api', 'alerts', 'inbox', 'route.ts'))).toBe(true);
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', 'app', 'api', 'alerts', 'inbox', '[id]', 'route.ts'))).toBe(true);
    });
  });

  describe('AC3: UI Components & Page', () => {
    it('provides AlertsInboxView and AlertRulesView components', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', 'components', 'alerts', 'AlertsInboxView.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', 'components', 'alerts', 'AlertRulesView.tsx'))).toBe(true);
    });

    it('renders server page at tenant/alerts and includes in sidebar', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'alerts', 'page.tsx'))).toBe(true);
      const sidebarSrc = readSrc('components', 'shell', 'AppSidebar.tsx');
      expect(sidebarSrc).toMatch(/\/tenant\/alerts/);
    });
  });
});
