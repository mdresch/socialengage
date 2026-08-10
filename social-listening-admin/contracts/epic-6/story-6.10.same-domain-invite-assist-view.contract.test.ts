/**
 * Contract: Story 6.10 (ADR-0037 §8b, against Story 5.16's real REST
 * surface) — Same-Domain Invite Assist view (Tenant-Admin dashboard).
 * See docs/user-stories/epic-6-admin-ui.md#story-610--same-domain-invite-assist-view-tenant-admin-dashboard
 *
 * Intent: Story 6.10 — Same-Domain Invite Assist view
 * Scope: social-listening-admin/{src/app/tenant/invite-assist/page.tsx (new),
 *   src/lib/core-client.ts (extended — listDomainSignupAttempts()),
 *   src/app/tenant/users/page.tsx (extended — reads an optional
 *   ?inviteEmail= search param and passes it down as InviteUserForm's
 *   initialEmail, per this story's own AC3 requiring the one-click "invite
 *   this person" action to pre-fill Story 6.8's already-built invite form),
 *   src/app/tenant/users/InviteUserForm.tsx (extended — accepts an optional
 *   initialEmail prop)}
 * Contract to encode: a screen reading Story 5.16's already-built
 *   GET /v1/tenants/domain-signup-attempts, showing one item per domain
 *   (never per individual attempt) with its distinct-verified-email count;
 *   an escalated domain (ADR-0037 §8b's threshold, already computed
 *   server-side) is visually distinguished with a materially different UI
 *   element, not just a bigger number in the same spot; each item expands
 *   on demand to the full list of distinct verified emails behind it (data
 *   Story 5.16 already returns inline — no second network call), each with
 *   a one-click link that pre-fills, never auto-submits, Story 6.8's invite
 *   form with that exact email; visible only to a tenant_admin-resolved
 *   session — redirected away (never rendered) for a tenant_user session,
 *   the same "whole screen gated," not "in-page element gated," pattern
 *   Story 6.2's own cross-shell redirect already established (deliberately
 *   different from Story 6.8's own in-page-only invite-form gate); no
 *   cross-tenant data is ever rendered — the screen trusts and renders
 *   whatever Story 5.16's own RLS-scoped endpoint returns, adding no
 *   redundant application-level tenant filter of its own.
 *
 * Explicitly out of scope for this contract:
 *   - Re-proving GET /v1/tenants/domain-signup-attempts' own backend
 *     behavior (RLS scoping to the caller's own tenant, the aggregation-by-
 *     domain logic, the escalation threshold computation) — Story 5.16's
 *     own contract (social-listening-core/contracts/epic-5/story-5.16...)
 *     already proves all of that; this contract only proves the admin UI
 *     reads it and renders it correctly.
 *   - Any accept/reject/approval state machine — ADR-0037 §8b is explicit
 *     that no such thing exists; the one-click action only pre-fills a form,
 *     the Tenant-Admin's own act of submitting Story 6.8's invite form is
 *     the only thing that actually grants access.
 *   - Real-time/automatic escalation alerting (ADR-0037 §8c's own named
 *     scope limit, unrelated to this UI screen).
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 6.10 — Same-Domain Invite Assist view', () => {
  const pagePath = ['app', 'tenant', 'invite-assist', 'page.tsx'];

  describe('AC1: reads GET /v1/tenants/domain-signup-attempts, one item per domain with a distinct-email count', () => {
    it('creates the /tenant/invite-assist screen route', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...pagePath))).toBe(true);
    });

    it('renders per-domain items keyed by domain, showing distinctEmailCount', () => {
      const source = readSrc(...pagePath);
      expect(source).toContain('listDomainSignupAttempts');
      expect(source).toMatch(/item\.domain/);
      expect(source).toMatch(/item\.distinctEmailCount/);
    });
  });

  describe("AC2: an escalated domain is visually distinguished with a materially different UI element, not just a bigger number", () => {
    it('renders a distinct escalation element/label conditional on item.escalated, not merely interpolating the count differently', () => {
      const source = readSrc(...pagePath);
      expect(source).toMatch(/item\.escalated/);
      // A real, distinct element/label — not just a numeric interpolation of distinctEmailCount alone.
      expect(source.toLowerCase()).toMatch(/escalat/);
    });
  });

  describe('AC3: expands on demand to the full email list, each with a one-click pre-fill link (never auto-invite)', () => {
    it('renders every email in item.emails with a link to /tenant/users?inviteEmail=<email>', () => {
      const source = readSrc(...pagePath);
      expect(source).toMatch(/item\.emails/);
      expect(source).toContain('/tenant/users?inviteEmail=');
      expect(source).toMatch(/encodeURIComponent/);
    });

    it('uses a native disclosure element for expand-on-demand (no extra client-side fetch for the same data Story 5.16 already returns inline)', () => {
      const source = readSrc(...pagePath);
      expect(source).toMatch(/<details/);
    });
  });

  describe('AC3 (continued): Story 6.8\'s own invite form actually accepts and pre-fills the emailed value', () => {
    it("tenant/users/page.tsx reads an inviteEmail search param and passes it to InviteUserForm", () => {
      const source = readSrc('app', 'tenant', 'users', 'page.tsx');
      expect(source).toMatch(/searchParams/);
      expect(source).toContain('inviteEmail');
      expect(source).toMatch(/initialEmail/);
    });

    it('InviteUserForm accepts an initialEmail prop and seeds its own email state with it, never auto-submitting', () => {
      const source = readSrc('app', 'tenant', 'users', 'InviteUserForm.tsx');
      expect(source).toMatch(/initialEmail/);
      expect(source).not.toMatch(/useEffect\s*\([^)]*handleSubmit/);
    });
  });

  describe('AC4: visible only to a tenant_admin-resolved session — redirected away (never rendered) for tenant_user', () => {
    it('redirects whenever the resolved identity is not tenant_admin, before fetching any data', () => {
      const source = readSrc(...pagePath);
      expect(source).toMatch(/role\s*===\s*['"]tenant_admin['"]/);
      expect(source).toContain('redirect(');
      // The redirect check appears before the data fetch, not after — a
      // textual ordering check (redirect(...) offset < listDomainSignupAttempts offset).
      const redirectOffset = source.indexOf('redirect(');
      const fetchOffset = source.indexOf('listDomainSignupAttempts()');
      expect(redirectOffset).toBeGreaterThan(-1);
      expect(fetchOffset).toBeGreaterThan(-1);
      expect(redirectOffset).toBeLessThan(fetchOffset);
    });
  });

  describe('AC5: no cross-tenant data — the screen renders exactly what the RLS-scoped endpoint returns, no redundant filter', () => {
    it('renders item.domain directly from listDomainSignupAttempts() results, with no second tenant-scoping parameter constructed client- or server-side', () => {
      const source = readSrc(...pagePath);
      // No tenantId is ever threaded into the listDomainSignupAttempts() call —
      // scoping is entirely the backend's own RLS, per Story 5.16.
      expect(source).toMatch(/listDomainSignupAttempts\(\)/);
      expect(source).not.toMatch(/listDomainSignupAttempts\([^)]+\)/);
    });
  });

  describe('core-client.ts: listDomainSignupAttempts()', () => {
    afterEach(() => {
      jest.dontMock('next/headers');
      jest.resetModules();
      jest.restoreAllMocks();
    });

    it('GETs /v1/tenants/domain-signup-attempts with the session bearer token and returns the domains array', async () => {
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
            domains: [{ domain: 'acme.example', distinctEmailCount: 3, escalated: true, emails: ['a@acme.example', 'b@acme.example', 'c@acme.example'] }],
          }),
          { status: 200 }
        )
      );

      const { listDomainSignupAttempts } = await import('../../src/lib/core-client');
      const domains = await listDomainSignupAttempts();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/tenants/domain-signup-attempts'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer contract-test-access-token' }) })
      );
      expect(domains).toHaveLength(1);
      expect(domains[0].domain).toBe('acme.example');
      expect(domains[0].escalated).toBe(true);
      expect(domains[0].emails).toEqual(['a@acme.example', 'b@acme.example', 'c@acme.example']);
    });

    it('a 403 response (e.g. a stale tenant_user session) throws rather than silently returning an empty list', async () => {
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
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'This route requires a tenant_admin identity.' }), { status: 403 })
      );

      const { listDomainSignupAttempts } = await import('../../src/lib/core-client');
      await expect(listDomainSignupAttempts()).rejects.toThrow();
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
    expect(fs.existsSync(path.join(ADMIN_ROOT, '.claude', 'skills', 'same-domain-invite-assist', 'SKILL.md'))).toBe(true);
  });
});
