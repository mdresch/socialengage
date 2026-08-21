/**
 * Contract: Story 6.2 (ADR-0035/ADR-0036) — Role-gated routing shell
 * Intent: Implement a server-side role-aware routing shell for social-listening-admin
 * so that tenant-facing routes are isolated from Platform-Admin routes and the UI
 * only renders actions allowed for the resolved identity.
 *
 * Scope: social-listening-admin/src/lib/role-routing.ts,
 * social-listening-admin/src/app/(tenant)/..., social-listening-admin/src/app/platform-admin/..., and
 * the supporting component SKILL.md.
 *
 * Explicitly out of scope: the real backend 403 behavior for tenant-admin-only actions;
 * those remain enforced server-side by social-listening-core.
 *
 * --- Healing pass, 2026-08-06 (heal-contract-failure, Menno's explicit sign-off for this
 * exact session) ---
 * Real, live defect found via the Ideal Manager's own review and confirmed by direct code
 * reading: this contract's original three unit tests hand-constructed a flat `{role:
 * 'platform_admin'}` object that does not match `ResolvedIdentity`'s real, discriminated-
 * union shape (social-listening-core/src/identity/identityResolution.ts — a real
 * platform_admin identity is `{type:'platform_admin', adminId}`, no `role` field at all).
 * getRoleShell() switched on `identity.role`, so a real Platform Admin session's
 * `role` was always `undefined` and silently fell through to the tenant shell — AC2's own
 * "a platform_admin identity requesting any tenant-facing route is redirected/rejected...
 * proven directly" was never actually true. Worse: `/tenant` and `/platform-admin`
 * themselves had ZERO server-side gating at all (no redirect, no identity check —
 * `tenant/page.tsx` even hardcoded `getTenantShellActions({role: 'tenant_admin'})` as a
 * fixture) — AC2 was never fully implemented, only the home page's own link-display logic
 * was. This was invisible because the original contract only unit-tested the pure helper
 * functions in isolation and checked the two route directories exist via `fs.existsSync` —
 * it never proved, as AC2's own text explicitly demands, that "a test session of each type
 * attempting the other tree's route" is actually redirected/rejected. The tests below
 * replace the three original hand-constructed-shape unit tests with the real
 * `ResolvedIdentity` union, and add real route-guard coverage using the same
 * `next/headers`-mocking pattern Story 6.1's own AC7 test already established (a real
 * `encryptSession()`-minted session, decrypted for real, no shape assumed).
 *
 * --- Healing pass, 2026-08-12 (heal-contract-failure, Menno's explicit sign-off for this
 * exact behavior change) ---
 * Real, live defect found via manual testing: a real Entra sign-in with no matching
 * `users`/`platform_admins` row anywhere in social-listening-core (a genuinely orphaned/
 * unlinked identity — resolveIdentity() returns null, so the session's own `identity`
 * field never validates) still rendered the full tenant shell (/tenant/connectors and
 * friends), because `getRoleShell(null)` defaulted to `'tenant'`. That default was not an
 * oversight — the previous version of this file asserted it directly, framed as "unresolved/
 * unhydrated session." That framing doesn't hold: every page here computes `identity`
 * synchronously, once per request, straight from the decrypted session cookie (no
 * client-side hydration step exists in this architecture) — `null` means "nothing
 * resolvable was ever stored for this session," permanently for that request, not
 * "still loading." Per ADR-0036 §4 this was never a security incident (core's own
 * RLS/auth boundary held throughout — the null-identity session only ever saw a shell
 * with defaulted/degraded data, never real tenant content), but it is a real violation of
 * Story 6.2's own intent ("the admin UI renders only the screens my resolved identity is
 * actually allowed to see"). Fixed: `getRoleShell()` now returns `null` for a `null`
 * identity (a third, explicit "no shell" state, distinct from either real shell);
 * `isShellAllowed()` needed no code change since `null === 'tenant'`/`'platform-admin'`
 * is already false. `src/app/tenant/page.tsx` and `src/app/platform-admin/page.tsx`
 * needed no change either — their existing `isShellAllowed()` + `redirect('/')` guard
 * already rejects a `null` shell correctly. `src/app/page.tsx` (home) did need a real
 * fix — its own render branch keyed only on the `session` boolean, not on `shell`, so a
 * signed-in-but-unresolved session still hit the "Tenant shell" JSX; it now redirects
 * that case to `/sign-in`, the same target the coarse-grained Middleware already sends a
 * fully unauthenticated caller to.
 */

import fs from 'fs';
import path from 'path';
import {
  getRoleShell,
  getTenantShellActions,
  isResolvedIdentity,
  isShellAllowed,
  type ResolvedIdentity,
} from '../../src/lib/role-routing';

const TENANT_USER: ResolvedIdentity = { type: 'tenant_user', tenantId: 't-1', userId: 'u-1', role: 'tenant_user' };
const TENANT_ADMIN: ResolvedIdentity = { type: 'tenant_user', tenantId: 't-1', userId: 'u-2', role: 'tenant_admin' };
const PLATFORM_ADMIN: ResolvedIdentity = { type: 'platform_admin', adminId: 'a-1' };

