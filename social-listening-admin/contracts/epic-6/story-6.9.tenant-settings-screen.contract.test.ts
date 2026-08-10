/**
 * Contract: Story 6.9 (Phase 1/Phase 3 "also build, not storied") — Tenant
 * settings screen.
 * See docs/user-stories/epic-6-admin-ui.md#story-69--tenant-settings-screen
 *
 * Intent: Story 6.9 — Tenant settings screen
 * Scope: social-listening-admin/{src/app/tenant/settings/page.tsx (new),
 *   src/lib/core-client.ts (extended — getMyTenant())}
 * Contract to encode: a read-only screen displaying the caller's own tenant's
 *   name, status, domain, licenseSeatCount, activeSeatCount (as "N of M
 *   seats used," never raw numbers alone), and createdAt, sourced from
 *   Story 1.8's already-built GET /v1/tenants/me; visible to both
 *   tenant_admin and tenant_user resolved identities, no role gate on this
 *   read-only view (Story 6.2); no edit form anywhere on this screen (writes
 *   to status/licenseSeatCount/domain remain Platform-Admin-only, Story
 *   5.12); no tenant-content data (posts, watchlists, credentials) shown —
 *   settings/administrative metadata only, the same "status views show
 *   status, not content" principle Story 6.5 already applied.
 *
 * Explicitly out of scope for this contract:
 *   - Re-proving GET /v1/tenants/me's own backend behavior (RLS scoping,
 *     404-on-deleted-mid-request) — Story 1.8's own contract
 *     (social-listening-core/contracts/epic-1/story-1.8...) already proves
 *     that; this contract only proves the admin UI reads it and renders it
 *     correctly.
 *   - Any write/edit affordance — this screen is read-only by the story's
 *     own Acceptance Criteria, not an oversight to fix later.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 6.9 — Tenant settings screen', () => {
  const pagePath = ['app', 'tenant', 'settings', 'page.tsx'];

  describe('AC1: reads GET /v1/tenants/me and displays name/status/domain/seat counts/createdAt, read-only', () => {
    it('creates the /tenant/settings screen route', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...pagePath))).toBe(true);
    });

    it('renders name, status, domain, and createdAt from the fetched tenant', () => {
      const source = readSrc(...pagePath);
      expect(source).toContain('getMyTenant');
      expect(source).toMatch(/tenant\.name/);
      expect(source).toMatch(/tenant\.status/);
      expect(source).toMatch(/tenant\.domain/);
      expect(source).toMatch(/tenant\.createdAt/);
    });

    it('renders no form, input, or edit affordance anywhere on the screen', () => {
      const source = readSrc(...pagePath);
      expect(source).not.toMatch(/<form/i);
      expect(source).not.toMatch(/<input/i);
      expect(source.toLowerCase()).not.toContain('edit');
    });
  });

  describe('AC2: visible to both tenant_admin and tenant_user — no additional role gate', () => {
    it("gates only on the 'tenant' shell (Story 6.2), never on a specific role value", () => {
      const source = readSrc(...pagePath);
      expect(source).toContain("isShellAllowed(identity, 'tenant')");
      expect(source).not.toMatch(/role\s*===\s*['"]tenant_admin['"]/);
    });
  });

  describe('AC3: seat counts shown as "N of M seats used," never raw numbers alone', () => {
    it("renders the 'of' / 'seats used' phrasing around activeSeatCount and licenseSeatCount", () => {
      const source = readSrc(...pagePath);
      expect(source).toMatch(/tenant\.activeSeatCount/);
      expect(source).toMatch(/tenant\.licenseSeatCount/);
      expect(source.toLowerCase()).toMatch(/seats used/);
      expect(source).toMatch(/\bof\b/);
    });
  });

  describe('AC4: no tenant-content data — settings/administrative metadata only', () => {
    it('never references posts, watchlists, or credentials on this screen', () => {
      const source = readSrc(...pagePath);
      expect(source.toLowerCase()).not.toMatch(/\bpost(s)?\b/);
      expect(source.toLowerCase()).not.toContain('watchlist');
      expect(source.toLowerCase()).not.toContain('credential');
    });
  });

  describe('core-client.ts: getMyTenant()', () => {
    afterEach(() => {
      jest.dontMock('next/headers');
      jest.resetModules();
      jest.restoreAllMocks();
    });

    it('GETs /v1/tenants/me with the session bearer token and returns the tenant object', async () => {
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
          JSON.stringify({
            id: 't1',
            name: 'Acme Corp',
            status: 'active',
            domain: 'acme.example',
            licenseSeatCount: 10,
            activeSeatCount: 7,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
          { status: 200 }
        )
      );

      const { getMyTenant } = await import('../../src/lib/core-client');
      const tenant = await getMyTenant();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/tenants/me'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer contract-test-access-token' }) })
      );
      expect(tenant.name).toBe('Acme Corp');
      expect(tenant.activeSeatCount).toBe(7);
      expect(tenant.licenseSeatCount).toBe(10);
    });

    it('throws on a non-2xx response rather than silently returning an empty/partial tenant', async () => {
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
      jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Tenant not found.' }), { status: 404 }));

      const { getMyTenant } = await import('../../src/lib/core-client');
      await expect(getMyTenant()).rejects.toThrow();
    });
  });

  describe('core-client.ts stays the sole Bearer-attachment choke point (re-checked after this story\'s additions)', () => {
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

  it('documents this component in a SKILL.md', () => {
    expect(fs.existsSync(path.join(ADMIN_ROOT, '.claude', 'skills', 'tenant-settings', 'SKILL.md'))).toBe(true);
  });
});
