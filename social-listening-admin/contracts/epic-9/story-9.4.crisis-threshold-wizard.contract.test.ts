/**
 * Contract: Story 9.4 (ADR-0079, BRD-0079, FDD-0079) — Crisis Threshold Wizard (Frontend).
 * See docs/user-stories/epic-9-adr-0077-to-0085.md#story-94
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 9.4 — Crisis Threshold Wizard Contract', () => {
  describe('AC1: core-client.ts exports crisis template helpers', () => {
    it('exports listCrisisTemplates, getCrisisTemplate, and activateCrisisTemplate', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+listCrisisTemplates\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+getCrisisTemplate\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+activateCrisisTemplate\s*\(/);
    });

    it('calls GET and POST /v1/crisis-templates via authenticatedCoreFetch', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/authenticatedCoreFetch\s*\(\s*['"`]\/v1\/crisis-templates['"`]\s*\)/);
      expect(src).toMatch(/authenticatedCoreFetch\s*\(\s*`\/v1\/crisis-templates\/\$\{encodeURIComponent\(templateKey\)\}\/activate`/);
    });
  });

  describe('AC2: Proxy Route Handlers exist', () => {
    it('exists for GET /api/crisis-templates', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'crisis-templates', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'crisis-templates', 'route.ts');
      expect(src).toMatch(/listCrisisTemplates\s*\(/);
    });

    it('exists for POST /api/crisis-templates/:templateKey/activate', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'crisis-templates', '[templateKey]', 'activate', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'crisis-templates', '[templateKey]', 'activate', 'route.ts');
      expect(src).toMatch(/activateCrisisTemplate\s*\(/);
    });
  });

  describe('AC3: CrisisThresholdWizard component implementation', () => {
    it('exists as a Client Component', () => {
      const wizardPath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'watchlists', 'CrisisThresholdWizard.tsx');
      expect(fs.existsSync(wizardPath)).toBe(true);
      const src = readSrc('app', 'tenant', 'watchlists', 'CrisisThresholdWizard.tsx');
      expect(src).toMatch(/['"`]use client['"`]/);
    });

    it('AC5: renders persistent V1 disclosure notice explaining monitoring vs automated alert delivery', () => {
      const src = readSrc('app', 'tenant', 'watchlists', 'CrisisThresholdWizard.tsx');
      expect(src).toMatch(/data-testid="alert-disclosure-banner"/);
      expect(src).toMatch(/Monitoring Scope Notice/);
      expect(src).toMatch(/Automated alert dispatch/);
    });

    it('AC2/AC3: renders dynamic parameter variable inputs and live query preview', () => {
      const src = readSrc('app', 'tenant', 'watchlists', 'CrisisThresholdWizard.tsx');
      expect(src).toMatch(/currentTemplate\.parameters\.map/);
      expect(src).toMatch(/Interpolated Query Preview/);
    });

    it('AC2/AC3: displays advisory playbook steps and SLAs', () => {
      const src = readSrc('app', 'tenant', 'watchlists', 'CrisisThresholdWizard.tsx');
      expect(src).toMatch(/Advisory Playbook/);
      expect(src).toMatch(/stepItem\.sla_minutes/);
    });

    it('AC6: renders inline error banner for validation or backend errors', () => {
      const src = readSrc('app', 'tenant', 'watchlists', 'CrisisThresholdWizard.tsx');
      expect(src).toMatch(/data-testid="inline-error-banner"/);
      expect(src).toMatch(/errorMessage/);
    });

    it('AC7: supports keyboard accessibility with onKeyDown / tabIndex handlers', () => {
      const src = readSrc('app', 'tenant', 'watchlists', 'CrisisThresholdWizard.tsx');
      expect(src).toMatch(/tabIndex=\{0\}/);
      expect(src).toMatch(/onKeyDown/);
    });
  });

  describe('AC4: WatchlistsClient integration', () => {
    it('imports and mounts CrisisThresholdWizard inside a Slideover', () => {
      const src = readSrc('app', 'tenant', 'watchlists', 'WatchlistsClient.tsx');
      expect(src).toMatch(/import.*CrisisThresholdWizard.*from\s+['"`]\.\/CrisisThresholdWizard['"`]/);
      expect(src).toMatch(/<CrisisThresholdWizard/);
      expect(src).toMatch(/data-testid="open-crisis-wizard-btn"/);
    });
  });
});
