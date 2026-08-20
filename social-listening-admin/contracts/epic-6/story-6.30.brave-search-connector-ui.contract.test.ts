/**
 * Contract: Story 6.30 (ADR-0065) — Expose Brave Search API connector in Tenant Admin UI:
 * Setup, activation, status telemetry, and watchlist platform sourcing.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-630
 *
 * Intent: Story 2.21 (social-listening-core) shipped the backend brave-search
 * polling connector (authMode: 'api_key', ADR-0065). This story exposes Brave Search
 * on the Connectors portal, Status telemetry page, and Watchlist platform-source list.
 *
 * Scope:
 * - social-listening-admin/src/app/tenant/connectors/page.tsx (PLATFORMS entry)
 * - social-listening-admin/src/app/tenant/connectors/ConnectorsClient.tsx (PlatformDef['icon'] extended, IconBraveSearch)
 * - social-listening-admin/src/app/tenant/connectors/status/page.tsx (PLATFORMS entry)
 * - social-listening-admin/src/app/tenant/watchlists/page.tsx (SOCIAL_PLATFORMS entry)
 * - social-listening-admin/.claude/skills/connector-setup/SKILL.md
 * - social-listening-admin/.claude/skills/watchlist-management/SKILL.md
 *
 * AC1: tenant/connectors/page.tsx's PLATFORMS gains 'brave-search' entry:
 *      authMode: 'api_key', subscriptionToken field, personalScopeAllowed: false, tenantScopeAllowed: true.
 * AC2: ConnectorsClient.tsx gains 'brave-search' icon, rendering without throwing.
 * AC3: tenant/connectors/status/page.tsx's PLATFORMS gains 'brave-search' entry in category 'Ingestion'.
 * AC4: tenant/watchlists/page.tsx's SOCIAL_PLATFORMS gains 'brave-search' entry (authMode: 'api_key').
 * AC5: A static markup render of ConnectorsClient and ConnectorStatusClient with brave-search included succeeds.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

function renderComponent(componentPath: string, exportName: string, props: Record<string, unknown>): string {
  const ReactLocal = require('react');
  const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
  const Component = require(componentPath)[exportName];
  return renderLocal(ReactLocal.createElement(Component, props));
}

describe('Story 6.30 — Brave Search API connector exposed in Tenant Admin UI', () => {
  describe('AC1: tenant/connectors/page.tsx PLATFORMS gains a brave-search entry', () => {
    it('lists brave-search with authMode: api_key and Tier-2 scope constraints', () => {
      const source = readSrc('app', 'tenant', 'connectors', 'page.tsx');
      const platformsMatch = source.match(/const PLATFORMS: PlatformDef\[\] = \[[\s\S]*?\n\];/);
      expect(platformsMatch).not.toBeNull();
      const block = platformsMatch![0];
      expect(block).toContain(`id: 'brave-search'`);

      const entryMatch = block.match(/\{\s*id:\s*'brave-search'[\s\S]*?\n {2}\},/);
      expect(entryMatch).not.toBeNull();
      const entry = entryMatch![0];
      expect(entry).toMatch(/authMode:\s*'api_key'/);
      expect(entry).toMatch(/key:\s*'subscriptionToken'/);
      expect(entry).toMatch(/personalScopeAllowed:\s*false/);
      expect(entry).toMatch(/tenantScopeAllowed:\s*true/);
    });
  });

  describe('AC2: ConnectorsClient.tsx supports brave-search icon and visual styling', () => {
    it('PlatformDef icon union includes brave-search and switch handles it', () => {
      const source = readSrc('app', 'tenant', 'connectors', 'ConnectorsClient.tsx');
      expect(source).toContain(`'brave-search'`);
      expect(source).toContain(`IconBraveSearch`);
    });
  });

  describe('AC3: tenant/connectors/status/page.tsx gains brave-search in Ingestion category', () => {
    it('lists brave-search under Ingestion category', () => {
      const source = readSrc('app', 'tenant', 'connectors', 'status', 'page.tsx');
      const platformsMatch = source.match(/const PLATFORMS: PlatformDefinition\[\] = \[[\s\S]*?\n\];/);
      expect(platformsMatch).not.toBeNull();
      const block = platformsMatch![0];
      expect(block).toContain(`id: 'brave-search'`);

      const entryMatch = block.match(/\{\s*id:\s*'brave-search'[\s\S]*?\n {2}\},/);
      expect(entryMatch).not.toBeNull();
      const entry = entryMatch![0];
      expect(entry).toMatch(/category:\s*'Ingestion'/);
      expect(entry).toMatch(/authMode:\s*'api_key'/);
      expect(entry).toMatch(/personalScopeAllowed:\s*false/);
    });
  });

  describe('AC4: tenant/watchlists/page.tsx SOCIAL_PLATFORMS gains brave-search entry', () => {
    it('lists brave-search with authMode: api_key', () => {
      const source = readSrc('app', 'tenant', 'watchlists', 'page.tsx');
      const listMatch = source.match(/const SOCIAL_PLATFORMS:[\s\S]*?\n\];/);
      expect(listMatch).not.toBeNull();
      const block = listMatch![0];
      expect(block).toContain(`id: 'brave-search'`);

      const entryMatch = block.match(/\{\s*id:\s*'brave-search'[\s\S]*?\}/);
      expect(entryMatch).not.toBeNull();
      const entry = entryMatch![0];
      expect(entry).toMatch(/authMode:\s*'api_key'/);
    });
  });

  describe('AC5: Static markup rendering of ConnectorsClient with brave-search platform', () => {
    it('renders brave-search card with connect/status controls without throwing', () => {
      const clientPath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'connectors', 'ConnectorsClient.tsx');
      const html = renderComponent(clientPath, 'ConnectorsClient', {
        platforms: [
          {
            id: 'brave-search',
            name: 'Brave Search',
            subtitle: 'Active Web & News Discovery',
            description: 'Active discovery connector querying the Brave Search index for tenant active watchlists.',
            authMode: 'api_key',
            color: 'amber',
            icon: 'brave-search',
            adNotice: 'billing',
            credentialFields: [
              {
                key: 'subscriptionToken',
                label: 'Brave Search API Subscription Token',
                type: 'password',
                placeholder: 'BSA...',
              },
            ],
            personalScopeAllowed: false,
            tenantScopeAllowed: true,
          },
        ],
        initialStates: [
          {
            platformId: 'brave-search',
            connected: true,
            credentialStatus: 'valid',
            isActive: true,
            status: 'healthy',
            maskedHint: null,
          },
        ],
        isTenantAdmin: true,
      });

      expect(html).toContain('Brave Search');
      expect(html).toContain('Active Web &amp; News Discovery');
      expect(html).toContain('Active');
    });
  });
});
