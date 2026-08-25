/**
 * Contract: Story 6.7 (ADR-0037) — Self-service sign-up: new user becomes first
 * Tenant-Admin of a new tenant.
 * See docs/user-stories/epic-6-admin-ui.md#story-67--self-service-sign-up-new-user-becomes-first-tenant-admin-of-a-new-tenant
 *
 * Intent: Story 6.7 — Self-service sign-up UI
 * Scope: social-listening-admin/{src/app/sign-up/page.tsx (new),
 *   src/app/sign-up/domain-taken/page.tsx (new),
 *   src/app/sign-up/already-have-account/page.tsx (new),
 *   src/app/sign-up/error/page.tsx (new),
 *   src/app/api/auth/signup/route.ts (new),
 *   src/app/api/auth/callback/route.ts (extended — dispatches to the sign-up
 *   completion path when the OAuth state cookie carries mode: 'signup', otherwise
 *   behaves exactly as Story 6.1 left it),
 *   src/lib/signupFlow.ts (new — completeSelfServiceSignup(), the testable seam
 *   between the token exchange and the redirect decision),
 *   src/lib/core-client.ts (extended — selfServiceSignup(), the sole
 *   Authorization-header call site for this endpoint, per ADR-0036 §2's existing
 *   choke-point rule),
 *   src/proxy.ts (extended PUBLIC_PATHS for the new unauthenticated /sign-up*
 *   routes)}
 * Contract to encode: a "Sign up" entry point distinct from Story 6.1's sign-in
 *   page that collects the new tenant's name and triggers Entra's own sign-up
 *   dialog (prompt=create — confirmed against Microsoft's own
 *   learn.microsoft.com/entra/msal/javascript/browser/prompt-behavior, "Triggers a
 *   sign-up dialog allowing external users to create an account" — a standard
 *   OAuth authorization-request parameter, not MSAL-specific plumbing) via the
 *   exact same Authorization Code + PKCE mechanism Story 6.1 already established,
 *   never a second parallel auth mechanism; on return, the caller's bearer token
 *   (never a client-supplied identity claim) plus the collected tenant name is
 *   sent to core's already-built POST /v1/tenants/self-service-signup (Story
 *   5.15); a domain-match rejection (409) shows a vague, non-org-naming,
 *   reassuring message (ADR-0037 §3/§8d) and never leaks the matched tenant's
 *   identity because no tenant data is even in the redirect path to leak; a
 *   caller who already belongs to a tenant (409, "already belong") is shown a
 *   distinct, clear "you already have an account" message; a genuine
 *   network/backend failure surfaces a real, actionable error rather than a
 *   silent partial state; success establishes the ordinary Story 6.1 session
 *   (GET /v1/me hydration + encrypted cookie) and lands the caller on "/"; the
 *   sign-up screen's own copy discloses that sign-up is free/self-service at this
 *   step without inventing pricing/contract commercial copy (ADR-0027).
 *
 * Real infrastructure used: the signup Route Handler's own authorization-URL
 *   construction is exercised directly against the real Entra External ID tenant
 *   Story 5.6/6.1 already provisioned (a real client.discovery() call, the same
 *   ENTRA_* env vars Story 6.1's own contract requires) — not a mock of
 *   getEntraConfig(). A full, real interactive self-service sign-up (which
 *   requires completing a live email-OTP challenge against a brand-new mailbox,
 *   per ADR-0037 §8a) is not something this environment can drive end-to-end
 *   without real inbox access — the token-exchange boundary is proven at the
 *   unit level instead (completeSelfServiceSignup(), mocking only global.fetch,
 *   the same seam Story 6.1's own AC7 test already established for
 *   authenticatedCoreFetch()), consistent with this repo's existing practice of
 *   proving what's actually provable and naming the rest honestly rather than
 *   faking it.
 *
 * Explicitly out of scope for this contract:
 *   - POST /v1/tenants/self-service-signup's own backend behavior (denylist,
 *     domain-match detection, invited-row must-check-first routing, audit
 *     logging, partial-failure handling) — Story 5.15's own contract
 *     (social-listening-core/contracts/epic-5/story-5.15...) already proves all
 *     of that; this contract only proves the admin UI calls it correctly and
 *     reacts correctly to each of its documented response shapes.
 *   - ADR-0037 §8a's email-OTP-verification precondition itself — a deployment/
 *     configuration check named as required, not new code (see this component's
 *     own SKILL.md "Known gaps").
 *   - §8b/§8c (Same-Domain Invite Assist, Platform-Admin escalation visibility) —
 *     the story's own Acceptance Criteria name this as a separate, not-yet-owned
 *     admin-UI story (Story 6.10), not built here.
 *   - §7's rate-limiting/abuse-prevention mechanism — the story's own Acceptance
 *     Criteria explicitly exclude it from this UI-side work.
 */

