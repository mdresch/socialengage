/**
 * Contract: Story 6.1 (ADR-0036) — Next.js scaffold and Entra sign-in (server-side session)
 * See docs/user-stories/epic-6-admin-ui.md#story-61-nextjs-scaffold-and-entra-sign-in-server-side-session
 *
 * Intent: Story 6.1 — Next.js scaffold and Entra sign-in (server-side session)
 * Scope: social-listening-admin/{package.json, next.config.js, next-env.d.ts, tsconfig.json,
 *   .gitignore, .env.example, jest.config.js, jest.global-setup.js, src/middleware.ts,
 *   src/app/layout.tsx, src/app/page.tsx, src/app/sign-in/page.tsx,
 *   src/app/signed-out/page.tsx, src/app/api/auth/login/route.ts,
 *   src/app/api/auth/callback/route.ts, src/app/api/auth/signout/route.ts,
 *   src/lib/entra.ts, src/lib/session.ts, src/lib/core-client.ts (extended)}
 * Contract to encode: ADR-0036 Decision §1–§6 and Story 6.1's own Acceptance Criteria —
 *   a real Next.js (App Router) scaffold that doesn't disturb Story 1.1's own REST-only
 *   boundary; unauthenticated requests redirected to sign-in; a real Authorization
 *   Code + PKCE exchange against the real Entra External ID tenant Story 5.6 provisioned
 *   (getsocialengage.onmicrosoft.com), proven against a real, live sign-in — not a mock;
 *   an exact-match redirect_uri, rejected by Entra itself (not this app's code) when
 *   mismatched; a real-entropy, never-committed session-cookie encryption key; tokens
 *   held only in an encrypted, httpOnly, Secure, SameSite=Lax cookie, never reachable
 *   from browser JavaScript; core-client.ts as the sole Bearer-attachment choke point;
 *   an attempted call to core's GET /v1/me handled gracefully while that endpoint doesn't
 *   exist yet; an 8-hour absolute session ceiling enforced server-side, no silent
 *   renewal; sign-out clearing the session cookie.
 *
 * Real infrastructure used throughout, not a mock:
 *   - The real Entra External ID tenant (getsocialengage.onmicrosoft.com,
 *     ENTRA_TENANT_ID) Story 5.6 already provisioned.
 *   - A real, dedicated app registration for social-listening-admin (ENTRA_ADMIN_CLIENT_ID),
 *     created 2026-08-04 for this story — confidential Web client, exact-match redirect
 *     URI http://localhost:3000/api/auth/callback, Authorization Code + PKCE.
 *   - A real, dedicated test user (ENTRA_ADMIN_TEST_USER_EMAIL/PASSWORD) — deliberately
 *     not social-listening-core's own ENTRA_TEST_TARGET_USER_ID, whose password Story
 *     5.7/5.8's break-glass contracts reset as part of their own runs.
 *   - A real `next dev` server (this file's own beforeAll/afterAll) driven by a real
 *     headless browser (Playwright/Chromium) that completes a real interactive sign-in —
 *     filling the real Entra sign-in form, not intercepting or mocking any network call.
 *
 * Auth.js/NextAuth.js check (ADR-0036 §3's own instruction to verify before committing to
 * a bespoke PKCE flow): checked directly at implementation time — Auth.js's documented
 * `microsoft-entra-id` provider names only ordinary workforce issuer forms
 * (login.microsoftonline.com/...), no text addresses External ID/CIAM tenants or the
 * ciamlogin.com issuer format; a follow-up search on Auth.js's generic custom-OIDC-provider
 * path likewise surfaced no confirmed, documented support for this project's actual tenant
 * type. This confirms rather than overturns ADR-0036's own web-search-level finding — the
 * bespoke Authorization Code + PKCE default (src/lib/entra.ts, via `openid-client`) stands.
 *
 * Explicitly out of scope for this contract:
 *   - GET /v1/me's own implementation and its own anti-spoofing contract (ADR-0036 §5's
 *     Clarification) — that is social-listening-core's own scope (built since, by Story
 *     5.11 — see the healing note below).
 *   - Stories 6.2–6.7's own screens/role-gating/features.
 *
 * --- Healing pass, 2026-08-10 (Menno's explicit direction, found via live manual sign-in
 * testing) ---
 * The bullet above originally deferred "any resource-scoped access token for calling
 * core's own API" as "a separate, later prerequisite once GET /v1/me actually exists" —
 * GET /v1/me now exists (Story 5.11), so that deferral is over. Its absence was a real,
 * live defect: social-listening-admin's OAuth flow requested only
 * `openid profile email offline_access`, so Entra never minted a token audienced for
 * social-listening-core's API app at all — every authenticated call through
 * `core-client.ts` (GET /v1/me, POST /v1/tenants/self-service-signup, connector
 * connect/disconnect) failed core's own `jwtVerify()` at the signature step. Confirmed
 * directly via diagnostic logging added to entraAuthMiddleware.ts (core) and
 * fetchResolvedIdentity()/selfServiceSignup() (admin) during a real interactive sign-in —
 * zero requests reaching core before the scope fix, `signature verification failed`
 * after. Fixed by exposing a delegated `access_as_user` scope on social-listening-core's
 * app registration (Expose an API), granting + admin-consenting it on
 * social-listening-admin's own registration, and adding
 * `api://social-listening-core/access_as_user` to `ENTRA_SCOPES` (src/lib/entra.ts). A
 * full real end-to-end round trip through a live core instance remains out of scope for
 * this contract (it spawns `next dev` only, never social-listening-core) — AC13 below
 * proves the scope itself is requested; the real live sign-in already proven by AC3/AC12
 * combined with this scope fix is what actually closes the loop, confirmed manually.
 */