describe('Story 6.2 — role-gated routing shell', () => {
  it('routes tenant_admin and tenant_user identities to the tenant-facing shell', () => {
    expect(getRoleShell(TENANT_ADMIN)).toBe('tenant');
    expect(getRoleShell(TENANT_USER)).toBe('tenant');
  });

  it('routes a real platform_admin identity (no role field) to the platform-admin shell', () => {
    expect(getRoleShell(PLATFORM_ADMIN)).toBe('platform-admin');
  });

  /**
   * Healed 2026-08-12 — this used to assert `getRoleShell(null)` returns `'tenant'`,
   * framed as "unresolved/unhydrated session." That was the bug: there is no hydration
   * step in this architecture (identity is computed synchronously, server-side, once per
   * request), so `null` here means a genuinely, permanently unresolved caller — one with
   * no matching `users`/`platform_admins` row at all — not a transient loading state.
   * Menno's explicit sign-off for this exact reversal; see docs/implementation-log.md.
   */
  it('a null identity (genuinely unresolved — no matching users/platform_admins row) gets no shell at all', () => {
    expect(getRoleShell(null)).toBeNull();
  });

  it('renders tenant-admin-only actions only for tenant_admin sessions', () => {
    expect(getTenantShellActions(TENANT_ADMIN)).toContain('Tenant-wide connect');
    expect(getTenantShellActions(TENANT_USER)).not.toContain('Tenant-wide connect');
    expect(getTenantShellActions(PLATFORM_ADMIN)).not.toContain('Tenant-wide connect');
  });

  it('creates the two separate route trees expected by the story', () => {
    const adminRoot = path.resolve(__dirname, '..', '..');
    expect(fs.existsSync(path.join(adminRoot, 'src', 'app', 'tenant'))).toBe(true);
    expect(fs.existsSync(path.join(adminRoot, 'src', 'app', 'platform-admin'))).toBe(true);
  });

  describe('isResolvedIdentity() — validates the real discriminated shape at the session boundary', () => {
    it('accepts both real ResolvedIdentity shapes', () => {
      expect(isResolvedIdentity(TENANT_USER)).toBe(true);
      expect(isResolvedIdentity(PLATFORM_ADMIN)).toBe(true);
    });

    it('rejects the flat {role} shape this healing pass removed, null, and garbage', () => {
      expect(isResolvedIdentity({ role: 'platform_admin' })).toBe(false);
      expect(isResolvedIdentity(null)).toBe(false);
      expect(isResolvedIdentity(undefined)).toBe(false);
      expect(isResolvedIdentity('not an object')).toBe(false);
      expect(isResolvedIdentity({ type: 'platform_admin' })).toBe(false); // missing adminId
    });
  });

  describe('isShellAllowed() — the actual AC2 gating decision', () => {
    it('a platform_admin identity is allowed only the platform-admin shell', () => {
      expect(isShellAllowed(PLATFORM_ADMIN, 'platform-admin')).toBe(true);
      expect(isShellAllowed(PLATFORM_ADMIN, 'tenant')).toBe(false);
    });

    it('a tenant_user/tenant_admin identity is allowed only the tenant shell', () => {
      expect(isShellAllowed(TENANT_USER, 'tenant')).toBe(true);
      expect(isShellAllowed(TENANT_USER, 'platform-admin')).toBe(false);
      expect(isShellAllowed(TENANT_ADMIN, 'tenant')).toBe(true);
    });

    it('healed 2026-08-12: a null identity is allowed neither shell', () => {
      expect(isShellAllowed(null, 'tenant')).toBe(false);
      expect(isShellAllowed(null, 'platform-admin')).toBe(false);
    });
  });

  /**
   * AC2's own text: "proven directly (a test session of each type attempting the other
   * tree's route), not just by the absence of a visible link." These tests import and
   * call the real page components — no mock of role-routing.ts itself — with a real
   * encrypted session (Story 6.1's own encryptSession()/decryptSession()), mocking only
   * next/headers' cookies() (the exact pattern Story 6.1's AC7 test already established)
   * and next/navigation's redirect() (so the assertion doesn't depend on Next's own
   * render pipeline catching the throw).
   */
  describe('AC2 route-tree enforcement: a real session of each type attempting the other tree route', () => {
    afterEach(() => {
      jest.dontMock('next/headers');
      jest.dontMock('next/navigation');
      jest.resetModules();
    });

    async function renderPageWithIdentity(pagePath: string, identity: ResolvedIdentity | null) {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({
        idToken: 'x',
        accessToken: 'y',
        identity,
      });

      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) =>
            name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined,
        }),
      }));

      const redirectMock = jest.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`);
      });
      jest.doMock('next/navigation', () => ({ redirect: redirectMock }));

      const { default: Page } = await import(pagePath);
      return { Page, redirectMock };
    }

    it('a platform_admin session requesting /tenant is redirected, not rendered', async () => {
      const { Page, redirectMock } = await renderPageWithIdentity('../../src/app/tenant/page', PLATFORM_ADMIN);
      await expect(Page()).rejects.toThrow('NEXT_REDIRECT:/');
      expect(redirectMock).toHaveBeenCalledWith('/');
    });

    it('a tenant_user session requesting /platform-admin is redirected, not rendered', async () => {
      const { Page, redirectMock } = await renderPageWithIdentity(
        '../../src/app/platform-admin/page',
        TENANT_USER
      );
      await expect(Page()).rejects.toThrow('NEXT_REDIRECT:/');
      expect(redirectMock).toHaveBeenCalledWith('/');
    });

    it('a tenant_user session requesting /tenant renders (not redirected), with real (not fixture) role-based actions', async () => {
      const { Page, redirectMock } = await renderPageWithIdentity('../../src/app/tenant/page', TENANT_USER);
      const element = await Page();
      expect(redirectMock).not.toHaveBeenCalled();
      const rendered = JSON.stringify(element);
      expect(rendered).not.toContain('Tenant-wide connect');
    });

    it('a tenant_admin session requesting /tenant renders the tenant-admin-only action for real (not the old hardcoded tenant_admin fixture)', async () => {
      const { Page, redirectMock } = await renderPageWithIdentity('../../src/app/tenant/page', TENANT_ADMIN);
      const element = await Page();
      expect(redirectMock).not.toHaveBeenCalled();
      expect(JSON.stringify(element)).toContain('Tenant-wide connect');
    });

    it('a platform_admin session requesting /platform-admin renders (not redirected)', async () => {
      const { Page, redirectMock } = await renderPageWithIdentity(
        '../../src/app/platform-admin/page',
        PLATFORM_ADMIN
      );
      await Page();
      expect(redirectMock).not.toHaveBeenCalled();
    });

    /**
     * Healed 2026-08-10 (Menno's explicit request) — a real, confirmed gap:
     * a successful platform_admin sign-in landed on `/` showing only a
     * manual "Open Platform Admin" link, never an automatic forward. No
     * prior contract asserted this either way. A tenant identity's own
     * root-page experience is deliberately untouched — narrowly scoped to
     * exactly what was asked.
     */
    it('a platform_admin session requesting / is forwarded straight to /platform-admin, not shown a manual link', async () => {
      const { Page, redirectMock } = await renderPageWithIdentity('../../src/app/page', PLATFORM_ADMIN);
      await expect(Page()).rejects.toThrow('NEXT_REDIRECT:/platform-admin');
      expect(redirectMock).toHaveBeenCalledWith('/platform-admin');
    });

    it('a tenant_admin session requesting / still renders the tenant shell, not redirected — this healing pass leaves tenant root behavior untouched', async () => {
      const { Page, redirectMock } = await renderPageWithIdentity('../../src/app/page', TENANT_ADMIN);
      const element = await Page();
      expect(redirectMock).not.toHaveBeenCalled();
      expect(JSON.stringify(element)).toContain('Tenant shell');
    });

    /**
     * Healed 2026-08-12 — reproduces the exact live defect: a real session (a real Entra
     * sign-in) whose `identity` is `null` (no matching users/platform_admins row) must be
     * rejected, not rendered. Before this pass, all three of these rendered their
     * respective shell's real content instead of redirecting.
     */
    it('a null identity (real session, unresolved) requesting /tenant is redirected, not rendered', async () => {
      const { Page, redirectMock } = await renderPageWithIdentity('../../src/app/tenant/page', null);
      await expect(Page()).rejects.toThrow('NEXT_REDIRECT:/');
      expect(redirectMock).toHaveBeenCalledWith('/');
    });

    it('a null identity (real session, unresolved) requesting /platform-admin is redirected, not rendered', async () => {
      const { Page, redirectMock } = await renderPageWithIdentity('../../src/app/platform-admin/page', null);
      await expect(Page()).rejects.toThrow('NEXT_REDIRECT:/');
      expect(redirectMock).toHaveBeenCalledWith('/');
    });

    it('a null identity (real session, unresolved) requesting / is sent to /sign-in, never shown "Tenant shell" content', async () => {
      const { Page, redirectMock } = await renderPageWithIdentity('../../src/app/page', null);
      await expect(Page()).rejects.toThrow('NEXT_REDIRECT:/sign-in');
      expect(redirectMock).toHaveBeenCalledWith('/sign-in');
    });

    it('tenant overview dashboard source includes Facebook Page platform (ADR-0059/0067)', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const source = fs.readFileSync(path.resolve(__dirname, '../../src/app/tenant/page.tsx'), 'utf8');
      expect(source).toContain("name: 'Facebook Page'");
      expect(source).toContain("Active Connectors");
    });
  });
});
