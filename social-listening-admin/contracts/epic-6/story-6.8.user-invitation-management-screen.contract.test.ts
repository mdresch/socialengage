/**
 * Contract: Story 6.8 (Phase 1/Phase 3 "also build, not storied") — Tenant-Admin
 * user invitation and management screen.
 * See docs/user-stories/epic-6-admin-ui.md#story-68--tenant-admin-user-invitation-and-management-screen
 *
 * Intent: Story 6.8 — Tenant-Admin user invitation and management screen
 * Scope: social-listening-admin/{src/app/tenant/users/page.tsx (new),
 *   src/app/tenant/users/InviteUserForm.tsx (new, Client Component),
 *   src/app/tenant/users/AccessControl.tsx (new, Client Component),
 *   src/app/api/tenant-users/route.ts (new — POST invite proxy),
 *   src/app/api/tenant-users/[id]/route.ts (new — PATCH access_ends_at proxy),
 *   src/lib/core-client.ts (extended — listTenantUsers(), inviteTenantUser(),
 *   setUserAccessEndsAt())}
 * Contract to encode: a screen listing every user for the caller's tenant
 *   (email, role, status, access_ends_at or "active indefinitely" when null),
 *   sourced from Story 1.9's already-built GET /v1/tenants/users; an invite
 *   form rendered only for a tenant_admin-resolved session (Story 6.2's
 *   role-gating), calling POST /v1/tenants/users and surfacing a specific,
 *   non-generic message on a 409 seat-ceiling response — never a generic
 *   failure; a 403 (e.g. a stale/spoofed session) surfaces the backend's own
 *   real reason, the same pattern Story 6.3 already established; setting or
 *   clearing access_ends_at (PATCH /v1/tenants/users/:id) requires an
 *   explicit confirm step whose own copy distinguishes an immediate
 *   offboarding from a scheduled future expiration, never firing the call
 *   directly off the first click.
 *
 * Explicitly out of scope for this contract:
 *   - Re-proving GET/POST/PATCH /v1/tenants/users' own backend behavior
 *     (role gate, seat-ceiling math, audit logging) — Story 1.9's own
 *     contract (social-listening-core/contracts/epic-1/story-1.9...) already
 *     proves all of that; this contract only proves the admin UI calls it
 *     correctly and reacts correctly to each documented response shape.
 *   - The access-history view reading user_access_audit_log — the story's own
 *     Acceptance Criteria name this as a natural companion, not required in
 *     this pass.
 *   - Client-side interactive rendering (no jsdom/testing-library in this
 *     repo, testEnvironment is 'node' per jest.config.js — the same
 *     constraint every other Epic 6 client-component story has worked
 *     within). Client Component behavior is proven structurally (source
 *     content) plus at the Route Handler / core-client unit level, the same
 *     split Story 6.7's own contract already used for its non-interactive
 *     half.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 6.8 — Tenant-Admin user invitation and management screen', () => {
  describe('AC1: lists every tenant user (email, role, status, access_ends_at)', () => {
    it('creates the /tenant/users screen route', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'users', 'page.tsx'))).toBe(true);
    });

    it("renders each user's email/role/status and 'active indefinitely' for a null access_ends_at", () => {
      const source = readSrc('app', 'tenant', 'users', 'page.tsx');
      expect(source).toContain('listTenantUsers');
      expect(source).toContain('active indefinitely');
      expect(source).toMatch(/user\.email/);
      expect(source).toMatch(/user\.role/);
      expect(source).toMatch(/user\.status/);
    });
  });

  describe('AC2: the invite form is offered only for a tenant_admin-resolved session', () => {
    it('the page gates the invite form on identity.role === tenant_admin', () => {
      const source = readSrc('app', 'tenant', 'users', 'page.tsx');
      expect(source).toMatch(/role\s*===\s*['"]tenant_admin['"]/);
      expect(source).toContain('InviteUserForm');
    });
  });

  describe('AC3: a 409 seat-ceiling response surfaces a specific, non-generic message', () => {
    it("InviteUserForm's own copy names the seat ceiling specifically, not a generic failure", () => {
      const source = readSrc('app', 'tenant', 'users', 'InviteUserForm.tsx');
      expect(source).toMatch(/409/);
      expect(source.toLowerCase()).toContain('seat ceiling');
    });
  });

  describe('AC4: setting/clearing access_ends_at requires an explicit confirm step, distinguishing immediate vs. scheduled', () => {
    it('AccessControl never calls the PATCH endpoint on the first click — a confirm sub-state sits in between', () => {
      const source = readSrc('app', 'tenant', 'users', 'AccessControl.tsx');
      expect(source).toContain('pending');
      // The first-click handlers only ever set pending state, never call apply()/fetch directly.
      const firstClickHandlers = source.match(/onClick=\{[^}]*setPending[^}]*\}/g) ?? [];
      expect(firstClickHandlers.length).toBeGreaterThanOrEqual(2);
      for (const handler of firstClickHandlers) {
        expect(handler).not.toMatch(/apply\(/);
      }
    });

    it("distinguishes 'immediately' from 'scheduled ... not immediately' in its own confirm copy", () => {
      const source = readSrc('app', 'tenant', 'users', 'AccessControl.tsx');
      expect(source.toLowerCase()).toMatch(/end.*access immediately/);
      expect(source.toLowerCase()).toMatch(/schedule.*not immediately/);
    });
  });

  describe('AC5: a 403 from the backend surfaces the real reason, not a generic failure', () => {
    it('InviteUserForm and AccessControl both render the backend-supplied error text on failure', () => {
      const inviteSource = readSrc('app', 'tenant', 'users', 'InviteUserForm.tsx');
      const accessSource = readSrc('app', 'tenant', 'users', 'AccessControl.tsx');
      expect(inviteSource).toMatch(/body\.error/);
      expect(accessSource).toMatch(/body\.error/);
    });
  });

  describe('core-client.ts: listTenantUsers()/inviteTenantUser()/setUserAccessEndsAt()', () => {
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

    // Dated correction, 2026-08-17: listTenantUsers() originally returned a
    // bare TenantUser[]. Widened to { users, seats } once GET /v1/tenants/users
    // itself started also returning the caller tenant's own real seat counts
    // (social-listening-core@556bb65) — a real, deliberate shape change, not
    // a silent rewrite. The one real caller (page.tsx) was updated in the
    // same pass.
    it('listTenantUsers() GETs /v1/tenants/users with the session bearer token and returns { users, seats }', async () => {
      const result = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(
          new Response(
            JSON.stringify({
              users: [{ id: 'u1', email: 'a@b.com', role: 'tenant_user', status: 'active', accessEndsAt: null }],
              seats: { licenseSeatCount: 10, activeSeatCount: 4 },
            }),
            { status: 200 }
          )
        );
        const { listTenantUsers } = await import('../../src/lib/core-client');
        const outcome = await listTenantUsers();
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/tenants/users'),
          expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer contract-test-access-token' }) })
        );
        return outcome;
      });
      expect(result.users).toHaveLength(1);
      expect(result.users[0].email).toBe('a@b.com');
      expect(result.seats).toEqual({ licenseSeatCount: 10, activeSeatCount: 4 });
    });

    it('inviteTenantUser() POSTs {email, role} and returns the raw status/body (a 409 is not thrown, but returned)', async () => {
      const outcome = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(new Response(JSON.stringify({ error: 'Tenant is at its license seat ceiling.' }), { status: 409 }));
        const { inviteTenantUser } = await import('../../src/lib/core-client');
        const result = await inviteTenantUser({ email: 'new@example.com', role: 'tenant_user' });
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/tenants/users'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ Authorization: 'Bearer contract-test-access-token' }),
            body: JSON.stringify({ email: 'new@example.com', role: 'tenant_user' }),
          })
        );
        return result;
      });
      expect(outcome.status).toBe(409);
      expect(outcome.body.error).toMatch(/seat ceiling/i);
    });

    it('setUserAccessEndsAt() PATCHes /v1/tenants/users/:id with {accessEndsAt}', async () => {
      const outcome = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(new Response(JSON.stringify({ id: 'u1', accessEndsAt: null }), { status: 200 }));
        const { setUserAccessEndsAt } = await import('../../src/lib/core-client');
        const result = await setUserAccessEndsAt('u1', null);
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/tenants/users/u1'),
          expect.objectContaining({
            method: 'PATCH',
            headers: expect.objectContaining({ Authorization: 'Bearer contract-test-access-token' }),
            body: JSON.stringify({ accessEndsAt: null }),
          })
        );
        return result;
      });
      expect(outcome.status).toBe(200);
    });
  });

  describe('Route Handlers proxy core-client outcomes through unmodified (status + body pass through)', () => {
    afterEach(() => {
      jest.dontMock('../../src/lib/core-client');
      jest.resetModules();
    });

    it('POST /api/tenant-users returns inviteTenantUser()\'s own status and body verbatim', async () => {
      jest.doMock('../../src/lib/core-client', () => ({
        inviteTenantUser: jest.fn().mockResolvedValue({ status: 409, body: { error: 'Tenant is at its license seat ceiling.' } }),
      }));
      const { POST } = await import('../../src/app/api/tenant-users/route');
      const response = await POST(
        new Request('http://localhost:3000/api/tenant-users', {
          method: 'POST',
          body: JSON.stringify({ email: 'x@y.com', role: 'tenant_user' }),
        })
      );
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error).toMatch(/seat ceiling/i);
    });

    it('PATCH /api/tenant-users/:id returns setUserAccessEndsAt()\'s own status and body verbatim, including a 403', async () => {
      jest.doMock('../../src/lib/core-client', () => ({
        setUserAccessEndsAt: jest.fn().mockResolvedValue({ status: 403, body: { error: 'Only tenant_admin may modify access_ends_at.' } }),
      }));
      const { PATCH } = await import('../../src/app/api/tenant-users/[id]/route');
      const response = await PATCH(
        new Request('http://localhost:3000/api/tenant-users/u1', {
          method: 'PATCH',
          body: JSON.stringify({ accessEndsAt: null }),
        }),
        { params: Promise.resolve({ id: 'u1' }) }
      );
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Only tenant_admin may modify access_ends_at.');
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
    expect(fs.existsSync(path.join(ADMIN_ROOT, '.claude', 'skills', 'tenant-user-management', 'SKILL.md'))).toBe(true);
  });
});
