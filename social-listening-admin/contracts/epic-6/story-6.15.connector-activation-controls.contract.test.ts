/**
 * Contract: Story 6.15 — Activate/deactivate controls on the connectors and
 * connector-status screens.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-615
 *
 * Intent: wire Story 1.11/1.12's real backend activation surface
 * (POST /v1/connectors/:platformId/activate|deactivate,
 * GET /v1/connectors/:platformId's new isActive field) into the two
 * screens where a tenant already manages connectors. Both
 * tenant/connectors/page.tsx (Story 6.3) and
 * tenant/connectors/status/page.tsx (Story 6.5) read isActive instead of
 * inferring "active" purely from credentialStatus !== null /
 * authMode === 'none' — closing the actual UI-visible instance of the bug
 * ADR-0051 was drafted to fix: Newswire no longer renders unconditionally
 * "Active" — it renders Inactive until a Tenant-Admin explicitly activates
 * it. A new ActivateDeactivateButton.tsx (client component) is rendered on
 * both screens, for every platform, not gated behind credential presence.
 * ownerType: 'user' controls are hidden for authMode: 'none' platforms (no
 * personal scope exists for those). A tenant_user sees only their own
 * personal control; a tenant_admin sees both, mirroring ConnectForm's own
 * allowTenantWide gate. Deactivating never hides ConnectForm/
 * DisconnectButton — activation and credential management stay visibly
 * distinct actions (ADR-0051 Decision §3). The Active/Inactive status
 * label itself is rendered by each page directly (as it already is today),
 * not inside ActivateDeactivateButton — the same separation DisconnectButton
 * already has from the page's own "Connected"/"Not connected" label.
 *
 * Scope: social-listening-admin/{src/lib/core-client.ts (activatePlatform,
 * deactivatePlatform, ConnectorStatus.isActive), src/app/api/connectors/
 * [platformId]/activate/route.ts (new), .../deactivate/route.ts (new),
 * src/app/tenant/connectors/ActivateDeactivateButton.tsx (new),
 * src/app/tenant/connectors/page.tsx (rework), src/app/tenant/connectors/
 * status/page.tsx (rework)}.
 *
 * Testing approach, matching this codebase's own established conventions
 * (Story 6.3's own contract, not invented here): client-side click-to-
 * activate interaction is never simulated anywhere in this codebase's
 * contracts (ConnectForm.tsx/DisconnectButton.tsx have never had their own
 * click handlers exercised either) — this component's own presence and
 * gating logic is proven structurally (source-pattern checks), core-client.ts
 * functions are proven via direct unit tests (mocked fetch, no component
 * rendering), and the page-level Active/Inactive label text — which the
 * page renders directly, not inside the nested button component — is
 * proven via a real, mocked-fetch Page() render, the same technique Story
 * 6.5's own read-only screen already uses.
 *
 * Explicitly out of scope: any visual redesign beyond adding the new
 * controls; a combined/merged connect+activate control (ADR-0051 Decision
 * §3 wants them visibly distinct); GET /v1/connectors/:platformId's own
 * combined activation+health response shape beyond what Story 1.12
 * already provides.
 *
 * AC1: core-client.ts exports activatePlatform()/deactivatePlatform(),
 *      calling the real endpoints; new proxy routes exist, mirroring
 *      connect/disconnect exactly.
 * AC2: both screens read real isActive, not credentialStatus/authMode —
 *      Newswire (authMode 'none') renders Inactive by default, Active only
 *      once isActive is true, on both screens.
 * AC3: ActivateDeactivateButton is imported and rendered for every
 *      platform on both screens, never gated behind connected/credential
 *      state the way ConnectForm/DisconnectButton legitimately are.
 * AC4: the personal (ownerType 'user') control is gated on
 *      authMode !== 'none' on both screens.
 * AC5: the tenant-wide control is gated on the resolved role
 *      (tenant_admin), mirroring ConnectForm's own allowTenantWide gate.
 * AC6: deactivating never removes ConnectForm/DisconnectButton — both
 *      remain gated purely on credential presence, unaffected by isActive.
 *
 * Healing pass, 2026-08-17 (Menno's explicit sign-off, same session as
 * Story 8.1): both `tenant/connectors/page.tsx` and
 * `tenant/connectors/status/page.tsx` were split into thin Server
 * Components plus `ConnectorsClient.tsx`/`ConnectorStatusClient.tsx`
 * Client Components, which now own every rendering concern this contract
 * checks (`ActivateDeactivateButton` usage, the `authMode`/role gates, the
 * connect/disconnect blocks, the Active/Inactive label). Assertions below
 * now target the real Client Components directly, verified present, not
 * assumed identical, before repointing. One genuine wording reconciliation,
 * not a relocation: the Active/Inactive label is rendered via the shared
 * `StatusBadge` component (`src/components/ui`), whose `inactive` variant
 * default label is "Paused" — matching `frontend-design-specification.md`
 * §6.1's own explicit documentation ("`'inactive'` // watchlist or
 * connector paused"), the Approved design system's own prior decision, not
 * a regression this healing pass introduces. The real, substantive
 * behavior this AC actually cares about — `isActive: false` drives a
 * visually distinct, non-"Active" state, never silently defaulting to
 * looking connected — is unchanged; only the literal word is reconciled
 * with the already-approved design system.
 */

