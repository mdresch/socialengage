/**
 * Contract: Story 6.20 (ADR-0057) — Multi-feed administration for the
 * tenant-owned-feed connector (list, edit, remove).
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-620
 *
 * Intent: replace TenantOwnedFeedSetup.tsx's single-activation state
 * machine with a real per-tenant feed list, sourced from
 * social-listening-core's new GET/PATCH/DELETE surface
 * (social-listening-core@e9d797f).
 * Scope: social-listening-admin/{
 *   src/lib/core-client.ts (extended — listTenantOwnedFeedActivations(),
 *     updateTenantOwnedFeedActivation(), removeTenantOwnedFeedActivation()),
 *   src/app/api/connectors/tenant-owned-feed/[id]/route.ts (new — PATCH +
 *     DELETE proxy),
 *   src/app/tenant/connectors/tenant-owned-feed/page.tsx (rewritten —
 *     fetches the list server-side, no more ?activationId= handling),
 *   src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup.tsx
 *     (rewritten — a real list, not a single-activation state machine)
 * }.
 * Contract to encode: page.tsx fetches every activation server-side and
 *   passes it down; a failed fetch degrades to an empty array, not a
 *   crash; the list renders each activation's domain/feedUrl/status; a
 *   `pending` row shows real TXT-record instructions (host/value/expiry)
 *   with 72-hours propagation copy, never under an error role; "Connect
 *   another feed" and per-row Edit/Remove are tenant_admin-only and always
 *   reachable, never gated on "only if the list is empty"; a banner warns
 *   when feeds exist but the tenant-wide connector switch is off;
 *   core-client.ts's three new functions attach the bearer token
 *   correctly; the new [id] proxy route forwards PATCH/DELETE outcomes
 *   verbatim.
 *
 * Explicitly out of scope for this contract:
 *   - Re-proving GET/PATCH/DELETE .../tenant-owned-feed's own backend
 *     behavior (role gate, domain-reuse auto-verify, soft-removal) —
 *     social-listening-core's own story-6.20 contract already proves
 *     that; this contract only proves the admin UI calls it correctly.
 *   - Client-side interactive rendering (no jsdom/testing-library in this
 *     repo) — proven via renderToStaticMarkup with real props/real
 *     rendering, plus structural source checks where genuinely structural
 *     (the "never disabled" Verify now button), the same split every
 *     other Epic 6 Client Component story in this repo already uses.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const pagePath = ['app', 'tenant', 'connectors', 'tenant-owned-feed', 'page.tsx'];
const setupPath = ['app', 'tenant', 'connectors', 'tenant-owned-feed', 'TenantOwnedFeedSetup.tsx'];
const idRoutePath = ['app', 'api', 'connectors', 'tenant-owned-feed', '[id]', 'route.ts'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

const TENANT_USER = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'u-1', role: 'tenant_user' as const };
const TENANT_ADMIN = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'u-1', role: 'tenant_admin' as const };

async function renderPageAs(fetchImpl: (url: string) => Response, identity: unknown = TENANT_ADMIN) {
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
  jest.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => fetchImpl(String(input)));

  const { default: Page } = await import('../../src/app/tenant/connectors/tenant-owned-feed/page');
  return Page();
}

function activation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'act-1',
    domain: 'blog.example.com',
    feedUrl: 'https://blog.example.com/feed',
    status: 'verified',
    txtRecordHost: '_socialengage-verify.blog.example.com',
    txtRecordValue: 'socialengage-verify=abc123',
    tokenExpiresAt: '2026-08-24T00:00:00.000Z',
    verifiedAt: '2026-08-17T00:00:00.000Z',
    createdAt: '2026-08-16T00:00:00.000Z',
    // Story 6.28 (ADR-0050's 2026-08-20 Amendment Log entry) added this
    // required field — null here is correct, not a stand-in: this
    // fixture's own activation never had a name set, unrelated to what
    // this story's own ACs actually test.
    name: null,
    ...overrides,
  };
}

afterEach(() => {
  jest.dontMock('next/headers');
  jest.dontMock('next/navigation');
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('Story 6.20 — tenant-owned-feed multi-feed administration (admin)', () => {
  describe('AC: page.tsx fetches the full list server-side and passes it to TenantOwnedFeedSetup', () => {
    it('calls listTenantOwnedFeedActivations() and forwards real activations to the client component', async () => {
      const element = await renderPageAs((url) => {
        if (url.includes('/v1/connectors/tenant-owned-feed/activations')) {
          return new Response(JSON.stringify({ activations: [activation(), activation({ id: 'act-2', domain: 'other.example.com' })] }), { status: 200 });
        }
        return new Response(JSON.stringify({ isActive: true }), { status: 200 });
      });

      const setupElement = element.props.children[2];
      expect(setupElement.props.activations).toHaveLength(2);
      expect(setupElement.props.activations[0].domain).toBe('blog.example.com');
    });

    it('degrades to an empty array, not a crash, when the list call fails', async () => {
      const element = await renderPageAs((url) => {
        if (url.includes('/v1/connectors/tenant-owned-feed/activations')) {
          return new Response(JSON.stringify({ error: 'nope' }), { status: 500 });
        }
        return new Response(JSON.stringify({ isActive: false }), { status: 200 });
      });

      const setupElement = element.props.children[2];
      expect(setupElement.props.activations).toEqual([]);
    });

    it('no longer reads or forwards a ?activationId= search param — superseded by the always-fresh server-fetched list (Story 6.20)', () => {
      const source = readSrc(...pagePath);
      expect(source).not.toMatch(/activationId/);
      expect(source).not.toMatch(/searchParams/);
    });
  });

  describe('AC: TenantOwnedFeedSetup renders the real list — domain, feedUrl, status', () => {
    it('renders each activation\'s domain and feed URL', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { TenantOwnedFeedSetup } = require('../../src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup');

      const html = renderToStaticMarkup(
        React.createElement(TenantOwnedFeedSetup, {
          activations: [activation({ domain: 'blog.acme.com', feedUrl: 'https://blog.acme.com/rss' })],
          isActive: true,
          isTenantAdmin: true,
        })
      );

      expect(html).toContain('blog.acme.com');
      expect(html).toContain('https://blog.acme.com/rss');
    });

    it('renders a real empty state when there are no activations yet', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { TenantOwnedFeedSetup } = require('../../src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup');

      const html = renderToStaticMarkup(
        React.createElement(TenantOwnedFeedSetup, { activations: [], isActive: false, isTenantAdmin: true })
      );

      expect(html.toLowerCase()).toMatch(/no feeds configured/);
    });
  });

  describe('AC: a pending activation shows real TXT-record instructions, never under an error role', () => {
    it('renders txtRecordHost/txtRecordValue/tokenExpiresAt and 72-hours propagation copy', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { TenantOwnedFeedSetup } = require('../../src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup');

      const html = renderToStaticMarkup(
        React.createElement(TenantOwnedFeedSetup, {
          activations: [activation({ status: 'pending', verifiedAt: null })],
          isActive: true,
          isTenantAdmin: true,
        })
      );

      expect(html).toContain('_socialengage-verify.blog.example.com');
      expect(html).toContain('socialengage-verify=abc123');
      expect(html).toMatch(/72 hours/);
      expect(html).toContain('Verify now');
    });

    it('the instructions are not rendered under an error/alert role', () => {
      const source = readSrc(...setupPath);
      const instructionsBlock = source.slice(source.indexOf('tof-txt-instructions'), source.indexOf('Verify now'));
      expect(instructionsBlock).not.toMatch(/role=["']alert["']/);
    });

    it('the "Verify now" action is never rendered disabled', () => {
      const source = readSrc(...setupPath);
      expect(source).not.toMatch(/disabled(?:={true})?[^}]*Verify now/s);
    });
  });

  describe('AC: "Connect another feed" and per-row Edit/Remove are tenant_admin-only and always reachable', () => {
    it('renders "Connect another feed" even when activations already exist (never gated on empty-list-only)', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { TenantOwnedFeedSetup } = require('../../src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup');

      const html = renderToStaticMarkup(
        React.createElement(TenantOwnedFeedSetup, { activations: [activation()], isActive: true, isTenantAdmin: true })
      );

      expect(html).toContain('Connect another feed');
    });

    it('renders Edit/Remove for a verified activation, Remove-only for a pending one, when tenant_admin', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { TenantOwnedFeedSetup } = require('../../src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup');

      const html = renderToStaticMarkup(
        React.createElement(TenantOwnedFeedSetup, {
          activations: [activation({ id: 'v1', status: 'verified' }), activation({ id: 'p1', status: 'pending', verifiedAt: null })],
          isActive: true,
          isTenantAdmin: true,
        })
      );

      expect(html).toContain('Edit feed URL');
      expect((html.match(/Remove/g) ?? []).length).toBeGreaterThanOrEqual(2);
    });

    it('renders no Edit/Remove/Connect controls for a tenant_user (non-admin) session', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { TenantOwnedFeedSetup } = require('../../src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup');

      const html = renderToStaticMarkup(
        React.createElement(TenantOwnedFeedSetup, { activations: [activation()], isActive: true, isTenantAdmin: false })
      );

      expect(html).not.toContain('Connect another feed');
      expect(html).not.toContain('Edit feed URL');
      expect(html).not.toContain('>Remove<');
    });
  });

  describe('AC: a banner warns when feeds exist but the tenant-wide connector switch is off', () => {
    it('renders the deactivated-connector warning when activations exist and isActive is false', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { TenantOwnedFeedSetup } = require('../../src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup');

      const html = renderToStaticMarkup(
        React.createElement(TenantOwnedFeedSetup, { activations: [activation()], isActive: false, isTenantAdmin: true })
      );

      expect(html.toLowerCase()).toMatch(/currently deactivated/);
      expect(html.toLowerCase()).toMatch(/none of them are being polled/);
    });

    it('renders no such banner when the connector is active', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { TenantOwnedFeedSetup } = require('../../src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup');

      const html = renderToStaticMarkup(
        React.createElement(TenantOwnedFeedSetup, { activations: [activation()], isActive: true, isTenantAdmin: true })
      );

      expect(html.toLowerCase()).not.toMatch(/currently deactivated/);
    });
  });

  describe('core-client.ts: listTenantOwnedFeedActivations()/updateTenantOwnedFeedActivation()/removeTenantOwnedFeedActivation()', () => {
    async function withAuthenticatedFetch<T>(fn: (fetchSpy: jest.SpyInstance) => Promise<T>): Promise<T> {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'contract-test-token', identity: null });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      const fetchSpy = jest.spyOn(global, 'fetch');
      try {
        return await fn(fetchSpy);
      } finally {
        fetchSpy.mockRestore();
      }
    }

    it('listTenantOwnedFeedActivations() GETs /v1/connectors/tenant-owned-feed/activations with the session bearer token', async () => {
      const activations = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(new Response(JSON.stringify({ activations: [activation()] }), { status: 200 }));
        const { listTenantOwnedFeedActivations } = await import('../../src/lib/core-client');
        const result = await listTenantOwnedFeedActivations();
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/connectors/tenant-owned-feed/activations'),
          expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer contract-test-token' }) })
        );
        return result;
      });
      expect(activations).toHaveLength(1);
      expect(activations[0].domain).toBe('blog.example.com');
    });

    it('listTenantOwnedFeedActivations() throws on a non-2xx', async () => {
      await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(new Response(JSON.stringify({ error: 'nope' }), { status: 403 }));
        const { listTenantOwnedFeedActivations } = await import('../../src/lib/core-client');
        await expect(listTenantOwnedFeedActivations()).rejects.toThrow();
      });
    });

    // 2026-08-20, dated note (Story 6.28): updateTenantOwnedFeedActivation()
    // widened from a positional (id, feedUrl) signature to (id, updates)
    // so it can also carry `name` independently — the same widening the
    // backend PATCH route itself gained. This is the same call, updated to
    // match; the real behavior asserted (a PATCH with the given body,
    // bearer-attached, raw status/body returned) is unchanged.
    it('updateTenantOwnedFeedActivation() PATCHes /v1/connectors/tenant-owned-feed/:id with the given updates and returns the raw status/body', async () => {
      const outcome = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(new Response(JSON.stringify(activation({ feedUrl: 'https://blog.example.com/new' })), { status: 200 }));
        const { updateTenantOwnedFeedActivation } = await import('../../src/lib/core-client');
        const result = await updateTenantOwnedFeedActivation('act-1', { feedUrl: 'https://blog.example.com/new' });
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/connectors/tenant-owned-feed/act-1'),
          expect.objectContaining({
            method: 'PATCH',
            headers: expect.objectContaining({ Authorization: 'Bearer contract-test-token' }),
            body: JSON.stringify({ feedUrl: 'https://blog.example.com/new' }),
          })
        );
        return result;
      });
      expect(outcome.status).toBe(200);
      expect(outcome.body.feedUrl).toBe('https://blog.example.com/new');
    });

    it('removeTenantOwnedFeedActivation() DELETEs /v1/connectors/tenant-owned-feed/:id and returns the raw status/body', async () => {
      const outcome = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(new Response(JSON.stringify(activation({ status: 'removed' })), { status: 200 }));
        const { removeTenantOwnedFeedActivation } = await import('../../src/lib/core-client');
        const result = await removeTenantOwnedFeedActivation('act-1');
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/connectors/tenant-owned-feed/act-1'),
          expect.objectContaining({
            method: 'DELETE',
            headers: expect.objectContaining({ Authorization: 'Bearer contract-test-token' }),
          })
        );
        return result;
      });
      expect(outcome.status).toBe(200);
      expect(outcome.body.status).toBe('removed');
    });
  });

  describe('Route Handler: the new [id] proxy forwards PATCH/DELETE outcomes verbatim', () => {
    afterEach(() => {
      jest.dontMock('../../src/lib/core-client');
      jest.resetModules();
    });

    it('PATCH /api/connectors/tenant-owned-feed/:id returns updateTenantOwnedFeedActivation()\'s own status and body verbatim', async () => {
      jest.doMock('../../src/lib/core-client', () => ({
        updateTenantOwnedFeedActivation: jest.fn().mockResolvedValue({ status: 400, body: { error: 'domain cannot be edited' } }),
      }));
      const { PATCH } = await import('../../src/app/api/connectors/tenant-owned-feed/[id]/route');
      const response = await PATCH(
        new Request('http://localhost:3000/api/connectors/tenant-owned-feed/act-1', {
          method: 'PATCH',
          body: JSON.stringify({ feedUrl: 'https://x.example/feed' }),
        }),
        { params: Promise.resolve({ id: 'act-1' }) }
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('domain cannot be edited');
    });

    it('DELETE /api/connectors/tenant-owned-feed/:id returns removeTenantOwnedFeedActivation()\'s own status and body verbatim', async () => {
      jest.doMock('../../src/lib/core-client', () => ({
        removeTenantOwnedFeedActivation: jest.fn().mockResolvedValue({ status: 200, body: activation({ status: 'removed' }) }),
      }));
      const { DELETE } = await import('../../src/app/api/connectors/tenant-owned-feed/[id]/route');
      const response = await DELETE(
        new Request('http://localhost:3000/api/connectors/tenant-owned-feed/act-1', { method: 'DELETE' }),
        { params: Promise.resolve({ id: 'act-1' }) }
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('removed');
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

  it('every scoped file exists', () => {
    for (const segments of [pagePath, setupPath, idRoutePath]) {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...segments))).toBe(true);
    }
  });

  it('documents this addition in the component SKILL.md', () => {
    const skillPath = path.join(ADMIN_ROOT, '.claude', 'skills', 'tenant-owned-feed-connector-setup', 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);
    const skillSource = fs.readFileSync(skillPath, 'utf8');
    expect(skillSource).toContain('ADR-0057');
  });
});
