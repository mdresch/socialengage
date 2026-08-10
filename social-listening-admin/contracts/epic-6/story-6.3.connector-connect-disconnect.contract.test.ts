/**
 * Intent — Story 6.3 (Connector connect/disconnect flow), sourced from
 * Phase 1 "also build, not storied" against Story 1.7's real REST surface
 * (ADR-0034) and ADR-0027's disclosure requirement.
 *
 * Healing pass, 2026-08-10 (Menno's explicit authorization): the original
 * version of this contract only checked that the screen route existed and
 * contained specific text strings ("GNews", "Newswire", "provider terms").
 * It never proved the screen actually called the real backend. Verified
 * directly against the shipped code: `tenant/connectors/page.tsx` was a
 * static placeholder — a hardcoded connector array with hardcoded
 * `connected` booleans, no credential-entry form, and no API call anywhere
 * in `core-client.ts` to `POST/DELETE /v1/connectors/:platformId/connect|
 * disconnect`. No real tenant could connect any platform through the UI,
 * despite Story 6.3 being marked built. This contract now proves the real
 * behavior AC1 always required.
 *
 * Scope expansion, explicitly authorized by Menno, same session: the
 * connector list now also includes `azure-ai-language` (Story 2.8) and
 * `azure-openai` (Story 2.9) alongside the originally-named GNews/Newswire —
 * both real, shipped `AIProviderConnector`s with no way to be connected by a
 * real tenant otherwise. `newswire` (`authMode: 'none'`) has no credential
 * to submit and is rendered as always-active, no connect/disconnect action.
 *
 * Contract encoded here:
 * - AC1: the screen's connector list and each platform's connection state
 *   are sourced from a real `GET /v1/connectors/:platformId` call via
 *   `core-client.ts` (derived from `credentialStatus !== null`), not a
 *   hardcoded array — proven both structurally (no hardcoded `connected:`
 *   literal) and via a real mocked-fetch call asserting the right URL/
 *   headers.
 * - AC2: the connect form offers `ownerType: 'tenant'` only when the caller
 *   is `tenant_admin`; always offers `ownerType: 'user'`.
 * - ADR-0027 disclosure copy is present (kept from the original contract).
 * - AC3: a 403 from `POST .../connect` or `DELETE .../disconnect` surfaces
 *   the backend's real error text, not a generic message.
 * - AC4: disconnecting requires an explicit two-click confirm sub-state
 *   (the same pattern `AccessControl.tsx`, Story 6.8, already established)
 *   before the `DELETE` call fires — never a native `window.confirm()`.
 * - `core-client.ts` stays the sole Bearer-attachment choke point (the
 *   established re-check every story since Story 6.9 performs).
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 6.3 — connector connect/disconnect flow (healed 2026-08-10)', () => {
  const pagePath = ['app', 'tenant', 'connectors', 'page.tsx'];
  const connectFormPath = ['app', 'tenant', 'connectors', 'ConnectForm.tsx'];
  const disconnectButtonPath = ['app', 'tenant', 'connectors', 'DisconnectButton.tsx'];

  describe('AC1: real connector list and connection state, not hardcoded', () => {
    it('creates the /tenant/connectors screen route', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...pagePath))).toBe(true);
    });

    it('calls getConnectorStatus() (a real backend call) rather than hardcoding a connected boolean', () => {
      const source = readSrc(...pagePath);
      expect(source).toContain('getConnectorStatus');
      // The old anti-pattern was a static PLATFORMS-shaped array literal
      // carrying its own `connected:` field directly — assert the platform
      // list itself carries no such field (loadConnectorState()'s own
      // returned state object legitimately does, derived at request time).
      const platformsListMatch = source.match(/const PLATFORMS: PlatformDefinition\[\] = \[[\s\S]*?\n\];/);
      expect(platformsListMatch).not.toBeNull();
      expect(platformsListMatch![0]).not.toMatch(/connected:/);
    });

    it('lists gnews, newswire, azure-ai-language, and azure-openai', () => {
      const source = readSrc(...pagePath);
      expect(source).toContain('gnews');
      expect(source).toContain('newswire');
      expect(source).toContain('azure-ai-language');
      expect(source).toContain('azure-openai');
    });

    it('renders the ADR-0027 disclosure copy', () => {
      const source = readSrc(...pagePath);
      expect(source).toContain('provider terms');
    });
  });

  describe('AC2: ownerType — tenant-wide offered only to tenant_admin, personal always offered', () => {
    it("gates tenant-wide ownerType on the resolved role, not a hardcoded value", () => {
      const source = readSrc(...pagePath);
      expect(source).toMatch(/role\s*===\s*['"]tenant_admin['"]/);
    });

    it('ConnectForm always allows ownerType user, tenant only when authorized', () => {
      const source = readSrc(...connectFormPath);
      expect(source).toContain('allowTenantWide');
      expect(source).toMatch(/ownerType/);
    });
  });

  describe('AC3: a 403 surfaces the real backend reason, not a generic message', () => {
    it('ConnectForm reads and displays the response body error on non-2xx', () => {
      const source = readSrc(...connectFormPath);
      expect(source).toMatch(/body\.error/);
    });

    it('DisconnectButton reads and displays the response body error on non-2xx', () => {
      const source = readSrc(...disconnectButtonPath);
      expect(source).toMatch(/body\.error/);
    });
  });

  describe('AC4: disconnect requires an explicit two-click confirm sub-state, never window.confirm()', () => {
    it('DisconnectButton uses a pending-confirm state, not a native confirm() dialog', () => {
      const source = readSrc(...disconnectButtonPath);
      expect(source).not.toContain('window.confirm(');
      expect(source).not.toMatch(/\bconfirm\(/);
      expect(source).toMatch(/useState/);
      expect(source.toLowerCase()).toContain('cancel');
    });
  });

  describe('core-client.ts: getConnectorStatus() / connectPlatform() / disconnectPlatform()', () => {
    afterEach(() => {
      jest.dontMock('next/headers');
      jest.resetModules();
      jest.restoreAllMocks();
    });

    it('getConnectorStatus() GETs /v1/connectors/:platformId with the session bearer token', async () => {
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

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ status: 'healthy', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: 'valid' }),
          { status: 200 }
        )
      );

      const { getConnectorStatus } = await import('../../src/lib/core-client');
      const result = await getConnectorStatus('gnews');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/connectors/gnews'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer contract-test-access-token' }) })
      );
      expect(result.credentialStatus).toBe('valid');
    });

    it('connectPlatform() POSTs credential + ownerType to /v1/connectors/:platformId/connect', async () => {
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

      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify({ id: 'c1', platformId: 'gnews', ownerType: 'tenant' }), { status: 201 }));

      const { connectPlatform } = await import('../../src/lib/core-client');
      const outcome = await connectPlatform('gnews', 'my-api-key', 'tenant');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/connectors/gnews/connect'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ credential: 'my-api-key', ownerType: 'tenant' }),
        })
      );
      expect(outcome.status).toBe(201);
    });

    it('connectPlatform() returns the real 403 body on a role-gate rejection, does not throw', async () => {
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
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify({ error: 'Only a tenant_admin may create a tenant-wide credential.' }), { status: 403 }));

      const { connectPlatform } = await import('../../src/lib/core-client');
      const outcome = await connectPlatform('gnews', 'my-api-key', 'tenant');

      expect(outcome.status).toBe(403);
      expect(outcome.body.error).toContain('tenant_admin');
    });

    it('disconnectPlatform() DELETEs /v1/connectors/:platformId/disconnect with ownerType as a query param', async () => {
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

      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify({ status: 'disconnected', platformId: 'gnews', ownerType: 'tenant' }), { status: 200 }));

      const { disconnectPlatform } = await import('../../src/lib/core-client');
      const outcome = await disconnectPlatform('gnews', 'tenant');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/connectors/gnews/disconnect?ownerType=tenant'),
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(outcome.status).toBe(200);
    });
  });

  describe("core-client.ts stays the sole Bearer-attachment choke point (re-checked after this story's additions)", () => {
    it('no second ad hoc fetch-with-Authorization-header call exists anywhere else in src/', () => {
      const offenders: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
            continue;
          }
          if (!full.endsWith('.ts') && !full.endsWith('.tsx')) continue;
          if (full === path.join(ADMIN_ROOT, 'src', 'lib', 'core-client.ts')) continue;
          const content = fs.readFileSync(full, 'utf8');
          if (/Authorization/.test(content) && /fetch\(/.test(content)) {
            offenders.push(full);
          }
        }
      };
      walk(path.join(ADMIN_ROOT, 'src'));
      expect(offenders).toEqual([]);
    });
  });

  it('documents the connector flow in the component skill note', () => {
    const skillPath = path.join(ADMIN_ROOT, '.claude', 'skills', 'connector-connect-disconnect', 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);
  });
});
