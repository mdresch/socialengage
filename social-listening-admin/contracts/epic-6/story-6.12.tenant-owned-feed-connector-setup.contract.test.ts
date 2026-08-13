/**
 * Contract: Story 6.12 — Tenant-owned-feed connector setup UI.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-612--tenant-owned-feed-connector-setup-ui
 *
 * Intent:
 * Story: 6.12 — Tenant-owned-feed connector setup UI
 * ADR: ADR-0050 (Accepted 2026-08-11), against Story 2.11's real REST surface
 *   (POST /v1/connectors/tenant-owned-feed/connect,
 *   POST /v1/connectors/tenant-owned-feed/verify-domain — both real,
 *   contract-verified in social-listening-core already)
 * Scope: social-listening-admin/{src/lib/core-client.ts (extended —
 *   connectTenantOwnedFeed(), verifyTenantOwnedFeedDomain()),
 *   src/app/api/connectors/tenant-owned-feed/connect/route.ts (new),
 *   src/app/api/connectors/tenant-owned-feed/verify-domain/route.ts (new),
 *   src/app/tenant/connectors/tenant-owned-feed/page.tsx (new),
 *   src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup.tsx (new),
 *   src/app/tenant/connectors/page.tsx (extended — one link to the new
 *   screen, so it's reachable at all)}
 *
 * Contract to encode: a dedicated screen (not folded into Story 6.3's
 *   single-credential ConnectForm — ADR-0050's activation flow is a
 *   two-step domain+feedUrl-then-DNS-verify state machine, structurally
 *   different) offers a form for domain/feedUrl, calling the real
 *   POST /connect. A successful response's txtRecordHost/txtRecordValue/
 *   expiresAt are displayed as plain-language DNS-publish instructions,
 *   with propagation-delay copy (minutes to 72 hours) framed as normal,
 *   not an error or stuck state. A re-clickable "Verify now" button calls
 *   the real POST /verify-domain: a pending response is shown as
 *   retry-later copy, never a hard failure; a verified response
 *   transitions the screen to an active/connected state. The activation's
 *   connectorActivationId persists in the URL (?activationId=) so a
 *   tenant navigating away and back can re-click "Verify now" without
 *   restarting the whole connect flow. core-client.ts stays the sole
 *   Bearer-attachment choke point.
 *
 * Explicitly out of scope for this contract:
 *   - Re-proving POST /connect's / POST /verify-domain's own backend
 *     behavior (token generation, DNS lookup, activation persistence) —
 *     social-listening-core's own Story 2.11 contract already proves
 *     that; this contract only proves the admin UI calls them correctly
 *     and reacts to their real response shapes.
 *   - Automatic background re-check polling (ADR-0050 Decision §3 names
 *     this as an Admin UI concern, not server-enforced; a manual,
 *     re-clickable verify button is sufficient for v1).
 *   - Multi-domain/multi-feed management UI (ADR-0050 Open Question 2,
 *     deliberately unresolved).
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const pagePath = ['app', 'tenant', 'connectors', 'tenant-owned-feed', 'page.tsx'];
const setupPath = ['app', 'tenant', 'connectors', 'tenant-owned-feed', 'TenantOwnedFeedSetup.tsx'];
const connectorsPagePath = ['app', 'tenant', 'connectors', 'page.tsx'];
const connectRoutePath = ['app', 'api', 'connectors', 'tenant-owned-feed', 'connect', 'route.ts'];
const verifyRoutePath = ['app', 'api', 'connectors', 'tenant-owned-feed', 'verify-domain', 'route.ts'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

const TENANT_USER = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'u-1', role: 'tenant_user' as const };
const PLATFORM_ADMIN = { type: 'platform_admin' as const, adminId: 'pa-1' };

async function renderPageAs(identity: unknown, searchParams: Record<string, string> = {}) {
  jest.resetModules();
  const sessionModule = await import('../../src/lib/session');
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

  const { default: Page } = await import('../../src/app/tenant/connectors/tenant-owned-feed/page');
  return Page({ searchParams: Promise.resolve(searchParams) });
}

afterEach(() => {
  jest.dontMock('next/headers');
  jest.dontMock('next/navigation');
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('Story 6.12 — Tenant-owned-feed connector setup UI', () => {
  describe('AC1: a dedicated screen exists, not folded into Story 6.3\'s ConnectForm', () => {
    it('creates page.tsx and TenantOwnedFeedSetup.tsx as their own files', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...pagePath))).toBe(true);
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...setupPath))).toBe(true);
    });

    it('does not add tenant-owned-feed to Story 6.3\'s own PLATFORMS array', () => {
      const source = readSrc(...connectorsPagePath);
      expect(source).not.toMatch(/id:\s*['"]tenant-owned-feed['"]/);
    });

    it('links to the new screen from the main connectors page, so it is reachable', () => {
      const source = readSrc(...connectorsPagePath);
      expect(source).toContain('/tenant/connectors/tenant-owned-feed');
    });

    it('is gated on the tenant shell, redirecting a platform_admin session (Story 6.2)', async () => {
      await expect(renderPageAs(PLATFORM_ADMIN)).rejects.toThrow('NEXT_REDIRECT:/');
    });

    it('renders for a real tenant_user session, embedding TenantOwnedFeedSetup (a real element carrying its initialActivationId prop)', async () => {
      const element = await renderPageAs(TENANT_USER);
      expect(JSON.stringify(element)).toContain('"initialActivationId":null');
    });
  });

  describe('AC1 (core-client + proxy): the form calls the real POST /connect', () => {
    it('connectTenantOwnedFeed() POSTs domain/feedUrl to /v1/connectors/tenant-owned-feed/connect with the session bearer token', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'contract-test-token', identity: null });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      const responseBody = {
        connectorActivationId: 'act-1',
        txtRecordHost: '_socialengage-verify.blog.example.com',
        txtRecordValue: 'socialengage-verify=abc123',
        expiresAt: '2026-08-19T00:00:00.000Z',
        feedUrl: 'https://blog.example.com/feed',
      };
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 201 }));

      const { connectTenantOwnedFeed } = await import('../../src/lib/core-client');
      const outcome = await connectTenantOwnedFeed('blog.example.com', 'https://blog.example.com/feed');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/connectors/tenant-owned-feed/connect'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer contract-test-token' }),
          body: JSON.stringify({ domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed' }),
        })
      );
      expect(outcome.status).toBe(201);
      expect(outcome.body.connectorActivationId).toBe('act-1');
      expect(outcome.body.txtRecordHost).toBe('_socialengage-verify.blog.example.com');
    });

    it('the connect proxy route forwards connectTenantOwnedFeed()\'s raw status/body unchanged', () => {
      const source = fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...connectRoutePath), 'utf8');
      expect(source).toContain('connectTenantOwnedFeed');
      expect(source).toMatch(/outcome\.status/);
    });

    it('TenantOwnedFeedSetup.tsx submits to the same-origin proxy route, never core directly', () => {
      const source = readSrc(...setupPath);
      expect(source).toContain('/api/connectors/tenant-owned-feed/connect');
      expect(source).not.toMatch(/CORE_API_BASE_URL/);
    });
  });

  describe('AC2: a successful connect displays real TXT instructions with propagation-delay copy, never as an error', () => {
    it('renders txtRecordHost, txtRecordValue, and expiresAt from the real response', () => {
      const source = readSrc(...setupPath);
      expect(source).toContain('txtRecordHost');
      expect(source).toContain('txtRecordValue');
      expect(source).toContain('expiresAt');
    });

    it('includes plain-language propagation-delay copy naming the real up-to-72-hours window', () => {
      const source = readSrc(...setupPath);
      expect(source).toMatch(/72 hours/);
    });

    it('the instructions are not rendered under an error/alert role', () => {
      const source = readSrc(...setupPath);
      const instructionsBlock = source.slice(source.indexOf('txtRecordHost'), source.indexOf('Verify now'));
      expect(instructionsBlock).not.toMatch(/role=["']alert["']/);
    });
  });

  describe('AC3 (core-client + proxy + UI): the real POST /verify-domain, pending vs. verified', () => {
    it('verifyTenantOwnedFeedDomain() POSTs connectorActivationId to /v1/connectors/tenant-owned-feed/verify-domain with the session bearer token', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'contract-test-token-2', identity: null });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify({ status: 'pending', retryAfter: 60, connectorActivationId: 'act-1' }), { status: 200 }));

      const { verifyTenantOwnedFeedDomain } = await import('../../src/lib/core-client');
      const outcome = await verifyTenantOwnedFeedDomain('act-1');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/connectors/tenant-owned-feed/verify-domain'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer contract-test-token-2' }),
          body: JSON.stringify({ connectorActivationId: 'act-1' }),
        })
      );
      expect(outcome.status).toBe(200);
      expect(outcome.body.status).toBe('pending');
    });

    it('the verify-domain proxy route forwards verifyTenantOwnedFeedDomain()\'s raw status/body unchanged', () => {
      const source = fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...verifyRoutePath), 'utf8');
      expect(source).toContain('verifyTenantOwnedFeedDomain');
      expect(source).toMatch(/outcome\.status/);
    });

    it('a pending response is shown as retry-later copy, not a hard failure', () => {
      const source = readSrc(...setupPath);
      expect(source.toLowerCase()).toMatch(/not yet verified/);
      expect(source.toLowerCase()).toMatch(/try again/);
    });

    it('a verified response transitions the screen to an active/connected state', () => {
      const source = readSrc(...setupPath);
      expect(source).toMatch(/status\s*===\s*['"]verified['"]/);
      expect(source.toLowerCase()).toMatch(/connected|verified|active/);
    });

    it('the "Verify now" action is re-clickable (a plain button, not disabled after one call)', () => {
      const source = readSrc(...setupPath);
      expect(source).not.toMatch(/disabled(?:={true})?[^}]*Verify now/s);
    });
  });

  describe('AC4: connectorActivationId persists across navigation (URL or component state)', () => {
    it('a successful connect updates the URL with ?activationId=', () => {
      const source = readSrc(...setupPath);
      expect(source).toMatch(/activationId=/);
      expect(source).toMatch(/router\.replace|window\.history/);
    });

    it('page.tsx reads an initial ?activationId= search param and passes it to TenantOwnedFeedSetup', async () => {
      const element = await renderPageAs(TENANT_USER, { activationId: 'act-from-url' });
      expect(JSON.stringify(element)).toContain('act-from-url');
    });

    it('a real activationId (from state or URL) alone — with no fresh connect response — still renders the "Verify now" action', () => {
      const source = readSrc(...setupPath);
      // The pending branch must be reachable purely from activationId, not require
      // the full `activation` object (which is only ever populated by a fresh
      // connect response, never by the URL) — otherwise a returning tenant
      // (activationId from the URL only) could never re-click Verify now.
      expect(source).toMatch(/if\s*\(\s*activationId\s*\)/);
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

  it('documents this addition in its own component SKILL.md', () => {
    const skillPath = path.join(ADMIN_ROOT, '.claude', 'skills', 'tenant-owned-feed-connector-setup', 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);
    const skillSource = fs.readFileSync(skillPath, 'utf8');
    expect(skillSource).toContain('ADR-0050');
  });
});