import fs from 'fs';
import path from 'path';
import { spawn, execSync, type ChildProcess } from 'child_process';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 6.7 — self-service sign-up', () => {
  describe('AC1: a "Sign up" entry point distinct from sign-in, collecting the tenant name', () => {
    it('creates a /sign-up route distinct from /sign-in', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', 'app', 'sign-up', 'page.tsx'))).toBe(true);
    });

    it('the sign-up page collects an organization/tenant name and links to /api/auth/signup', () => {
      const source = readSrc('app', 'sign-up', 'page.tsx');
      expect(source).toMatch(/name=["']tenantName["']/);
      expect(source).toContain('/api/auth/signup');
    });

    it("the sign-up page's own copy is distinct from the sign-in page's copy", () => {
      const signUp = readSrc('app', 'sign-up', 'page.tsx');
      const signIn = readSrc('app', 'sign-in', 'page.tsx');
      expect(signUp).not.toBe(signIn);
    });
  });

  describe("AC1/AC8: the signup Route Handler triggers Entra's sign-up dialog and carries the collected name", () => {
    // openid-client ships ESM (imports oauth4webapi directly) — importing
    // route.ts straight into ts-jest (which doesn't transform node_modules)
    // fails with "Cannot use import statement outside a module". Story 6.1's
    // own contract already hit this exact constraint and solved it by driving
    // requests through a real `next dev` server (Next's own bundler handles
    // ESM fine) rather than importing Route Handlers directly — reused here,
    // on a distinct port so it can run alongside Story 6.1's own server.
    if (!process.env.ENTRA_TENANT_ID || !process.env.ENTRA_ADMIN_CLIENT_ID) {
      it.skip('requires real ENTRA_* env vars (see .env.example) — skipped, not faked', () => {});
      return;
    }

    // Dynamic, unlike Story 6.1's fixed PORT: this contract only inspects the
    // redirect-response headers this app's own route handler produces (fetch with
    // `redirect: 'manual'`, never followed) — it never completes a round trip back
    // through Entra, so nothing requires this port to match a registered redirect
    // URI. PID-derived so two concurrent agents in different worktrees, each also
    // running Story 6.1 on the fixed port 3000, don't collide with each other here.
    const PORT = 4100 + (process.pid % 500);
    const BASE_URL = `http://localhost:${PORT}`;
    let serverProcess: ChildProcess | null = null;

    function waitForServerReady(timeoutMs: number): Promise<void> {
      const deadline = Date.now() + timeoutMs;
      return new Promise((resolve, reject) => {
        const poll = async () => {
          try {
            const res = await fetch(`${BASE_URL}/sign-up`);
            if (res.status < 500) {
              resolve();
              return;
            }
          } catch {
            // not up yet
          }
          if (Date.now() > deadline) {
            reject(new Error(`Next dev server on ${BASE_URL} did not become ready in time.`));
            return;
          }
          setTimeout(poll, 1000);
        };
        poll();
      });
    }

    beforeAll(async () => {
      const isWin = process.platform === 'win32';
      const nextBin = path.join(ADMIN_ROOT, 'node_modules', '.bin', isWin ? 'next.cmd' : 'next');
      serverProcess = spawn(nextBin, ['dev', '-p', String(PORT)], {
        cwd: ADMIN_ROOT,
        // Own distDir — see Story 6.1's own contract test and
        // next.config.js's header comment for the full explanation (Next's
        // dev-server lock file is keyed by distDir, not port; two contracts
        // spawning `next dev` from this same project directory would
        // otherwise race for it under Jest's default parallel workers).
        env: { ...process.env, NEXT_DIST_DIR: '.next/test-story-6-7' },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: isWin,
      });
      serverProcess.stderr?.on('data', (chunk) => process.stderr.write(chunk));
      await waitForServerReady(90_000);
    }, 120_000);

    afterAll(async () => {
      if (serverProcess?.pid) {
        if (process.platform === 'win32') {
          try {
            execSync(`taskkill /PID ${serverProcess.pid} /T /F`);
          } catch {
            // already gone
          }
        } else {
          serverProcess.kill('SIGKILL');
        }
      }
    }, 30_000);

    it('redirects to the real Entra tenant with prompt=create and a PKCE challenge, storing signup mode + tenant name in the state cookie', async () => {
      const response = await fetch(
        `${BASE_URL}/api/auth/signup?tenantName=${encodeURIComponent('Acme Corp')}`,
        { redirect: 'manual' }
      );

      expect([302, 307, 308]).toContain(response.status);
      const location = response.headers.get('location');
      expect(location).toBeTruthy();
      const redirectUrl = new URL(location as string);
      expect(redirectUrl.hostname.endsWith('ciamlogin.com')).toBe(true);
      expect(redirectUrl.searchParams.get('prompt')).toBe('create');
      expect(redirectUrl.searchParams.get('code_challenge')).toBeTruthy();
      expect(redirectUrl.searchParams.get('code_challenge_method')).toBe('S256');

      const setCookie = response.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain('se_admin_oauth_state=');
      const match = setCookie.match(/se_admin_oauth_state=([^;]+)/);
      expect(match).toBeTruthy();
      const stateCookieValue = JSON.parse(decodeURIComponent(match![1]));
      expect(stateCookieValue.mode).toBe('signup');
      expect(stateCookieValue.tenantName).toBe('Acme Corp');
      expect(typeof stateCookieValue.codeVerifier).toBe('string');
      expect(typeof stateCookieValue.state).toBe('string');
    });

    it('a missing tenant name is rejected before any Entra redirect is built', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/signup`, { redirect: 'manual' });
      expect([302, 307, 308]).toContain(response.status);
      expect(response.headers.get('location')).toContain('/sign-up');
      expect(response.headers.get('location')).not.toContain('ciamlogin.com');
    });
  });

  describe('AC7: core-client.ts stays the sole Bearer-attachment choke point', () => {
    it('no second ad hoc fetch-with-Authorization-header call exists anywhere else in src/ (Story 6.1 AC7, re-checked after this story\'s additions)', () => {
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

    it('selfServiceSignup() POSTs {name} with the caller\'s bearer token to /v1/tenants/self-service-signup', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ id: 't-1', name: 'Acme Corp', status: 'active', domain: 'acme.example', userId: 'u-1' }), {
          status: 201,
        })
      );
      try {
        const { selfServiceSignup } = await import('../../src/lib/core-client');
        const outcome = await selfServiceSignup('a-real-access-token', 'Acme Corp');

        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/tenants/self-service-signup'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ Authorization: 'Bearer a-real-access-token' }),
            body: JSON.stringify({ name: 'Acme Corp' }),
          })
        );
        expect(outcome.status).toBe(201);
        expect(outcome.body.userId).toBe('u-1');
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe('completeSelfServiceSignup() — the token-exchange -> redirect decision', () => {
    afterEach(() => {
      jest.restoreAllMocks();
      jest.resetModules();
    });

    it('AC2/AC7: a 201 success establishes the ordinary Story 6.1 session (GET /v1/me hydration) and redirects to "/"', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 't-1', name: 'Acme Corp', status: 'active', domain: 'acme.example', userId: 'u-1' }), {
            status: 201,
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ type: 'tenant_user', tenantId: 't-1', userId: 'u-1', role: 'tenant_admin' }), {
            status: 200,
          })
        );

      const { completeSelfServiceSignup } = await import('../../src/lib/signupFlow');
      const result = await completeSelfServiceSignup({
        idToken: 'id-token',
        accessToken: 'access-token',
        tenantName: 'Acme Corp',
      });

      expect(result.kind).toBe('success');
      expect(result.redirectPath).toBe('/');
      expect('sessionCookieValue' in result && typeof result.sessionCookieValue).toBe('string');
      // First call is the self-service-signup POST; second is GET /v1/me — never the
      // other order (identity hydration must follow a *successful* provisioning, ADR-0036 §5).
      expect(fetchSpy.mock.calls[0][0]).toContain('/v1/tenants/self-service-signup');
      expect(fetchSpy.mock.calls[1][0]).toContain('/v1/me');
    });

    it('AC3: a domain-match 409 maps to the domain-taken redirect, never the already-have-account one', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            error:
              "An account for this email domain already exists. Ask your organization's admin for an invite — your request has been shared with them.",
          }),
          { status: 409 }
        )
      );

      const { completeSelfServiceSignup } = await import('../../src/lib/signupFlow');
      const result = await completeSelfServiceSignup({
        idToken: 'id-token',
        accessToken: 'access-token',
        tenantName: 'Acme Corp',
      });

      expect(result.kind).toBe('domain_match');
      expect(result.redirectPath).toBe('/sign-up/domain-taken');
    });

    it('AC6: an "already belong to a tenant" 409 maps to the already-have-account redirect', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'You already belong to a tenant.' }), { status: 409 })
      );

      const { completeSelfServiceSignup } = await import('../../src/lib/signupFlow');
      const result = await completeSelfServiceSignup({
        idToken: 'id-token',
        accessToken: 'access-token',
        tenantName: 'Acme Corp',
      });

      expect(result.kind).toBe('already_exists');
      expect(result.redirectPath).toBe('/sign-up/already-have-account');
    });

    it('AC9: a backend failure (5xx) maps to a real, distinguishable error redirect, not a silent success', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify({ error: 'Sign-up could not be completed.' }), { status: 500 }));

      const { completeSelfServiceSignup } = await import('../../src/lib/signupFlow');
      const result = await completeSelfServiceSignup({
        idToken: 'id-token',
        accessToken: 'access-token',
        tenantName: 'Acme Corp',
      });

      expect(result.kind).toBe('error');
      expect(result.redirectPath).toBe('/sign-up/error');
    });
  });

  describe('AC3: the domain-taken page never names the matched organization', () => {
    it('is static, generic copy with no interpolated tenant/org data', () => {
      const source = readSrc('app', 'sign-up', 'domain-taken', 'page.tsx');
      expect(source).toContain('admin for an invite');
      expect(source).not.toMatch(/\{.*tenant.*\}/i);
      expect(source).not.toContain('searchParams');
    });
  });

  describe('AC6: the already-have-account page has a clear, distinct message', () => {
    it('exists and points the caller at sign-in instead', () => {
      const source = readSrc('app', 'sign-up', 'already-have-account', 'page.tsx');
      expect(source.toLowerCase()).toContain('already');
      expect(source).toContain('/sign-in');
    });
  });

  describe('AC9: the generic sign-up error page gives an actionable message', () => {
    it('exists and invites retry rather than a dead end', () => {
      const source = readSrc('app', 'sign-up', 'error', 'page.tsx');
      expect(source.toLowerCase()).toMatch(/try again|retry/);
    });
  });

  describe('AC8: sign-up copy discloses free/self-service status without inventing commercial terms', () => {
    it('the sign-up page states sign-up is free/self-service and names no pricing/contract terms', () => {
      const source = readSrc('app', 'sign-up', 'page.tsx');
      expect(source.toLowerCase()).toContain('free');
      // Flags an actually-invented commercial figure (a dollar amount, a per-seat/per-month
      // rate) — not the word "contract terms" itself, which the copy uses only to disclaim
      // ("doesn't commit you to any... contract terms"), exactly what ADR-0027 asks for.
      expect(source.toLowerCase()).not.toMatch(/\$\d|per seat|per month/);
    });
  });

  describe('proxy.ts: the new /sign-up* routes are reachable while signed out', () => {
    it('lists every new sign-up route as public', () => {
      const source = readSrc('proxy.ts');
      expect(source).toContain("'/sign-up'");
      expect(source).toContain("'/sign-up/domain-taken'");
      expect(source).toContain("'/sign-up/already-have-account'");
      expect(source).toContain("'/sign-up/error'");
    });
  });

  it('documents this component in a SKILL.md', () => {
    expect(fs.existsSync(path.join(ADMIN_ROOT, '.claude', 'skills', 'self-service-signup-ui', 'SKILL.md'))).toBe(true);
  });
});
