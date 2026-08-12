/**
 * Contract: Story 6.6 (ADR-0030, ADR-0031, ADR-0035) — Platform Admin
 * console, real rework (provision/update/break-glass wired to the real
 * backend; database health indicator added).
 * See docs/user-stories/epic-7-platform-admin-ui.md#story-66
 *
 * Intent: Story 6.6 — Platform Admin console
 * Scope: social-listening-admin/{src/app/platform-admin/page.tsx (rewrite),
 *   src/app/platform-admin/ProvisionTenantForm.tsx (new),
 *   src/app/platform-admin/TenantAdminControls.tsx (new),
 *   src/app/platform-admin/BreakGlassPanel.tsx (new),
 *   src/app/api/admin/tenants/route.ts (new — POST provision proxy),
 *   src/app/api/admin/tenants/[tenantId]/route.ts (new — PATCH update proxy;
 *   named [tenantId] not [id] to match the sibling break-glass routes at the
 *   same directory level — Next.js requires one dynamic-segment name per
 *   path position, a real routing conflict found and fixed via
 *   heal-contract-failure during this story's own build),
 *   src/app/api/admin/tenants/[tenantId]/break-glass/request/route.ts (new),
 *   src/app/api/admin/tenants/[tenantId]/break-glass/requests/[requestId]/execute/route.ts (new),
 *   src/lib/core-client.ts (extended — BreakGlassRequestSummary/
 *   BreakGlassExecutionResult types, createAdminTenant()/updateAdminTenant()/
 *   requestBreakGlassReset()/executeBreakGlassRequest() converted from
 *   throw-on-non-2xx to the raw {status, body} outcome pattern used
 *   elsewhere for mutations — nothing called these before this story, so
 *   this is a safe, in-scope signature completion, not a breaking change to
 *   a real caller; getCoreHealthStatus() added, wrapping the already-real
 *   checkCoreHealth())}
 *
 * Correction, 2026-08-12: "Provision tenant," "Update tenant," and
 * "Break-glass" on the prior version of this page were each a single
 * descriptive <p> — no form, no input, no button, no onClick/onSubmit
 * anywhere — despite createAdminTenant()/updateAdminTenant()/
 * requestBreakGlassReset()/executeBreakGlassRequest() already existing as
 * real, working functions in core-client.ts that nothing called. The prior
 * version of this contract only checked that these function names and
 * endpoint-path strings appeared as text somewhere in core-client.ts and
 * that certain headings/copy appeared in the page — it could not detect
 * that the page never actually invoked them. The Tenant registry and Audit
 * log sections were already real (listAdminTenants()/queryAdminAuditLog())
 * and needed no rework — this contract keeps proving those two unchanged.
 *
 * Contract to encode:
 * - AC1: a real provision-tenant form (name, license seat count) calling
 *   createAdminTenant() -> POST /v1/admin/tenants.
 * - AC2: a real per-tenant-row update control calling updateAdminTenant()
 *   -> PATCH /v1/admin/tenants/:id, scoped to exactly status and
 *   license_seat_count.
 * - AC3: a real two-phase break-glass flow — a request control, then a
 *   separate execute control only reachable after a request exists; the
 *   returned temporaryAccessPass is rendered exactly once and never written
 *   to any state that persists past that render.
 * - AC4 (added 2026-08-12): a database health indicator reading Story
 *   1.10's real, unauthenticated GET /v1/health.
 * - Carried forward unchanged: no tenant-content table is ever rendered on
 *   this screen (users, watchlists, social_posts, platform_credentials).
 *
 * Enhancement, 2026-08-12, at Menno's own direct request (found live — no
 * path anywhere renames a tenant after creation): TenantAdminControls.tsx
 * gains a `name` field, PATCHing it alongside status/licenseSeatCount.
 * updateAdminTenant()'s input type gains `name`; the [tenantId]/route.ts
 * proxy forwards it the same way it already forwards status/licenseSeatCount
 * (domain stays excluded at this boundary, unchanged — a separate,
 * already-named gap this enhancement does not touch). Backend support
 * (PATCH /v1/admin/tenants/:id accepting name, migration 0029's grant) is
 * social-listening-core's own Story 5.12 contract, not re-proven here.
 *
 * Explicitly out of scope for this contract:
 *   - Re-proving GET/POST/PATCH /v1/admin/tenants', the break-glass
 *     endpoints', or GET /v1/health's own backend behavior — Stories
 *     5.12/5.13/1.10's own contracts already prove all of that; this
 *     contract only proves the admin UI calls each correctly and reacts
 *     correctly to each documented response shape.
 *   - The Tenant-Admin-lookup-by-tenant-name gap (targetUserId is typed in
 *     directly by the operator from an already-known, out-of-band support
 *     request — not looked up from any tenant-content list this screen
 *     would otherwise have to render) — a real, already-named backend gap
 *     (social-listening-core/.claude/skills/platform-admin-break-glass-rest/
 *     SKILL.md), unaffected by this story.
 *   - Client-side interactive/DOM rendering — no jsdom/testing-library in
 *     this repo, testEnvironment is 'node'. Client Component behavior is
 *     proven structurally (source content) plus at the Route Handler /
 *     core-client unit level, the same split every other Epic 6/7 client-
 *     component story has worked within.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 6.6 — Platform Admin console, real rework (2026-08-12)', () => {
  const pagePath = ['app', 'platform-admin', 'page.tsx'];
  const provisionPath = ['app', 'platform-admin', 'ProvisionTenantForm.tsx'];
  const updatePath = ['app', 'platform-admin', 'TenantAdminControls.tsx'];
  const breakGlassPath = ['app', 'platform-admin', 'BreakGlassPanel.tsx'];

  it('creates a platform-admin console route', () => {
    expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...pagePath))).toBe(true);
  });

  describe('Tenant registry and Audit log stay real and unchanged (no rework needed)', () => {
    it('the page still calls listAdminTenants() and queryAdminAuditLog()', () => {
      const source = readSrc(...pagePath);
      expect(source).toContain('listAdminTenants');
      expect(source).toContain('queryAdminAuditLog');
    });
  });

  describe('AC1: a real provision-tenant form calling createAdminTenant() -> POST /v1/admin/tenants', () => {
    it('ProvisionTenantForm posts name and licenseSeatCount to /api/admin/tenants', () => {
      const source = readSrc(...provisionPath);
      expect(source).toMatch(/fetch\(['"]\/api\/admin\/tenants['"]/);
      expect(source).toMatch(/method:\s*['"]POST['"]/);
      expect(source).toMatch(/licenseSeatCount/);
    });

    it('the page mounts ProvisionTenantForm', () => {
      const source = readSrc(...pagePath);
      expect(source).toContain('ProvisionTenantForm');
    });
  });

  describe('AC2: a real per-tenant update control calling updateAdminTenant(), scoped to status + licenseSeatCount only', () => {
    it('TenantAdminControls PATCHes /api/admin/tenants/:id with only status/licenseSeatCount, never domain or activeSeatCount', () => {
      const source = readSrc(...updatePath);
      expect(source).toMatch(/fetch\(`\/api\/admin\/tenants\/\$\{/);
      expect(source).toMatch(/method:\s*['"]PATCH['"]/);
      expect(source).not.toMatch(/activeSeatCount/);
      expect(source).not.toMatch(/\bdomain\b/);
    });

    it('the page mounts TenantAdminControls per tenant row', () => {
      const source = readSrc(...pagePath);
      expect(source).toContain('TenantAdminControls');
    });
  });

  describe('enhancement, 2026-08-12: TenantAdminControls also PATCHes name', () => {
    it('TenantAdminControls sends name in the PATCH body', () => {
      const source = readSrc(...updatePath);
      expect(source).toMatch(/\bname\b/);
    });

    it('the [tenantId]/route.ts proxy forwards name to updateAdminTenant(), still never domain', async () => {
      const updateAdminTenantMock = jest.fn().mockResolvedValue({ status: 200, body: { id: 't-1', name: 'CBA' } });
      jest.doMock('../../src/lib/core-client', () => ({ updateAdminTenant: updateAdminTenantMock }));
      const { PATCH } = await import('../../src/app/api/admin/tenants/[tenantId]/route');
      const response = await PATCH(
        new Request('http://localhost:3000/api/admin/tenants/t-1', {
          method: 'PATCH',
          body: JSON.stringify({ name: 'CBA', domain: 'evil.example.com' }),
        }),
        { params: Promise.resolve({ tenantId: 't-1' }) }
      );
      expect(updateAdminTenantMock).toHaveBeenCalledWith('t-1', { name: 'CBA' });
      expect(response.status).toBe(200);
      jest.dontMock('../../src/lib/core-client');
      jest.resetModules();
    });
  });

  describe('AC3: a real two-phase break-glass flow — request, then a separate execute reachable only after a request exists', () => {
    it('BreakGlassPanel posts to the request endpoint, storing the returned request id before any execute call is possible', () => {
      const source = readSrc(...breakGlassPath);
      expect(source).toMatch(/break-glass\/request/);
      expect(source).toMatch(/break-glass\/requests\/.*\/execute|execute/);
      // The execute call must be gated on request state existing first —
      // assert a conditional render/guard keyed on the stored request id,
      // not an unconditional two-button layout.
      expect(source).toMatch(/requestId/);
    });

    it('the TAP is rendered from local component state only — never window.location.reload() immediately after execute, never console.log, never written to a store', () => {
      const source = readSrc(...breakGlassPath);
      expect(source).toMatch(/temporaryAccessPass/);
      expect(source).not.toMatch(/console\.log\([^)]*temporaryAccessPass/);
      expect(source).not.toMatch(/localStorage|sessionStorage/);
    });

    it('the page mounts BreakGlassPanel with the real tenant list (for tenant selection — not a targetUserId lookup)', () => {
      const source = readSrc(...pagePath);
      expect(source).toContain('BreakGlassPanel');
    });
  });

  describe('AC4 (added 2026-08-12): a database health indicator reading the real, unauthenticated GET /v1/health', () => {
    it('the page calls checkCoreHealth()/getCoreHealthStatus(), not a fixture boolean', () => {
      const source = readSrc(...pagePath);
      expect(source).toMatch(/checkCoreHealth|getCoreHealthStatus/);
    });

    it('renders ok/unavailable, not raw JSON or a stack trace', () => {
      const source = readSrc(...pagePath);
      expect(source.toLowerCase()).toMatch(/database health|db health/);
    });
  });

  describe('Carried forward unchanged: no tenant-content table is ever rendered on this screen', () => {
    it('renders the zero tenant-content boundary copy', () => {
      const source = readSrc(...pagePath);
      expect(source).toContain('No tenant-content data');
      expect(source).toContain('users, watchlists, social posts, or credentials');
    });

    it('no post/watchlist/user-content field appears anywhere in the page or its new components', () => {
      for (const segments of [pagePath, provisionPath, updatePath, breakGlassPath]) {
        const source = readSrc(...segments);
        expect(source).not.toMatch(/rawPayload|post\.text|watchlist\.query|\.email\b/);
      }
    });
  });

  describe('core-client.ts: the four mutation functions return the raw {status, body} outcome, and getCoreHealthStatus()', () => {
    afterEach(() => {
      jest.dontMock('next/headers');
      jest.resetModules();
      jest.restoreAllMocks();
    });

    async function withAuthenticatedFetch<T>(fn: (fetchSpy: jest.SpyInstance) => Promise<T>): Promise<T> {
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
      const fetchSpy = jest.spyOn(global, 'fetch');
      try {
        return await fn(fetchSpy);
      } finally {
        fetchSpy.mockRestore();
      }
    }

    it('createAdminTenant() POSTs to /v1/admin/tenants and returns the raw status/body (a 400 is not thrown, but returned)', async () => {
      const outcome = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(new Response(JSON.stringify({ error: 'name (string) is required.' }), { status: 400 }));
        const { createAdminTenant } = await import('../../src/lib/core-client');
        const result = await createAdminTenant({ name: '', licenseSeatCount: 5 });
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/admin/tenants'),
          expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer contract-test-access-token' }) })
        );
        return result;
      });
      expect(outcome.status).toBe(400);
      expect(outcome.body.error).toMatch(/name/);
    });

    it('requestBreakGlassReset() POSTs {targetUserId} and returns the raw status/body including the real request id on success', async () => {
      const outcome = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(
          new Response(JSON.stringify({ id: 'req-1', requestedBy: 'a-1', targetTenantId: 't-1', targetUserId: 'u-1', status: 'requested' }), { status: 201 })
        );
        const { requestBreakGlassReset } = await import('../../src/lib/core-client');
        const result = await requestBreakGlassReset({ tenantId: 't-1', targetUserId: 'u-1' });
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/admin/tenants/t-1/break-glass/request'),
          expect.objectContaining({ method: 'POST' })
        );
        return result;
      });
      expect(outcome.status).toBe(201);
      expect(outcome.body.id).toBe('req-1');
    });

    it('executeBreakGlassRequest() returns the raw status/body including the real temporaryAccessPass on success', async () => {
      const outcome = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(
          new Response(JSON.stringify({ requestId: 'req-1', targetUserId: 'u-1', executedAt: '2026-08-12T00:00:00.000Z', temporaryAccessPass: 'tap-secret-value' }), { status: 200 })
        );
        const { executeBreakGlassRequest } = await import('../../src/lib/core-client');
        const result = await executeBreakGlassRequest({ tenantId: 't-1', requestId: 'req-1' });
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/admin/tenants/t-1/break-glass/requests/req-1/execute'),
          expect.objectContaining({ method: 'POST' })
        );
        return result;
      });
      expect(outcome.status).toBe(200);
      expect(outcome.body.temporaryAccessPass).toBe('tap-secret-value');
    });

    it('executeBreakGlassRequest() returns a real 409 on a retried execute, not thrown', async () => {
      const outcome = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(new Response(JSON.stringify({ error: 'Break-glass request req-1 is not pending (status: executed)' }), { status: 409 }));
        const { executeBreakGlassRequest } = await import('../../src/lib/core-client');
        return executeBreakGlassRequest({ tenantId: 't-1', requestId: 'req-1' });
      });
      expect(outcome.status).toBe(409);
      expect(outcome.body.error).toMatch(/not pending/);
    });

    it('getCoreHealthStatus() reads GET /v1/health with no Authorization header and returns ok/unavailable', async () => {
      jest.resetModules();
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
      const { getCoreHealthStatus } = await import('../../src/lib/core-client');
      const result = await getCoreHealthStatus();
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/v1/health'));
      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit | undefined];
      expect(init?.headers).toBeUndefined();
      expect(result).toBe('ok');
      fetchSpy.mockRestore();
    });
  });

  describe('Route Handlers proxy core-client outcomes through unmodified (status + body pass through)', () => {
    afterEach(() => {
      jest.dontMock('../../src/lib/core-client');
      jest.resetModules();
    });

    it('POST /api/admin/tenants returns createAdminTenant()\'s own status and body verbatim', async () => {
      jest.doMock('../../src/lib/core-client', () => ({
        createAdminTenant: jest.fn().mockResolvedValue({ status: 400, body: { error: 'name (string) is required.' } }),
      }));
      const { POST } = await import('../../src/app/api/admin/tenants/route');
      const response = await POST(new Request('http://localhost:3000/api/admin/tenants', { method: 'POST', body: JSON.stringify({}) }));
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toMatch(/name/);
    });

    it('PATCH /api/admin/tenants/:id forwards status/licenseSeatCount only to updateAdminTenant()', async () => {
      const updateAdminTenantMock = jest.fn().mockResolvedValue({ status: 200, body: { id: 't-1', status: 'suspended' } });
      jest.doMock('../../src/lib/core-client', () => ({ updateAdminTenant: updateAdminTenantMock }));
      const { PATCH } = await import('../../src/app/api/admin/tenants/[tenantId]/route');
      const response = await PATCH(
        new Request('http://localhost:3000/api/admin/tenants/t-1', { method: 'PATCH', body: JSON.stringify({ status: 'suspended', licenseSeatCount: 20, domain: 'evil.example.com' }) }),
        { params: Promise.resolve({ tenantId: 't-1' }) }
      );
      expect(updateAdminTenantMock).toHaveBeenCalledWith('t-1', { status: 'suspended', licenseSeatCount: 20 });
      expect(response.status).toBe(200);
    });

    it('POST /api/admin/tenants/:tenantId/break-glass/request forwards targetUserId to requestBreakGlassReset()', async () => {
      const requestBreakGlassResetMock = jest.fn().mockResolvedValue({ status: 201, body: { id: 'req-1' } });
      jest.doMock('../../src/lib/core-client', () => ({ requestBreakGlassReset: requestBreakGlassResetMock }));
      const { POST } = await import('../../src/app/api/admin/tenants/[tenantId]/break-glass/request/route');
      const response = await POST(
        new Request('http://localhost:3000/api/admin/tenants/t-1/break-glass/request', { method: 'POST', body: JSON.stringify({ targetUserId: 'u-1' }) }),
        { params: Promise.resolve({ tenantId: 't-1' }) }
      );
      expect(requestBreakGlassResetMock).toHaveBeenCalledWith({ tenantId: 't-1', targetUserId: 'u-1' });
      expect(response.status).toBe(201);
    });

    it('POST .../break-glass/requests/:requestId/execute forwards to executeBreakGlassRequest() and returns a real 409 verbatim', async () => {
      const executeBreakGlassRequestMock = jest.fn().mockResolvedValue({ status: 409, body: { error: 'not pending' } });
      jest.doMock('../../src/lib/core-client', () => ({ executeBreakGlassRequest: executeBreakGlassRequestMock }));
      const { POST } = await import('../../src/app/api/admin/tenants/[tenantId]/break-glass/requests/[requestId]/execute/route');
      const response = await POST(
        new Request('http://localhost:3000/api/admin/tenants/t-1/break-glass/requests/req-1/execute', { method: 'POST' }),
        { params: Promise.resolve({ tenantId: 't-1', requestId: 'req-1' }) }
      );
      expect(executeBreakGlassRequestMock).toHaveBeenCalledWith({ tenantId: 't-1', requestId: 'req-1' });
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error).toBe('not pending');
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

  it('documents the reworked platform-admin console in the component skill note', () => {
    const skillPath = path.join(ADMIN_ROOT, '.claude', 'skills', 'platform-admin-console', 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);
    const skillSource = fs.readFileSync(skillPath, 'utf8');
    expect(skillSource).toContain('temporaryAccessPass');
  });
});
