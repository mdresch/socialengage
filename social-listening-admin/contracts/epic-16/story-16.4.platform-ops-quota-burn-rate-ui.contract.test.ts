/**
 * Contract: Story 16.4 (ADR-0128, BRD-0128, FDD-0128, TDS-0128) —
 * Platform Ops Quota Burn-Rate Forecasting and Guided Connector Remediation (Frontend UI).
 * See docs/user-stories/epic-16-adr-0125-to-0128.md#story-164--platform-ops-quota-burn-rate-forecasting-frontendbackend
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 16.4 — Platform Operations Quota Burn-Rate Forecasting & Guided Remediation UI Contract', () => {
  describe('AC1 & AC2: core-client exports TenantQuotaBurnProjection and remediateConnector', () => {
    it('defines TenantQuotaBurnProjection and updates PlatformDashboardData in core-client.ts', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+interface\s+TenantQuotaBurnProjection/);
      expect(src).toMatch(/tenantQuotaBurnProjections\??\s*:\s*TenantQuotaBurnProjection\[\]/);
    });

    it('exports remediateConnector targeting /v1/admin/connectors/:id/remediate', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+remediateConnector\s*\(/);
      expect(src).toMatch(/\/v1\/admin\/connectors\/.*\/remediate/);
    });
  });

  describe('AC3: Proxy Route Handler for Connector Remediation', () => {
    it('provides remediation proxy route in src/app/api/admin/connectors/', () => {
      const singleRoute = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'admin', 'connectors', 'remediate', 'route.ts');
      const paramRoute = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'admin', 'connectors', '[id]', 'remediate', 'route.ts');
      const exists = fs.existsSync(singleRoute) || fs.existsSync(paramRoute);
      expect(exists).toBe(true);

      const src = fs.existsSync(singleRoute)
        ? readSrc('app', 'api', 'admin', 'connectors', 'remediate', 'route.ts')
        : readSrc('app', 'api', 'admin', 'connectors', '[id]', 'remediate', 'route.ts');
      expect(src).toMatch(/remediateConnector\s*\(/);
    });
  });

  describe('AC4: QuotaBurnRateForecast Component', () => {
    it('provides QuotaBurnRateForecast component rendering velocity, exhaustion date, and risk badges', () => {
      const componentPath = path.join(ADMIN_ROOT, 'src', 'components', 'operations', 'QuotaBurnRateForecast.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
      const src = readSrc('components', 'operations', 'QuotaBurnRateForecast.tsx');
      expect(src).toMatch(/QuotaBurnRateForecast/);
      expect(src).toMatch(/dailyVelocity7d/);
      expect(src).toMatch(/projectedExhaustionDate/);
      expect(src).toMatch(/warning_30d/);
      expect(src).toMatch(/critical_7d/);
    });
  });

  describe('AC5: ConnectorRemediationDrawer Component & Integration', () => {
    it('provides ConnectorRemediationDrawer component with guided playbooks', () => {
      const componentPath = path.join(ADMIN_ROOT, 'src', 'components', 'operations', 'ConnectorRemediationDrawer.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
      const src = readSrc('components', 'operations', 'ConnectorRemediationDrawer.tsx');
      expect(src).toMatch(/ConnectorRemediationDrawer/);
      expect(src).toMatch(/retry_now/);
      expect(src).toMatch(/override_backoff/);
      expect(src).toMatch(/clear_error_state/);
      expect(src).toMatch(/reprompt_credentials/);
    });

    it('PlatformOperationsDashboard mounts QuotaBurnRateForecast and ConnectorRemediationDrawer', () => {
      const src = readSrc('components', 'operations', 'PlatformOperationsDashboard.tsx');
      expect(src).toMatch(/QuotaBurnRateForecast/);
      expect(src).toMatch(/ConnectorRemediationDrawer/);
    });
  });
});
