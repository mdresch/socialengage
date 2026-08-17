/**
 * Contract: Story 6.21 — Expose the Wikipedia connector in the Tenant Admin UI.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-621
 *
 * Intent: Story 2.13 (social-listening-core) shipped a real, fully generic
 * Wikipedia connector (authMode: 'none') — the backend's own connect/
 * activate/deactivate REST surface (ADR-0051) needs zero change to support
 * it. But tenant/connectors/page.tsx's and tenant/connectors/status/page.tsx's
 * own hand-curated PLATFORMS arrays (Stories 6.3/6.5/6.15) never got a
 * 'wikipedia' entry, so the connector is invisible in the product. This
 * story adds that one entry to each array, plus a new, visually distinct
 * icon/color pair on ConnectorsClient.tsx (reusing GNews's own globe/blue
 * would make the two connectors indistinguishable on the same screen) —
 * no change to core-client.ts, the proxy routes, ActivateDeactivateButton,
 * or any backend file.
 *
 * Scope: social-listening-admin/{src/app/tenant/connectors/page.tsx
 * (PLATFORMS entry), src/app/tenant/connectors/ConnectorsClient.tsx
 * (PlatformDef['icon']/['color'] extended, new IconBookOpen(), new switch
 * case), src/app/tenant/connectors/status/page.tsx (PLATFORMS entry),
 * src/app/globals.css (new .cv-platform-icon-amber/.cv-card-subtitle-amber
 * rules)}.
 *
 * Testing approach: matches Story 6.3's/6.15's own established convention —
 * structural source-pattern checks for the PLATFORMS entries and CSS rules,
 * plus a real renderToStaticMarkup() render of ConnectorsClient proving the
 * new icon renders without throwing and the platform's name/subtitle appear.
 * No click-interaction simulation (this codebase has never done that for
 * this component — see Story 6.15's own contract for why).
 *
 * AC1: tenant/connectors/page.tsx's PLATFORMS gains a 'wikipedia' entry,
 *      authMode: 'none', credentialFields: [], personalScopeAllowed: false —
 *      the same shape as the existing 'newswire' entry.
 * AC2: ConnectorsClient.tsx's PlatformDef['icon']/['color'] each gain one
 *      new value, distinct from all four existing platforms' own icon/color
 *      pairs (so Wikipedia is never visually identical to GNews or any
 *      other connector on the same screen); the new color has matching
 *      .cv-platform-icon-<color>/.cv-card-subtitle-<color> CSS rules.
 * AC3: tenant/connectors/status/page.tsx's own separately-duplicated
 *      PLATFORMS gains a 'wikipedia' entry, category: 'Ingestion'.
 * AC4: a real render of ConnectorsClient with the wikipedia platform
 *      included renders its name/subtitle and the new icon without
 *      throwing — no crash from an unhandled icon/color value.
 * AC5: no change to core-client.ts, ActivateDeactivateButton.tsx, or any
 *      social-listening-core file (Story 2.13's backend work already
 *      covers this connector generically).
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const CORE_ROOT = path.resolve(__dirname, '..', '..', '..', 'social-listening-core');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

function renderComponent(componentPath: string, exportName: string, props: Record<string, unknown>): string {
  const ReactLocal = require('react');
  const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
  const Component = require(componentPath)[exportName];
  return renderLocal(ReactLocal.createElement(Component, props));
}

describe('Story 6.21 — Wikipedia connector exposed in the Tenant Admin UI', () => {
  describe('AC1: tenant/connectors/page.tsx PLATFORMS gains a wikipedia entry', () => {
    it('lists wikipedia, shaped like the existing authMode-none newswire entry', () => {
      const source = readSrc('app', 'tenant', 'connectors', 'page.tsx');
      const platformsMatch = source.match(/const PLATFORMS: PlatformDef\[\] = \[[\s\S]*?\n\];/);
      expect(platformsMatch).not.toBeNull();
      const block = platformsMatch![0];
      expect(block).toContain(`id: 'wikipedia'`);

      const wikipediaEntryMatch = block.match(/\{\s*id:\s*'wikipedia'[\s\S]*?\n {2}\},/);
      expect(wikipediaEntryMatch).not.toBeNull();
      const entry = wikipediaEntryMatch![0];
      expect(entry).toMatch(/authMode:\s*'none'/);
      expect(entry).toMatch(/credentialFields:\s*\[\]/);
      expect(entry).toMatch(/personalScopeAllowed:\s*false/);
    });
  });

  describe('AC2: ConnectorsClient.tsx gains a new, distinct icon/color pair', () => {
    it('PlatformDef icon/color unions each gain exactly one new value beyond the existing four', () => {
      const source = readSrc('app', 'tenant', 'connectors', 'ConnectorsClient.tsx');
      const colorMatch = source.match(/color:\s*'blue'\s*\|\s*'indigo'\s*\|\s*'purple'\s*\|\s*'emerald'\s*\|\s*'(\w+)';/);
      expect(colorMatch).not.toBeNull();
      const newColor = colorMatch![1];
      expect(['blue', 'indigo', 'purple', 'emerald']).not.toContain(newColor);

      const iconMatch = source.match(/icon:\s*'globe'\s*\|\s*'radio'\s*\|\s*'sparkles-purple'\s*\|\s*'sparkles-emerald'\s*\|\s*'([\w-]+)';/);
      expect(iconMatch).not.toBeNull();
      const newIcon = iconMatch![1];
      expect(['globe', 'radio', 'sparkles-purple', 'sparkles-emerald']).not.toContain(newIcon);

      // The switch in PlatformIcon() must actually handle the new value —
      // TypeScript's own exhaustiveness check on the switch already
      // enforces this at compile time, but confirmed structurally too.
      expect(source).toContain(`case '${newIcon}':`);
    });

    it('globals.css defines matching icon-background and subtitle-color rules for the new color', () => {
      const cssSource = fs.readFileSync(path.join(ADMIN_ROOT, 'src', 'app', 'globals.css'), 'utf8');
      const clientSource = readSrc('app', 'tenant', 'connectors', 'ConnectorsClient.tsx');
      const colorMatch = clientSource.match(/color:\s*'blue'\s*\|\s*'indigo'\s*\|\s*'purple'\s*\|\s*'emerald'\s*\|\s*'(\w+)';/);
      const newColor = colorMatch![1];

      expect(cssSource).toMatch(new RegExp(`\\.cv-platform-icon-${newColor}\\s*\\{`));
      expect(cssSource).toMatch(new RegExp(`\\.cv-card-subtitle-${newColor}\\s*\\{`));
    });
  });

  describe('AC3: tenant/connectors/status/page.tsx PLATFORMS gains a wikipedia entry', () => {
    it('lists wikipedia with category Ingestion', () => {
      const source = readSrc('app', 'tenant', 'connectors', 'status', 'page.tsx');
      const platformsMatch = source.match(/const PLATFORMS: PlatformDefinition\[\] = \[[\s\S]*?\n\];/);
      expect(platformsMatch).not.toBeNull();
      const block = platformsMatch![0];
      expect(block).toContain(`id: 'wikipedia'`);

      const wikipediaEntryMatch = block.match(/\{\s*id:\s*'wikipedia'[\s\S]*?\n {2}\},/);
      expect(wikipediaEntryMatch).not.toBeNull();
      const entry = wikipediaEntryMatch![0];
      expect(entry).toMatch(/authMode:\s*'none'/);
      expect(entry).toMatch(/category:\s*'Ingestion'/);
      expect(entry).toMatch(/personalScopeAllowed:\s*false/);
    });
  });

  describe('AC4: a real render of ConnectorsClient with the wikipedia platform renders cleanly', () => {
    afterEach(() => {
      jest.resetModules();
    });

    it('renders the platform name/subtitle and the new icon without throwing', () => {
      const clientPathAbs = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'connectors', 'ConnectorsClient.tsx');
      const html = renderComponent(clientPathAbs, 'ConnectorsClient', {
        platforms: [
          {
            id: 'wikipedia',
            name: 'Wikipedia',
            subtitle: 'Public Ingestion Source',
            description: 'Tracks edits to a Wikipedia article via the MediaWiki Action API (zero credential required).',
            authMode: 'none',
            color: 'amber',
            icon: 'book-open',
            adNotice: 'public',
            credentialFields: [],
            personalScopeAllowed: false,
          },
        ],
        initialStates: [{ platformId: 'wikipedia', connected: true, credentialStatus: null, isActive: false, maskedHint: null }],
        isTenantAdmin: true,
      });

      expect(html).toContain('Wikipedia');
      expect(html).toContain('Public Ingestion Source');
    });
  });

  describe('AC5: no backend change — Story 2.13 already covers this connector generically', () => {
    it('social-listening-core has no wikipedia-specific new file beyond Story 2.13\'s own already-committed connector', () => {
      expect(fs.existsSync(path.join(CORE_ROOT, 'src', 'connectors', 'wikipedia', 'wikipediaConnector.ts'))).toBe(true);
      // No new REST route file for this connector specifically — the
      // existing generic connectorsRouter.ts already handles any platformId.
      expect(fs.existsSync(path.join(CORE_ROOT, 'src', 'http', 'versions', 'v1', 'wikipediaRouter.ts'))).toBe(false);
    });
  });
});