import { spawn, execSync, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { chromium, type Browser, type BrowserContext } from '@playwright/test';
import { encryptSession, decryptSession, SESSION_COOKIE_NAME } from '../../src/lib/session';
import { fetchResolvedIdentity } from '../../src/lib/core-client';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const REPO_ROOT = path.resolve(ADMIN_ROOT, '..');
const CORE_ROOT = path.join(REPO_ROOT, 'social-listening-core');
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const CORE_BASE_URL = process.env.CORE_API_BASE_URL || 'http://localhost:3001';

const TEST_EMAIL = process.env.ENTRA_ADMIN_TEST_USER_EMAIL as string;
const TEST_PASSWORD = process.env.ENTRA_ADMIN_TEST_USER_PASSWORD as string;

if (!process.env.ENTRA_TENANT_ID || !process.env.ENTRA_ADMIN_CLIENT_ID || !TEST_EMAIL || !TEST_PASSWORD) {
  throw new Error(
    'Missing ENTRA_*/SESSION_SECRET env vars — see .env.example. This contract runs against ' +
      'a real Entra External ID tenant, not a mock.'
  );
}

let serverProcess: ChildProcess | null = null;
let coreProcess: ChildProcess | null = null;
let browser: Browser | null = null;

/**
 * Healed 2026-08-12 (cross-component regression, role-gating healing pass) — this
 * contract used to deliberately never start social-listening-core (see this file's own
 * top-of-file "Explicitly out of scope" note), so TEST_EMAIL's identity was always
 * unresolved (null) here. That was harmless before role-routing.ts's own getRoleShell()
 * defaulted a null identity to the tenant shell — AC3/AC4/AC6/AC12 below only cared that
 * "/" rendered *something* signed-in-looking. Once that default was corrected (a null
 * identity now redirects to /sign-in, per docs/implementation-log.md), those same
 * assertions would fail permanently, not flakily, unless TEST_EMAIL actually resolves to
 * a real identity — which requires a real, running core instance plus a real `users` row.
 * Both are now provided here: a real core dev server (mirroring `npm run dev`'s own
 * command) and an idempotent seed (scripts/ensureContractTestIdentity.ts, new) that
 * finds-or-creates a dedicated tenant and an invited row for TEST_EMAIL. This is squarely
 * still proving Story 6.1's own AC3/AC4/AC6/AC12 (the real OAuth/session mechanics) — it
 * now proves them under the real conditions a live deployment would actually have, rather
 * than under a coincidental gap this contract never meant to rely on.
 */
function waitForCoreReady(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const res = await fetch(`${CORE_BASE_URL}/v1/health`);
        if (res.status < 500) {
          resolve();
          return;
        }
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) {
        reject(new Error(`social-listening-core on ${CORE_BASE_URL} did not become ready in time.`));
        return;
      }
      setTimeout(poll, 1000);
    };
    poll();
  });
}

