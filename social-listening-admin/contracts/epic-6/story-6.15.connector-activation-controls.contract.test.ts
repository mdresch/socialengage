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
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const connectorsPagePath = ['app', 'tenant', 'connectors', 'page.tsx'];
const statusPagePath = ['app', 'tenant', 'connectors', 'status', 'page.tsx'];
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

    it('both screens import ActivateDeactivateButton and render it inside the per-platform map, not inside a connected-only branch', () => {
      for (const pagePath of [connectorsPagePath, statusPagePath]) {
        const source = readSrc(...pagePath);
        expect(source).toContain('ActivateDeactivateButton');
        // The existing connected-gated controls look like
        // `{platform.authMode === 'api_key' && connected && (`; assert no
        // ActivateDeactivateButton usage sits behind an equivalent
        // `connected &&` / `isActive &&` guard.
        const activateUsageBlocks = source.split('ActivateDeactivateButton').slice(0, -1);
        for (const block of activateUsageBlocks) {
          const tail = block.slice(-200);
          expect(tail).not.toMatch(/connected\s*&&\s*\($/);
          expect(tail).not.toMatch(/isActive\s*&&\s*\($/);
        }
      }
    });
  });

  describe('AC4: the personal (ownerType "user") control is gated on authMode !== \'none\' on both screens', () => {
    it('both screens gate the personal control on authMode', () => {
      for (const pagePath of [connectorsPagePath, statusPagePath]) {
        const source = readSrc(...pagePath);
        expect(source).toMatch(/authMode\s*!==\s*['"]none['"]/);
      }
    });
  });

  describe('AC5: the tenant-wide control is gated on the resolved role, mirroring ConnectForm\'s own gate', () => {
    it('both screens gate the tenant-wide control on tenant_admin', () => {
      for (const pagePath of [connectorsPagePath, statusPagePath]) {
        const source = readSrc(...pagePath);
        expect(source).toMatch(/role\s*===\s*['"]tenant_admin['"]|isTenantAdmin/);
      }
    });
  });

  describe('AC6: deactivation never removes ConnectForm/DisconnectButton — both stay gated purely on credential presence', () => {
    it('ConnectForm/DisconnectButton usage in the connectors page is not conditioned on isActive', () => {
      const source = readSrc(...connectorsPagePath);
      const connectFormBlock = source.match(/\{platform\.authMode === 'api_key' && !connected[\s\S]{0,80}/);
      const disconnectBlock = source.match(/\{platform\.authMode === 'api_key' && connected[\s\S]{0,80}/);
      expect(connectFormBlock).not.toBeNull();
      expect(disconnectBlock).not.toBeNull();
      expect(connectFormBlock![0]).not.toContain('isActive');
      expect(disconnectBlock![0]).not.toContain('isActive');
    });
  });

  describe('AC2: real behavioral rendering — isActive drives the Active/Inactive label, not credentialStatus/authMode alone', () => {
    afterEach(() => {
      jest.dontMock('next/headers');
      jest.dontMock('next/navigation');
      jest.resetModules();
      jest.restoreAllMocks();
    });

    async function renderPageAs(relativePagePath: string, fetchImpl: (url: string) => Response) {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const identity = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'admin-1', role: 'tenant_admin' as const };
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity });

      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      jest.doMock('next/navigation', () => ({
        redirect: jest.fn((url: string) => {
          throw new Error(`NEXT_REDIRECT:${url}`);
        }),
      }));
      jest.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => fetchImpl(String(input)));

      const { default: Page } = await import(`../../src/${relativePagePath}`);
      return Page;
    }

    it('the connectors screen (Story 6.3) renders Inactive for newswire when isActive is false, not the old unconditional "Active" text', async () => {
      const Page = await renderPageAs('app/tenant/connectors/page', () =>
        new Response(
          JSON.stringify({ status: 'disconnected', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null, isActive: false }),
          { status: 200 }
        )
      );
      const element = await Page();
      const rendered = JSON.stringify(element);
      expect(rendered).toContain('Newswire');
      expect(rendered).toContain('Inactive');
      expect(rendered).not.toMatch(/Active \(no credential required\)/);
    });

    it('the connector status screen (Story 6.5) renders Active for a platform once isActive is true, driven by the real field', async () => {
      const Page = await renderPageAs('app/tenant/connectors/status/page', (url) => {
        if (url.includes('/v1/connectors/newswire')) {
          return new Response(
            JSON.stringify({ status: 'healthy', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null, isActive: true }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({ status: 'disconnected', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null, isActive: false }),
          { status: 200 }
        );
      });
      const element = await Page();
      const rendered = JSON.stringify(element);
      expect(rendered).toContain('Newswire');
      expect(rendered).toContain('Active');
    });
  });

  it('documents the activation controls in both component skill notes', () => {
    const connectSkill = path.join(ADMIN_ROOT, '.claude', 'skills', 'connector-connect-disconnect', 'SKILL.md');
    const statusSkill = path.join(ADMIN_ROOT, '.claude', 'skills', 'connector-status-view', 'SKILL.md');
    expect(fs.readFileSync(connectSkill, 'utf8')).toContain('ActivateDeactivateButton');
    expect(fs.readFileSync(statusSkill, 'utf8')).toContain('ActivateDeactivateButton');
  });
});
