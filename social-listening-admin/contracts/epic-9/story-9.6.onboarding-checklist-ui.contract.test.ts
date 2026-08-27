/**
 * Contract: Story 9.6 (ADR-0080, BRD-0080, FDD-0080) — Onboarding Checklist UI.
 * See docs/user-stories/epic-9-adr-0077-to-0085.md#story-96
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 9.6 — Onboarding Checklist UI Contract', () => {
  describe('AC1: core-client.ts exports onboarding checklist helpers', () => {
    it('exports getOnboardingChecklist and patchOnboardingChecklist', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+getOnboardingChecklist\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+patchOnboardingChecklist\s*\(/);
    });

    it('calls GET and PATCH /v1/tenants/:id/onboarding-checklist via authenticatedCoreFetch', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/authenticatedCoreFetch\s*\(\s*`\/v1\/tenants\/\$\{encodeURIComponent\(tenantId\)\}\/onboarding-checklist`/);
    });
  });

  describe('AC2: Proxy Route Handlers exist for tenant onboarding checklist', () => {
    it('exists for GET and PATCH /api/tenants/[id]/onboarding-checklist', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'tenants', '[id]', 'onboarding-checklist', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'tenants', '[id]', 'onboarding-checklist', 'route.ts');
      expect(src).toMatch(/getOnboardingChecklist\s*\(/);
      expect(src).toMatch(/patchOnboardingChecklist\s*\(/);
    });
  });

  describe('AC3: OnboardingChecklist component implementation', () => {
    it('exists as a Client Component', () => {
      const componentPath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'OnboardingChecklist.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
      const src = readSrc('app', 'tenant', 'OnboardingChecklist.tsx');
      expect(src).toMatch(/['"`]use client['"`]/);
    });

    it('renders all 4 core steps with deep links and completion icons', () => {
      const src = readSrc('app', 'tenant', 'OnboardingChecklist.tsx');
      expect(src).toMatch(/connect_source/);
      expect(src).toMatch(/\/tenant\/connectors/);
      expect(src).toMatch(/build_watchlist/);
      expect(src).toMatch(/\/tenant\/watchlists/);
      expect(src).toMatch(/invite_user/);
      expect(src).toMatch(/\/tenant\/users/);
      expect(src).toMatch(/verify_posts/);
      expect(src).toMatch(/\/tenant\/posts/);
    });

    it('provides dismissal and reopen capabilities', () => {
      const src = readSrc('app', 'tenant', 'OnboardingChecklist.tsx');
      expect(src).toMatch(/data-testid="dismiss-checklist-btn"/);
      expect(src).toMatch(/data-testid="reopen-checklist-btn"/);
      expect(src).toMatch(/dismissed:\s*true/);
    });

    it('supports advanced steps toggling (enable_enrichment, configure_alerts)', () => {
      const src = readSrc('app', 'tenant', 'OnboardingChecklist.tsx');
      expect(src).toMatch(/enable_enrichment/);
      expect(src).toMatch(/configure_alerts/);
      expect(src).toMatch(/showAdvanced/);
    });
  });

  describe('AC4: Tenant overview page integration', () => {
    it('imports and mounts OnboardingChecklist inside TenantShellPage', () => {
      const src = readSrc('app', 'tenant', 'page.tsx');
      expect(src).toMatch(/import.*OnboardingChecklist.*from\s+['"`]\.\/OnboardingChecklist['"`]/);
      expect(src).toMatch(/<OnboardingChecklist/);
      expect(src).toMatch(/getOnboardingChecklist/);
    });
  });
});