/**
 * A plain `fetch()` immediately after a heavy synchronous block in this test process
 * (e.g. AC1's own `execSync(npx jest ...)`, which freezes the event loop for several
 * seconds) can hit a transient ECONNRESET against the dev server even though the server
 * itself is fine — confirmed directly (not assumed) by reproducing it repeatedly at the
 * exact same point in the suite. A short retry absorbs that without masking a real
 * redirect/status bug, which would fail consistently, not just on the first attempt.
 */
async function fetchWithRetry(url: string, init?: RequestInit, attempts = 3): Promise<Response> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error('unreachable');
}

function waitForServerReady(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const res = await fetch(`${BASE_URL}/sign-in`);
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

  // Seed a real, resolvable identity for TEST_EMAIL before anything signs in — see this
  // file's own 2026-08-12 healing note above. Talks to the dev DB directly (no server
  // needs to be up yet for this), idempotent, safe to run every time this contract runs.
  execSync(`node scripts/withDevEnv.js npx ts-node scripts/ensureContractTestIdentity.ts "${TEST_EMAIL}" tenant_admin`, {
    cwd: CORE_ROOT,
    stdio: 'pipe',
    shell: isWin,
  });

  // A real social-listening-core instance — see this file's own 2026-08-12 healing note.
  // NODE_ENV is forced away from 'test' (this Jest process's own inherited value):
  // core's own app.ts swaps in testAuthBypassMiddleware whenever NODE_ENV==='test'
  // (reads a JSON X-Test-Identity header, skips real Entra token verification
  // entirely) — inheriting Jest's NODE_ENV here would silently run the spawned core
  // instance in bypass mode, rejecting this contract's real Bearer token with a 401
  // that looks identical to "missing Authorization header." Found via direct
  // instrumentation of entraAuthMiddleware.ts/core-client.ts during this healing
  // pass, both reverted after confirming — see docs/implementation-log.md.
  coreProcess = spawn(isWin ? 'npm.cmd' : 'npm', ['run', 'dev'], {
    cwd: CORE_ROOT,
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin,
  });
  coreProcess.stderr?.on('data', (chunk) => process.stderr.write(chunk));
  coreProcess.stdout?.on('data', (chunk) => process.stderr.write(chunk));
  await waitForCoreReady(90_000);

  const nextBin = path.join(ADMIN_ROOT, 'node_modules', '.bin', isWin ? 'next.cmd' : 'next');

  // `next dev` (plain http://localhost) — deliberately not a production build+start. This
  // environment has no real TLS locally, and the `Secure` cookie attribute is enforced by
  // the browser regardless of NODE_ENV: confirmed directly (not assumed) that a real
  // Chromium instance silently drops a Secure-flagged cookie set over plain http, even to
  // localhost. session.ts's own SESSION_COOKIE_OPTIONS therefore gates `secure` on
  // NODE_ENV==='production', the same convention NextAuth.js's own default cookie config
  // uses, on the assumption a real production deployment is always served over https. This
  // interactive E2E flow runs in dev mode (secure: false) so the session cookie actually
  // persists in the browser and the full sign-in can be proven end-to-end; the Secure-flag
  // *logic* itself (does it evaluate true under NODE_ENV=production) is proven separately,
  // below, by a non-network unit assertion — provable without standing up real TLS.
  serverProcess = spawn(nextBin, ['dev', '-p', String(PORT)], {
    cwd: ADMIN_ROOT,
    // Own distDir (see next.config.js's own comment) — Story 6.7's contract
    // also spawns a real `next dev` from this same project directory, and
    // Next's dev-server lock file is keyed by distDir, not port. Without
    // this, the two collide whenever Jest schedules them concurrently
    // (confirmed directly: intermittent "Another next dev server is
    // already running" under `npx jest contracts`, gone under
    // `--runInBand`, healed 2026-08-10 rather than papered over).
    env: { ...process.env, NEXT_DIST_DIR: '.next/test-story-6-1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin,
  });
  serverProcess.stderr?.on('data', (chunk) => process.stderr.write(chunk));
  serverProcess.stdout?.on('data', (chunk) => process.stderr.write(chunk));
  await waitForServerReady(90_000);

  // Warm up "/" specifically, not just "/sign-in" — Turbopack compiles each route
  // on-demand on its first hit, and that first hit can drop the connection
  // (ECONNRESET) rather than just being slow. Confirmed directly: AC2's own plain
  // fetch('/') failed this way when it ran as the very first request against "/".
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await fetch(`${BASE_URL}/`, { redirect: 'manual' });
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  browser = await chromium.launch({ headless: true });
}, 240_000);

