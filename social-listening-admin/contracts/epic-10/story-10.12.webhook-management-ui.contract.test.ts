/**
 * Contract: Story 10.12 (ADR-0092, BRD-0092, FDD-0092) — Webhook Subscriptions Management UI.
 * See docs/user-stories/epic-10-adr-0086-to-0094.md#story-1012
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 10.12 — Webhook Subscriptions Management UI Contract', () => {
  describe('AC1: core-client.ts exports Webhook API helpers', () => {
    it('exports listWebhookSubscriptions, createWebhookSubscription, deleteWebhookSubscription, testWebhookSubscription', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+listWebhookSubscriptions\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+createWebhookSubscription\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+deleteWebhookSubscription\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+testWebhookSubscription\s*\(/);
    });
  });

  describe('AC2: Proxy Route Handlers exist for webhooks', () => {
    it('exists for /api/webhooks/subscriptions and test route', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', 'app', 'api', 'webhooks', 'subscriptions', 'route.ts'))).toBe(true);
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', 'app', 'api', 'webhooks', 'subscriptions', '[id]', 'route.ts'))).toBe(true);
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', 'app', 'api', 'webhooks', 'subscriptions', '[id]', 'test', 'route.ts'))).toBe(true);
    });
  });

  describe('AC3: UI Component & Page', () => {
    it('provides WebhookSubscriptionsView client component', () => {
      const componentPath = path.join(ADMIN_ROOT, 'src', 'components', 'webhooks', 'WebhookSubscriptionsView.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
      const src = readSrc('components', 'webhooks', 'WebhookSubscriptionsView.tsx');
      expect(src).toMatch(/WebhookSubscriptionsView/);
      expect(src).toMatch(/btn-add-webhook/);
      expect(src).toMatch(/handleTestPing/);
    });

    it('renders server page at tenant/settings/webhooks', () => {
      const pagePath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'settings', 'webhooks', 'page.tsx');
      expect(fs.existsSync(pagePath)).toBe(true);
    });
  });
});
