/**
 * Contract: Story 6.32 (ADR-0066) — Expose Bing Search API (Azure) connector in Tenant Admin UI:
 * Setup, activation, status telemetry, and watchlist platform sourcing.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-632
 *
 * Intent: Story 2.22 (social-listening-core) shipped the backend bing-search
 * polling connector (authMode: 'api_key', ADR-0066). This story exposes Bing Search
 * on the Connectors portal, Status telemetry page, and Watchlist platform-source list.
 *
 * Scope:
 * - social-listening-admin/src/app/tenant/connectors/page.tsx (PLATFORMS entry)
 * - social-listening-admin/src/app/tenant/connectors/ConnectorsClient.tsx (PlatformDef['icon'] extended, IconBingSearch)
 * - social-listening-admin/src/app/tenant/connectors/status/page.tsx (PLATFORMS entry)
 * - social-listening-admin/src/app/tenant/watchlists/page.tsx (SOCIAL_PLATFORMS entry)
 *
 * AC1: tenant/connectors/page.tsx's PLATFORMS gains 'bing-search' entry:
 *      authMode: 'api_key', apiKey field, personalScopeAllowed: false, tenantScopeAllowed: true.
 * AC2: ConnectorsClient.tsx gains 'bing-search' icon, rendering without throwing.
 * AC3: tenant/connectors/status/page.tsx's PLATFORMS gains 'bing-search' entry in category 'Ingestion'.
 * AC4: tenant/watchlists/page.tsx's SOCIAL_PLATFORMS gains 'bing-search' entry (authMode: 'api_key').
 * AC5: A static markup render of ConnectorsClient with bing-search included succeeds.
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

describe('Story 6.32 — Bing Search API (Azure) connector exposed in Tenant Admin UI', () => {
  describe('AC1: tenant/connectors/page.tsx PLATFORMS gains a bing-search entry', () => {
    it('lists bing-search with authMode: api_key and Tier-2 scope constraints', () => {
      const source = readSrc('app', 'tenant', 'connectors', 'page.tsx');
      const platformsMatch = source.match(/const PLATFORMS: PlatformDef\[\] = \[[\s\S]*?\n\];/);
      expect(platformsMatch).not.toBeNull();
      const block = platformsMatch![0];
      expect(block).toContain(`id: 'bing-search'`);

      const entryMatch = block.match(/\{\s*id:\s*'bing-search'[\s\S]*?\n {2}\},/);
      expect(entryMatch).not.toBeNull();
      const entry = entryMatch![0];
      expect(entry).toMatch(/authMode:\s*'api_key'/);
      expect(entry).toMatch(/key:\s*'apiKey'/);
      expect(entry).toMatch(/personalScopeAllowed:\s*false/);
      expect(entry).toMatch(/tenantScopeAllowed:\s*true/);
    });
  });

  describe('AC2: ConnectorsClient.tsx supports bing-search icon and visual styling', () => {
    it('PlatformDef icon union includes bing-search and switch handles it', () => {
      const source = readSrc('app', 'tenant', 'connectors', 'ConnectorsClient.tsx');
      expect(source).toContain(`'bing-search'`);
      expect(source).toContain(`IconBingSearch`);
    });
  });

  describe('AC3: tenant/connectors/status/page.tsx gains bing-search in Ingestion category', () => {
    it('lists bing-search under Ingestion category', () => {
      const source = readSrc('app', 'tenant', 'connectors', 'status', 'page.tsx');
      const platformsMatch = source.match(/const PLATFORMS: PlatformDefinition\[\] = \[[\s\S]*?\n\];/);
      expect(platformsMatch).not.toBeNull();
      const block = platformsMatch![0];
      expect(block).toContain(`id: 'bing-search'`);

      const entryMatch = block.match(/\{\s*id:\s*'bing-search'[\s\S]*?\n {2}\},/);
      expect(entryMatch).not.toBeNull();
      const entry = entryMatch![0];
      expect(entry).toMatch(/category:\s*'Ingestion'/);
      expect(entry).toMatch(/authMode:\s*'api_key'/);
      expect(entry).toMatch(/personalScopeAllowed:\s*false/);
    });
  });

  describe('AC4: tenant/watchlists/page.tsx SOCIAL_PLATFORMS gains bing-search entry', () => {
    it('lists bing-search with authMode: api_key', () => {
      const source = readSrc('app', 'tenant', 'watchlists', 'page.tsx');
      const listMatch = source.match(/const SOCIAL_PLATFORMS:[\s\S]*?\n\];/);
      expect(listMatch).not.toBeNull();
      const block = listMatch![0];
      expect(block).toContain(`id: 'bing-search'`);

      const entryMatch = block.match(/\{\s*id:\s*'bing-search'[\s\S]*?\}/);
      expect(entryMatch).not.toBeNull();
      const entry = entryMatch![0];
      expect(entry).toMatch(/authMode:\s*'api_key'/);
    });
  });

  describe('AC5: Static markup rendering of ConnectorsClient with bing-search platform', () => {
    it('renders bing-search card with connect/status controls without throwing', () => {
      const clientPath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'connectors', 'ConnectorsClient.tsx');
      const html = renderComponent(clientPath, 'ConnectorsClient', {
        platforms: [
          {
            id: 'bing-search',
            name: 'Bing Search (Azure)',
            subtitle: 'Active Web & News Discovery',
            description: 'Azure AI Services active web & news search discovery for tenant watchlists.',
            authMode: 'api_key',
            color: 'blue',
            icon: 'bing-search',
            adNotice: 'billing',
            credentialFields: [
              {
                key: 'apiKey',
                label: 'Azure Bing Search API Key',
                type: 'password',
                placeholder: '32-character key',
              },
            ],
            personalScopeAllowed: false,
            tenantScopeAllowed: true,
          },
        ],
        initialStates: [
          {
            platformId: 'bing-search',
            connected: true,
            credentialStatus: 'valid',
            isActive: true,
            status: 'healthy',
            maskedHint: null,
          },
        ],
        isTenantAdmin: true,
      });

      expect(html).toContain('Bing Search (Azure)');
      expect(html).toContain('Active Web &amp; News Discovery');
      expect(html).toContain('Active');
    });
  });
});