afterAll(async () => {
  await browser?.close();
  if (coreProcess?.pid) {
    if (process.platform === 'win32') {
      try {
        execSync(`taskkill /PID ${coreProcess.pid} /T /F`);
      } catch {
        // already gone
      }
    } else {
      coreProcess.kill('SIGKILL');
    }
  }
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

/** Drives a real interactive sign-in through our own app, against the real Entra tenant. */
async function performRealSignIn(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/`);
  await page.waitForURL(`${BASE_URL}/sign-in`, { timeout: 15_000 });
  await page.getByRole('link', { name: 'Sign in with Microsoft' }).click();
  await page.waitForURL((u) => u.hostname.endsWith('ciamlogin.com'), { timeout: 20_000 });

  await page.getByPlaceholder('Email address').fill(TEST_EMAIL);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForSelector('input[name="passwd"]', { timeout: 15_000 });
  await page.fill('input[name="passwd"]', TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Consent (first run only) and/or "Stay signed in?" (KMSI, subsequent runs) — neither
  // is guaranteed to appear, so both are handled conditionally.
  await page.waitForTimeout(2000);
  const acceptBtn = page.getByRole('button', { name: 'Accept' });
  if ((await acceptBtn.count()) > 0) {
    await acceptBtn.click();
    await page.waitForTimeout(1000);
  }
  const noBtn = page.getByRole('button', { name: 'No' });
  if ((await noBtn.count()) > 0) {
    await noBtn.click();
  }

  await page.waitForURL(`${BASE_URL}/`, { timeout: 20_000 });
  return page;
}

describe('Story 6.1 — Next.js scaffold and Entra sign-in (server-side session)', () => {
  describe('AC1: real Next.js scaffold, Story 1.1 boundary undisturbed', () => {
    it('next/react are real dependencies and an app/-rooted structure exists', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ADMIN_ROOT, 'package.json'), 'utf8'));
      expect(pkg.dependencies.next).toBeDefined();
      expect(pkg.dependencies.react).toBeDefined();
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', 'app', 'layout.tsx'))).toBe(true);
    });

    it("Story 1.1's own REST-only-boundary contract still passes, unmodified", () => {
      expect(() =>
        execSync(
          'npx jest contracts/epic-1/story-1.1.rest-only-boundary.contract.test.ts --config jest.config.js',
          { cwd: ADMIN_ROOT, stdio: 'pipe' }
        )
      ).not.toThrow();
    });
  });

  describe('AC2: unauthenticated requests redirect to sign-in', () => {
    it('visiting "/" with no session cookie redirects (307/308) to /sign-in', async () => {
      const res = await fetchWithRetry(`${BASE_URL}/`, { redirect: 'manual' });
      expect([307, 308]).toContain(res.status);
      expect(res.headers.get('location')).toContain('/sign-in');
    });
  });

  describe('AC3/AC4: real Authorization Code + PKCE sign-in, exact-match redirect_uri', () => {
    let context: BrowserContext;

    afterAll(async () => {
      await context?.close();
    });

    it('a real, live sign-in against the real Entra tenant lands the caller back on "/" signed in', async () => {
      context = await browser!.newContext();
      const page = await performRealSignIn(context);
      expect(page.url()).toBe(`${BASE_URL}/`);
      const signedIn = await page.locator('[data-testid="signed-in-state"]').innerText();
      expect(signedIn).toContain('Signed in');
    });

    it('a mismatched redirect_uri is rejected by Entra itself, before any app code runs', async () => {
      // A fresh, isolated context — not the shared `context` above, which by this point
      // already carries real Entra SSO cookies from the previous test and would skip
      // straight past the email/password form entirely.
      const freshContext = await browser!.newContext();
      const page = await freshContext.newPage();
      const config = new URL(
        `https://${process.env.ENTRA_TENANT_SUBDOMAIN}.ciamlogin.com/${process.env.ENTRA_TENANT_ID}/oauth2/v2.0/authorize`
      );
      config.searchParams.set('client_id', process.env.ENTRA_ADMIN_CLIENT_ID as string);
      config.searchParams.set('response_type', 'code');
      config.searchParams.set('redirect_uri', 'http://localhost:9999/not-registered');
      config.searchParams.set('scope', 'openid profile email offline_access');
      config.searchParams.set('response_mode', 'query');
      config.searchParams.set('state', 'contract-test-mismatched-redirect');

      await page.goto(config.toString(), { waitUntil: 'networkidle', timeout: 30_000 });
      await page.getByPlaceholder('Email address').fill(TEST_EMAIL);
      await page.getByRole('button', { name: 'Next' }).click();
      await page.waitForSelector('input[name="passwd"]', { timeout: 15_000 });
      await page.fill('input[name="passwd"]', TEST_PASSWORD);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForTimeout(3000);

      // Entra only actually validates redirect_uri once it has a caller to redirect —
      // consent/KMSI can both still appear first, depending on this test user's prior
      // consent state.
      const acceptBtn = page.getByRole('button', { name: 'Accept' });
      if ((await acceptBtn.count()) > 0) {
        await acceptBtn.click();
        await page.waitForTimeout(1000);
      }
      const noBtn = page.getByRole('button', { name: 'No' });
      if ((await noBtn.count()) > 0) {
        await noBtn.click();
        await page.waitForTimeout(1000);
      }

      const body = await page.locator('body').innerText();
      expect(body).toContain('AADSTS50011');
      await freshContext.close();
    });
  });

  describe('AC5: session cookie encryption key has real entropy and is never committed', () => {
    it('SESSION_SECRET decodes to at least 256 bits (32 bytes)', () => {
      const key = Buffer.from(process.env.SESSION_SECRET as string, 'base64');
      expect(key.length).toBeGreaterThanOrEqual(32);
    });

    it('.env (the file actually carrying the real key) is not tracked in git', () => {
      const tracked = execSync('git ls-files -- social-listening-admin/.env', {
        cwd: REPO_ROOT,
      })
        .toString()
        .trim();
      expect(tracked).toBe('');
    });

    it('.gitignore actually covers social-listening-admin/.env', () => {
      expect(() =>
        execSync('git check-ignore social-listening-admin/.env', { cwd: REPO_ROOT })
      ).not.toThrow();
    });
  });

  describe('AC6: tokens live only in an encrypted httpOnly/Secure/SameSite=Lax cookie', () => {
    let context: BrowserContext;

    afterAll(async () => {
      await context?.close();
    });

    it('SESSION_COOKIE_OPTIONS.secure evaluates true under NODE_ENV=production (unit-level: no real TLS available locally to prove this end-to-end over the wire)', async () => {
      const env = process.env as Record<string, string | undefined>;
      const originalEnv = env.NODE_ENV;
      try {
        jest.resetModules();
        env.NODE_ENV = 'production';
        const prod = await import('../../src/lib/session');
        expect(prod.SESSION_COOKIE_OPTIONS.secure).toBe(true);

        jest.resetModules();
        env.NODE_ENV = 'development';
        const dev = await import('../../src/lib/session');
        expect(dev.SESSION_COOKIE_OPTIONS.secure).toBe(false);
      } finally {
        env.NODE_ENV = originalEnv;
        jest.resetModules();
      }
    });

    it('the session cookie is a small encrypted reference (not the raw tokens), flagged httpOnly/SameSite=Lax, and is unreadable from page JS', async () => {
      context = await browser!.newContext();
      await performRealSignIn(context);

      const cookies = await context.cookies();
      const sessionCookie = cookies.find((c) => c.name === SESSION_COOKIE_NAME);
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie!.httpOnly).toBe(true);
      // Not asserting `secure` here — this flow deliberately runs over plain
      // http://localhost (see beforeAll's own note); a Secure-flagged cookie would be
      // silently dropped by the browser and never reach this assertion at all. The
      // Secure-flag logic itself is proven by the unit-level test directly above.
      expect(sessionCookie!.sameSite).toBe('Lax');

      // The cookie is a small encrypted { sid } reference (session.ts's own reference/
      // session-ID pattern), not the raw tokens — Entra's real id_token/access_token/
      // refresh_token together run into the thousands of characters (confirmed directly
      // while diagnosing why the original all-tokens-in-the-cookie design never actually
      // reached the browser), so a cookie this short is itself evidence the tokens live
      // server-side, not in what the browser holds.
      expect(sessionCookie!.value.length).toBeLessThan(500);

      // Not decrypted here: session.ts's own server-side session store (this file's own
      // header comment explains why it exists) lives in the separate `next dev` process
      // this beforeAll spawned, not in this test process — decryptSession() here would
      // correctly, but unhelpfully, return null. AC7's unit-level test proves
      // authenticatedCoreFetch() actually resolves a real access token from a session it
      // creates in-process; this test's own job is the cookie's own shape and flags.

      // Unreadable from the page's own JavaScript (the httpOnly property, exercised for
      // real inside an actual browser, not just asserted from the cookie jar API).
      const page = context.pages()[0];
      const jsVisibleCookie = await page.evaluate(() => document.cookie);
      expect(jsVisibleCookie).not.toContain(SESSION_COOKIE_NAME);

      // The rendered page's own HTML never contains the session cookie's own value, or
      // anything JWT-shaped (a real token always starts with the "eyJ" base64url prefix
      // of its JSON header).
      const html = await page.content();
      expect(html).not.toContain(sessionCookie!.value);
      expect(html).not.toContain('eyJ');
    });
  });

  describe('AC7: core-client.ts is the sole Bearer-attachment choke point', () => {
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

    it('authenticatedCoreFetch() attaches Authorization: Bearer <token> sourced from the session', async () => {
      let fetchSpy: jest.SpyInstance | undefined;
      try {
        jest.resetModules();
        // Imported fresh, after resetModules — core-client.ts's own internal `./session`
        // import resolves to this exact same module instance (same absolute path, same
        // reset generation), so the session created here is the one its own
        // decryptSession() call will actually find. Using the top-of-file import instead
        // would silently create the session in a different, discarded module instance.
        const sessionModule = await import('../../src/lib/session');
        const encrypted = await sessionModule.encryptSession({
          idToken: 'fake-id-token',
          accessToken: 'contract-test-access-token',
          identity: null,
        });

        jest.doMock('next/headers', () => ({
          cookies: async () => ({
            get: (name: string) =>
              name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined,
          }),
        }));

        fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

        const { authenticatedCoreFetch } = await import('../../src/lib/core-client');
        await authenticatedCoreFetch('/v1/me');

        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/me'),
          expect.objectContaining({
            headers: expect.objectContaining({ Authorization: 'Bearer contract-test-access-token' }),
          })
        );
      } finally {
        fetchSpy?.mockRestore();
        jest.dontMock('next/headers');
        jest.resetModules();
      }
    });
  });

  describe('AC8: attempts GET /v1/me after sign-in; a currently-missing endpoint degrades gracefully', () => {
    it("core's callback route calls fetchResolvedIdentity()", () => {
      const content = fs.readFileSync(
        path.join(ADMIN_ROOT, 'src', 'app', 'api', 'auth', 'callback', 'route.ts'),
        'utf8'
      );
      expect(content).toMatch(/fetchResolvedIdentity/);
    });

    it('fetchResolvedIdentity() resolves to null rather than throwing on a bad/unreachable call', async () => {
      // Real call against whatever CORE_API_BASE_URL is configured — resolves null
      // whether core is unreachable (connection refused) or reachable but rejects the
      // garbage token (401, once GET /v1/me — now built, Story 5.11 — runs a real
      // signature/audience check). Healed 2026-08-10: this test's own comment previously
      // said "GET /v1/me does not exist yet"; that prerequisite is done, but the
      // assertion itself was already correct for a bad token either way, so it is
      // unchanged — only the stale rationale is corrected.
      await expect(fetchResolvedIdentity('contract-test-token')).resolves.toBeNull();
    });
  });

  describe('AC10: a malformed/unresolvable session cookie redirects to /sign-in', () => {
    it('a malformed session cookie is treated as signed out and redirects to /sign-in', async () => {
      // Also stands in for "a cookie referencing a session id the server-side store has
      // no record of" (an expired-and-pruned or otherwise unresolvable sid) — proxy.ts
      // takes the identical branch (decryptSession() returns null → redirect) for both,
      // per session.ts's own "one outcome regardless of cause" convention.
      const res = await fetchWithRetry(`${BASE_URL}/`, {
        redirect: 'manual',
        headers: { Cookie: `${SESSION_COOKIE_NAME}=not-a-real-session-token` },
      });
      expect([307, 308]).toContain(res.status);
    });
  });

  describe('AC11: 8-hour absolute session ceiling', () => {
    // In-process, not through the running dev server: session.ts's server-side session
    // store (this file's own header comment explains why it exists — the tokens don't
    // fit in a cookie) is per-process. Minting a session via encryptSession() from this
    // test process would populate a Map the separate `next dev` child process can never
    // see, so the ceiling's own math is proven directly against the real
    // encryptSession()/decryptSession() functions here — precise and fast. That proxy.ts
    // actually redirects when decryptSession() returns null is already proven for real,
    // over HTTP, by AC10 above and AC2/AC3 (the identical branch, not a separate one).
    it('a session just inside the 8-hour ceiling is still accepted', async () => {
      const issuedAt = Math.floor(Date.now() / 1000) - (8 * 60 * 60 - 60);
      const cookie = await encryptSession(
        { idToken: 'x', accessToken: 'y', identity: null },
        issuedAt
      );
      await expect(decryptSession(cookie)).resolves.not.toBeNull();
    });

    it('a session just past the 8-hour ceiling is rejected, no silent renewal', async () => {
      const issuedAt = Math.floor(Date.now() / 1000) - (8 * 60 * 60 + 60);
      const cookie = await encryptSession(
        { idToken: 'x', accessToken: 'y', identity: null },
        issuedAt
      );
      await expect(decryptSession(cookie)).resolves.toBeNull();
    });
  });

  describe('AC12: signing out clears the session server-side', () => {
    let context: BrowserContext;

    afterAll(async () => {
      await context?.close();
    });

    it('signing out redirects to /signed-out, clears the cookie, and the same browser can no longer reach "/"', async () => {
      context = await browser!.newContext();
      const page = await performRealSignIn(context);

      await page.goto(`${BASE_URL}/api/auth/signout`);
      await page.waitForURL(`${BASE_URL}/signed-out`, { timeout: 10_000 });

      const cookies = await context.cookies();
      const sessionCookie = cookies.find((c) => c.name === SESSION_COOKIE_NAME);
      expect(sessionCookie).toBeUndefined();

      await page.goto(`${BASE_URL}/`);
      await page.waitForURL(`${BASE_URL}/sign-in`, { timeout: 10_000 });
    });
  });

  /**
   * Healed 2026-08-10 — see this file's own header healing note. Guards the exact
   * regression found live: ENTRA_SCOPES silently reverting to only the bare OIDC scopes
   * would once again mint a token core's own jwtVerify() rejects at the signature step
   * for every authenticated call, not just GET /v1/me.
   */
  describe('AC13: ENTRA_SCOPES requests a resource-scoped token for social-listening-core, not just bare OIDC scopes', () => {
    // Read from source rather than a live import: entra.ts pulls in `openid-client`
    // (ESM-only, `oauth4webapi` underneath) which Jest's default CJS transform can't
    // load standalone — AC1-AC12 above only ever exercise it indirectly, through the
    // real `next dev` process. AC8's own "callback route calls fetchResolvedIdentity()"
    // test already establishes this same source-inspection pattern for the same reason.
    it('includes the delegated api://social-listening-core/access_as_user scope', () => {
      const content = fs.readFileSync(path.join(ADMIN_ROOT, 'src', 'lib', 'entra.ts'), 'utf8');
      const match = content.match(/ENTRA_SCOPES\s*=\s*\n?\s*'([^']+)'/);
      expect(match).not.toBeNull();
      const scopes = (match![1] as string).split(' ');
      expect(scopes).toContain('api://social-listening-core/access_as_user');
      expect(scopes).toContain('openid');
    });
  });
});
