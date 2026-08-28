/**
 * Contract: Story 11.4 (ADR-0096, BRD-0096, FDD-0096) — Daily Digest Email Preferences & Preview UI.
 * See docs/user-stories/epic-11-adr-0095-to-0100.md#story-114--daily-digest-email-ui-frontend
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 11.4 — Daily Digest Email Preferences & Preview UI Contract', () => {
  describe('AC1: core-client.ts exports Daily Digest API client methods', () => {
    it('exports getUserDigestPreferences, upsertUserDigestPreferences, and previewDailyDigest', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+getUserDigestPreferences\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+upsertUserDigestPreferences\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+previewDailyDigest\s*\(/);
    });
  });

  describe('AC2: BFF Route Proxies exist for digest operations', () => {
    it('exists for /api/digest/preferences (GET and POST)', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'digest', 'preferences', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'digest', 'preferences', 'route.ts');
      expect(src).toMatch(/getUserDigestPreferences\s*\(/);
      expect(src).toMatch(/upsertUserDigestPreferences\s*\(/);
    });

    it('exists for /api/digest/preview (POST)', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'digest', 'preview', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'digest', 'preview', 'route.ts');
      expect(src).toMatch(/previewDailyDigest\s*\(/);
    });
  });

  describe('AC3: DigestPreferencesView component exists and renders scheduling and content controls', () => {
    it('renders controls for delivery time, timezone, enable toggle, and AI/top-post options', () => {
      const viewPath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'settings', 'digest', 'DigestPreferencesView.tsx');
      expect(fs.existsSync(viewPath)).toBe(true);
      const src = readSrc('app', 'tenant', 'settings', 'digest', 'DigestPreferencesView.tsx');
      expect(src).toContain('sendAtLocal');
      expect(src).toContain('timezone');
      expect(src).toContain('includeAiSummary');
      expect(src).toContain('includeTopPosts');
      expect(src).toContain('includeTopicBreakdown');
    });
  });

  describe('AC4: Live Interactive Preview Modal', () => {
    it('provides a preview trigger and iframe sandbox for rendered HTML', () => {
      const src = readSrc('app', 'tenant', 'settings', 'digest', 'DigestPreferencesView.tsx');
      expect(src).toContain('handleOpenPreview');
      expect(src).toMatch(/iframe/i);
      expect(src).toContain('/api/digest/preview');
    });
  });

  describe('AC5: Tenant Settings Page Integration', () => {
    it('provides navigation link to /tenant/settings/digest from /tenant/settings', () => {
      const settingsSrc = readSrc('app', 'tenant', 'settings', 'page.tsx');
      expect(settingsSrc).toContain('/tenant/settings/digest');
    });

    it('digest settings route page exists', () => {
      const pagePath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'settings', 'digest', 'page.tsx');
      expect(fs.existsSync(pagePath)).toBe(true);
    });
  });
});