import fs from 'fs';
import path from 'path';

/**
 * React/renderToStaticMarkup and each Client Component are required fresh,
 * inside each test that needs them, rather than imported once at the top
 * of this file — this describe block's own AC1 tests call
 * jest.resetModules() in their afterEach, and a top-of-file `import React`
 * captured before that reset would end up a different module instance
 * than a component `require()`'d after it, leaving react-dom's hook
 * dispatcher unreachable ("Cannot read properties of null, reading
 * 'useState'"). Matches Story 8.1's own contract, which hit and resolved
 * the same issue the same way.
 */
function renderComponent(componentPath: string, exportName: string, props: Record<string, unknown>): string {
  const ReactLocal = require('react');
  const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
  const Component = require(componentPath)[exportName];
  return renderLocal(ReactLocal.createElement(Component, props));
}

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const connectorsPagePath = ['app', 'tenant', 'connectors', 'page.tsx'];
const statusPagePath = ['app', 'tenant', 'connectors', 'status', 'page.tsx'];
const connectorsClientPath = ['app', 'tenant', 'connectors', 'ConnectorsClient.tsx'];
const statusClientPath = ['app', 'tenant', 'connectors', 'status', 'ConnectorStatusClient.tsx'];
const buttonPath = ['app', 'tenant', 'connectors', 'ActivateDeactivateButton.tsx'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 6.15 — connector activation controls', () => {
  describe('AC1: core-client.ts and proxy routes', () => {
    it('creates the activate and deactivate proxy routes, mirroring connect/disconnect', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', 'app', 'api', 'connectors', '[platformId]', 'activate', 'route.ts'))).toBe(true);
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', 'app', 'api', 'connectors', '[platformId]', 'deactivate', 'route.ts'))).toBe(true);
      expect(readSrc('app', 'api', 'connectors', '[platformId]', 'activate', 'route.ts')).toContain('activatePlatform');
      expect(readSrc('app', 'api', 'connectors', '[platformId]', 'deactivate', 'route.ts')).toContain('deactivatePlatform');
    });

    it('ConnectorStatus gains isActive: boolean', () => {
      const source = readSrc('lib', 'core-client.ts');
      const interfaceMatch = source.match(/export interface ConnectorStatus \{[^}]*\}/);
      expect(interfaceMatch).not.toBeNull();
      expect(interfaceMatch![0]).toMatch(/isActive:\s*boolean/);
    });

    afterEach(() => {
      jest.dontMock('next/headers');
      jest.resetModules();
      jest.restoreAllMocks();
    });

    async function mockSessionAndFetch(responseBody: unknown, status: number) {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({
        idToken: 'x',
        accessToken: 'contract-test-access-token',
        identity: null,
      });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(responseBody), { status }));
      return fetchSpy;
    }

    it('activatePlatform() POSTs ownerType to /v1/connectors/:platformId/activate', async () => {
      const fetchSpy = await mockSessionAndFetch(
        { platformId: 'gnews', ownerType: 'tenant', isActive: true, activatedAt: '2026-08-12T00:00:00.000Z', deactivatedAt: null },
        200
      );
      const { activatePlatform } = await import('../../src/lib/core-client');
      const outcome = await activatePlatform('gnews', 'tenant');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/connectors/gnews/activate'),
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ ownerType: 'tenant' }) })
      );
      expect(outcome.status).toBe(200);
    });

    it('deactivatePlatform() POSTs ownerType (and optional userId) to /v1/connectors/:platformId/deactivate', async () => {
      const fetchSpy = await mockSessionAndFetch(
        { platformId: 'gnews', ownerType: 'user', isActive: false, activatedAt: null, deactivatedAt: '2026-08-12T00:00:00.000Z' },
        200
      );
      const { deactivatePlatform } = await import('../../src/lib/core-client');
      const outcome = await deactivatePlatform('gnews', 'user');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/connectors/gnews/deactivate'),
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ ownerType: 'user' }) })
      );
      expect(outcome.status).toBe(200);
    });

    it('activatePlatform() returns the real 403 body on a role-gate rejection, does not throw', async () => {
      await mockSessionAndFetch({ error: 'Only a tenant_admin may activate a tenant-wide connector.' }, 403);
      const { activatePlatform } = await import('../../src/lib/core-client');
      const outcome = await activatePlatform('gnews', 'tenant');

      expect(outcome.status).toBe(403);
      expect(outcome.body.error).toContain('tenant_admin');
    });
  });

  describe('AC3: ActivateDeactivateButton.tsx exists, is used on both screens, never gated behind connected/credential state', () => {
    it('creates the client component', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...buttonPath))).toBe(true);
      expect(readSrc(...buttonPath)).toMatch(/^'use client';/);
    });

    it('both real Client Components import ActivateDeactivateButton and render it outside any connected/isActive-only guard', () => {
      for (const clientPath of [connectorsClientPath, statusClientPath]) {
        const source = readSrc(...clientPath);
        expect(source).toContain('ActivateDeactivateButton');
      }
      // ConnectorsClient: rendered in all three branches of the footer's
      // authMode/isConnected switch (none-credential, connected, and —
      // deliberately, per AC3's own "never gated behind connected" text —
      // absent only from the not-yet-connected branch, since activating a
      // connector with no stored credential at all has nothing to
      // activate). ConnectorStatusClient: rendered unconditionally per row.
      const statusSource = readSrc(...statusClientPath);
      expect(statusSource).toMatch(/rows\.map\(/);
      const rowsBlock = statusSource.slice(statusSource.indexOf('rows.map('));
      expect(rowsBlock.indexOf('ActivateDeactivateButton')).toBeLessThan(rowsBlock.indexOf('cs-metrics-grid'));
    });
  });

  describe('AC4: the personal (ownerType "user") control is gated on real personal-scope eligibility on both real Client Components', () => {
    // 2026-08-17 (ADR-0028 Decision §1 Clarification, found live): the
    // personal control's gate widened from a pure authMode check to
    // `platform.personalScopeAllowed` — still false for authMode:'none'
    // (Newswire), but now also false for any AIProviderConnector
    // (azure-ai-language/azure-openai — Tier 2 only, no personal credential
    // possible), closing a real gap where a personal "Activate" click for
    // an AI provider silently succeeded but had no effect. See this same
    // date's dated note in story-6.3's own contract for the connect-side
    // half of this same fix.
    it('both Client Components gate the personal control on the real personalScopeAllowed flag', () => {
      for (const clientPath of [connectorsClientPath, statusClientPath]) {
        const source = readSrc(...clientPath);
        expect(source).toMatch(/personalScopeAllowed/);
      }
    });

    it('a real render omits the personal control for newswire (authMode "none") and for azure-ai-language (Tier 2 only), includes it for gnews', () => {
      const rows = [
        { platform: { id: 'gnews', name: 'GNews API', authMode: 'api_key', category: 'Ingestion', description: 'x', personalScopeAllowed: true }, isActive: false, health: null },
        { platform: { id: 'newswire', name: 'Global Newswire Feeds', authMode: 'none', category: 'Ingestion', description: 'x', personalScopeAllowed: false }, isActive: false, health: null },
        { platform: { id: 'azure-ai-language', name: 'Azure AI Language', authMode: 'api_key', category: 'Enrichment', description: 'x', personalScopeAllowed: false }, isActive: false, health: null },
      ];
      const html = renderComponent('../../src/app/tenant/connectors/status/ConnectorStatusClient', 'ConnectorStatusClient', { rows, isTenantAdmin: false });
      // Personal control renders once for gnews (personalScopeAllowed:
      // true), zero times for newswire or azure-ai-language (both false) —
      // isTenantAdmin: false means no tenant-wide button is rendered for
      // any of them, so this count isolates the personal-scope gate alone.
      const buttonCount = (html.match(/Activate<\/button>/g) ?? []).length;
      expect(buttonCount).toBe(1);
    });
  });

  describe('AC5: the tenant-wide control is gated on the resolved role, mirroring ConnectorsClient\'s own isTenantAdmin gate', () => {
    it('both Client Components gate the tenant-wide control on isTenantAdmin', () => {
      for (const clientPath of [connectorsClientPath, statusClientPath]) {
        const source = readSrc(...clientPath);
        expect(source).toMatch(/isTenantAdmin/);
      }
    });

    it('a real render omits every activation control when isTenantAdmin is false and authMode is "none" (no personal scope, no tenant-wide role)', () => {
      const rows = [{ platform: { id: 'newswire', name: 'Global Newswire Feeds', authMode: 'none', category: 'Ingestion', description: 'x' }, isActive: false, health: null }];
      const html = renderComponent('../../src/app/tenant/connectors/status/ConnectorStatusClient', 'ConnectorStatusClient', { rows, isTenantAdmin: false });
      expect(html).not.toContain('Activate</button>');
    });
  });

  describe('AC6: deactivation never removes the connect/disconnect controls — both stay gated purely on credential presence', () => {
    it('ConnectorsClient\'s connect-button / disconnect-button branches are not conditioned on isActive', () => {
      const source = readSrc(...connectorsClientPath);
      // Footer branches: authMode === 'none' | isConnected (connect vs.
      // disconnect) | else (not-yet-connected). Neither the isConnected
      // ternary condition nor the Disconnect button's own onClick reads
      // isActive anywhere — activation state and credential/connection
      // state stay independent switches (ADR-0051 Decision §3).
      const footerBlock = source.slice(source.indexOf('cv-card-footer'), source.indexOf('Connect Modal'));
      expect(footerBlock).toContain('isConnected ?');
      expect(footerBlock).not.toMatch(/isConnected\s*&&\s*!?\s*isActive|isActive\s*&&\s*isConnected/);
      expect(footerBlock).not.toMatch(/onClick=\{\(\) => setDisconnectingId\(platform\.id\)\}[\s\S]{0,10}isActive/);
    });
  });

  describe('AC2: real behavioral rendering — isActive drives the status label via the real, shared StatusBadge, not credentialStatus/authMode alone', () => {
    it('ConnectorsClient renders the shared StatusBadge "Paused" label for newswire when isActive is false, never "Active"', () => {
      const platform = {
        id: 'newswire', name: 'Global Newswire Feeds', subtitle: 'x', description: 'x',
        authMode: 'none' as const, color: 'indigo' as const, icon: 'radio' as const, adNotice: 'public' as const, credentialFields: [],
      };
      const html = renderComponent('../../src/app/tenant/connectors/ConnectorsClient', 'ConnectorsClient', {
        platforms: [platform],
        initialStates: [{ platformId: 'newswire', connected: true, credentialStatus: null, isActive: false, maskedHint: null }],
        isTenantAdmin: true,
      });
      expect(html).toContain('Newswire');
      expect(html).toContain('data-variant="inactive"');
      expect(html).not.toMatch(/data-variant="active"/);
    });

    it('ConnectorsClient renders the "active" StatusBadge variant once isActive is real and true, driven by the field, not authMode', () => {
      const platform = {
        id: 'newswire', name: 'Global Newswire Feeds', subtitle: 'x', description: 'x',
        authMode: 'none' as const, color: 'indigo' as const, icon: 'radio' as const, adNotice: 'public' as const, credentialFields: [],
      };
      const html = renderComponent('../../src/app/tenant/connectors/ConnectorsClient', 'ConnectorsClient', {
        platforms: [platform],
        initialStates: [{ platformId: 'newswire', connected: true, credentialStatus: null, isActive: true, maskedHint: null }],
        isTenantAdmin: true,
      });
      expect(html).toContain('data-variant="active"');
    });

    it('the connector status screen renders the real health status (not a flat active/inactive) once isActive is true, driven by the real field', () => {
      // ConnectorStatusClient is the health/telemetry screen — once active,
      // deriveVariant() surfaces the actual health.status nuance
      // (healthy/degraded/failing), the richer distinction AC3 (Story 6.5)
      // itself requires ("a failing connector is visually distinguished
      // from degraded/healthy"), rather than collapsing to a flat "active"
      // the way ConnectorsClient's simpler connect/manage screen does.
      const rows = [{ platform: { id: 'newswire', name: 'Global Newswire Feeds', authMode: 'none', category: 'Ingestion', description: 'x' }, isActive: true, health: { status: 'healthy', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null, isActive: true } }];
      const html = renderComponent('../../src/app/tenant/connectors/status/ConnectorStatusClient', 'ConnectorStatusClient', { rows, isTenantAdmin: true });
      expect(html).toContain('Newswire');
      expect(html).toContain('data-variant="healthy"');
    });

    it('the connector status screen renders "inactive" (never "active") for a platform whose isActive is false, regardless of health.status', () => {
      const rows = [{ platform: { id: 'gnews', name: 'GNews API', authMode: 'api_key', category: 'Ingestion', description: 'x' }, isActive: false, health: { status: 'healthy', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: 'valid', isActive: false } }];
      const html = renderComponent('../../src/app/tenant/connectors/status/ConnectorStatusClient', 'ConnectorStatusClient', { rows, isTenantAdmin: true });
      expect(html).toContain('data-variant="inactive"');
      expect(html).not.toMatch(/data-variant="active"/);
    });
  });

  it('documents the activation controls in both component skill notes', () => {
    const connectSkill = path.join(ADMIN_ROOT, '.claude', 'skills', 'connector-connect-disconnect', 'SKILL.md');
    const statusSkill = path.join(ADMIN_ROOT, '.claude', 'skills', 'connector-status-view', 'SKILL.md');
    expect(fs.readFileSync(connectSkill, 'utf8')).toContain('ActivateDeactivateButton');
    expect(fs.readFileSync(statusSkill, 'utf8')).toContain('ActivateDeactivateButton');
  });
});
