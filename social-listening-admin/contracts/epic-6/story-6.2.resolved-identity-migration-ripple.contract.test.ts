/**
 * Contract: Story 6.2 (ADR-0035/ADR-0036) healing pass, 2026-08-06 — ResolvedIdentity
 * migration ripple into Stories 6.3/6.4/6.5's own already-shipped screens.
 *
 * Intent: this file is a companion to
 * contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts's own 2026-08-06
 * healing-pass note. Fixing role-routing.ts's real, live defect (getRoleShell()/
 * getTenantShellActions() switching on a flat `{role}` shape that doesn't match
 * ResolvedIdentity's real discriminated union — see that file's own Intent block for the
 * full root-cause account) changed getTenantShellActions()'s own parameter type. That
 * type change broke `npx tsc --noEmit` for three files this healing pass does not
 * otherwise touch: src/app/tenant/connectors/page.tsx (Story 6.3),
 * src/app/tenant/watchlists/page.tsx (Story 6.4), and
 * src/app/tenant/connectors/status/page.tsx (Story 6.5) — each called
 * getTenantShellActions({role: '...'}) as a hardcoded fixture (none of the three read a
 * real session yet; a separate, already-documented gap, not addressed here).
 *
 * Per heal-contract-failure's own convention, a previously-passing contract is presumed
 * correct and the burden is on the new change — but Stories 6.3/6.4/6.5's own contracts
 * (story-6.3/6.4/6.5...contract.test.ts) never actually exercised this code path at all:
 * each is a pure fs.readFileSync + string-contains check against source text, never an
 * import/render of the real component or the real getTenantShellActions() call. The
 * three call sites were fixed to the minimal shape-only change (same fixture role,
 * unchanged visible behavior — see each file's own inline comment), but that fix was
 * until now unverified by any real contract, only by a compile-time typecheck. This file
 * closes that real, pre-existing coverage gap directly, rather than editing Stories
 * 6.3/6.4/6.5's own contract files (a different story's presumed-correct contract is not
 * this healing pass's to rewrite) or leaving the fix unverified at runtime.
 *
 * Scope: src/app/tenant/connectors/page.tsx, src/app/tenant/watchlists/page.tsx,
 * src/app/tenant/connectors/status/page.tsx — proving each still renders its own
 * fixture actions/content correctly (a real behavioral regression check, not just a
 * type check) under the new ResolvedIdentity-shaped call.
 *
 * Explicitly out of scope: wiring these three screens to a real session/backend (a
 * separate, already-named gap — see role-routing-shell/SKILL.md and the Learning &
 * Development Writer's 2026-08-06 manual catch-up pass) — this contract only proves the
 * type migration didn't silently change what's rendered.
 *
 * Healing pass, 2026-08-12 (cross-component regression surfaced mid Story 6.4's own real
 * rework, healed via heal-contract-failure): Story 6.4's own AC list (revised 2026-08-12,
 * ADR-0044-aware) required exactly the "wiring this screen to a real session/backend"
 * change this file's own text above named as a separate, not-yet-done gap — the same
 * fixture-to-real migration Story 6.3's own block below already underwent on 2026-08-10.
 * `WatchlistsPage` is no longer a synchronous, fixture-identity component — it's a real
 * async Server Component reading a real session and calling listWatchlists()/
 * getConnectorStatus(). The old "Story 6.4" test called `WatchlistsPage()` synchronously
 * with no session mock at all and asserted on the retired 'Breaking news'/'PR mentions'
 * fixture text; once the real page started calling cookies() for real, that unmocked call
 * threw Next.js's own "cookies called outside a request scope" error. Root-caused directly
 * (not assumed): stashed the Story 6.4 changes, reran this suite on the clean baseline —
 * passed 23/23; restored the changes — failed with exactly that error, confirming the
 * direct link before any fix was applied. Upgraded in place, not dropped, to the identical
 * real-session-plus-real-fetch-mocking pattern the Story 6.3 block already established
 * below — this file's own documented, once-already-used precedent for this exact category
 * of change, not a new decision. Story 6.4's own dedicated contract
 * (story-6.4.watchlist-management-screen.contract.test.ts) is untouched by this healing
 * pass — it already independently covers the real behavior in full; this file's only job
 * is proving the shared ResolvedIdentity-shaped call still works for this page too.
 *
 * Upgrade, 2026-08-12, later the same day — Story 6.5's own "ConnectorStatusPage" block
 * upgraded proactively, ahead of a failing run, during Story 6.5's own real rework
 * (identical category of ripple to the one just fixed above for Story 6.4 — the same
 * synchronous-fixture-to-real-async-Server-Component migration).
 *
 * Healing pass, 2026-08-17 (Menno's explicit sign-off, same session as
 * Story 8.1): `tenant/connectors/page.tsx` and
 * `tenant/connectors/status/page.tsx` were each split into a thin Server
 * Component + a new Client Component (`ConnectorsClient.tsx`/
 * `ConnectorStatusClient.tsx`) — the rendered heading text
 * ("Connect a platform" / "Connector status") this file's Story 6.3/6.5
 * blocks checked via `JSON.stringify(await Page())` now lives inside those
 * Client Components, invisible to that technique (a Client Component
 * element is inert props data until something actually renders it —
 * proven independently while building Story 8.1). The old `allowTenantWide`
 * prop this file's Story 6.3 block also checked no longer exists at all —
 * `ConnectorsClient` takes `isTenantAdmin` directly instead. Each affected
 * test below still proves the real data flow via `JSON.stringify` (which
 * props/platforms/state reached the Client Component, real session/role
 * gating, real fetch calls) and adds a real `renderToStaticMarkup` render
 * of the actual Client Component for the rendered-text assertion, the same
 * split Story 6.15's own healing pass this same session already
 * established.
 */

import { getTenantShellActions, type ResolvedIdentity } from '../../src/lib/role-routing';

function renderComponent(componentPath: string, exportName: string, props: Record<string, unknown>): string {
  const ReactLocal = require('react');
  const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
  const Component = require(componentPath)[exportName];
  return renderLocal(ReactLocal.createElement(Component, props));
}

const TENANT_USER: ResolvedIdentity = { type: 'tenant_user', tenantId: 't-1', userId: 'u-1', role: 'tenant_user' };
const TENANT_ADMIN: ResolvedIdentity = { type: 'tenant_user', tenantId: 't-1', userId: 'u-2', role: 'tenant_admin' };
const PLATFORM_ADMIN: ResolvedIdentity = { type: 'platform_admin', adminId: 'a-1' };

describe('Story 6.2 healing pass — ResolvedIdentity migration ripple into Stories 6.3/6.4/6.5', () => {
  it('the real ResolvedIdentity-shaped fixture used by connectors/status/page.tsx (tenant_admin) still yields the tenant-admin-only action', () => {
    const actions = getTenantShellActions({
      type: 'tenant_user',
      tenantId: 'fixture-tenant',
      userId: 'fixture-user',
      role: 'tenant_admin',
    });
    expect(actions).toContain('Tenant-wide connect');
  });

  it('the real ResolvedIdentity-shaped fixture used by watchlists/page.tsx (tenant_user) still omits the tenant-admin-only action', () => {
    const actions = getTenantShellActions({
      type: 'tenant_user',
      tenantId: 'fixture-tenant',
      userId: 'fixture-user',
      role: 'tenant_user',
    });
    expect(actions).not.toContain('Tenant-wide connect');
  });

  /**
   * Story 6.3 (upgraded 2026-08-10, Menno's explicit direction) — ConnectorsPage
   * is no longer a synchronous, fixture-identity component (Story 6.3's own
   * healing pass replaced that with a real async Server Component reading a
   * real session and calling the real backend). The old version of this test
   * called `ConnectorsPage()` synchronously with no session at all — that
   * execution model no longer exists. Upgraded, not dropped: this now uses the
   * same real-session-plus-real-fetch-mocking rigor the main Story 6.2
   * contract (`story-6.2.role-gated-routing-shell...`) already established
   * for `tenant/page.tsx`/`platform-admin/page.tsx`, proving all three real
   * roles against the real page — Platform Admin (redirected, AC2), Tenant
   * Admin (tenant-wide connect option offered), Tenant User (not offered).
   */
  describe('Story 6.3 — ConnectorsPage under all three real roles (Platform Admin, Tenant Admin, Tenant User)', () => {
    afterEach(() => {
      jest.dontMock('next/headers');
      jest.dontMock('next/navigation');
      jest.resetModules();
      jest.restoreAllMocks();
    });

    async function renderConnectorsPageAs(identity: ResolvedIdentity | null) {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity });

      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));

      const redirectMock = jest.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`);
      });
      jest.doMock('next/navigation', () => ({ redirect: redirectMock }));

      // Every real platform in PLATFORMS is 'not connected' for this
      // fixture — sufficient to prove role-gated rendering; connection-
      // state-specific behavior is Story 6.3's own contract's concern, not
      // this ripple test's.
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          new Response(
            JSON.stringify({ status: 'disconnected', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null }),
            { status: 200 }
          )
        );

      const { default: Page } = await import('../../src/app/tenant/connectors/page');
      return { Page, redirectMock };
    }

    it('a platform_admin session requesting /tenant/connectors is redirected, not rendered', async () => {
      const { Page, redirectMock } = await renderConnectorsPageAs(PLATFORM_ADMIN);
      await expect(Page()).rejects.toThrow('NEXT_REDIRECT:/');
      expect(redirectMock).toHaveBeenCalledWith('/');
    });

    it('a tenant_admin session renders with the tenant-wide connect option offered', async () => {
      const { Page, redirectMock } = await renderConnectorsPageAs(TENANT_ADMIN);
      const element = await Page();
      expect(redirectMock).not.toHaveBeenCalled();
      const rendered = JSON.stringify(element);
      expect(rendered).toContain('GNews');
      expect(rendered).toContain('Newswire');
      expect(rendered).toContain('"isTenantAdmin":true');

      const clientProps = element.props.children.props;
      const html = renderComponent('../../src/app/tenant/connectors/ConnectorsClient', 'ConnectorsClient', clientProps);
      expect(html).toContain('Connect a Platform');
    });

    it('a tenant_user session renders without the tenant-wide connect option', async () => {
      const { Page, redirectMock } = await renderConnectorsPageAs(TENANT_USER);
      const element = await Page();
      expect(redirectMock).not.toHaveBeenCalled();
      const rendered = JSON.stringify(element);
      expect(rendered).toContain('"isTenantAdmin":false');

      const clientProps = element.props.children.props;
      const html = renderComponent('../../src/app/tenant/connectors/ConnectorsClient', 'ConnectorsClient', clientProps);
      expect(html).toContain('Connect a Platform');
      // isTenantAdmin: false — the Scope selector (which offers the
      // tenant-wide option) never renders for this session.
      expect(html).not.toContain('Scope</label>');
    });
  });

  /**
   * Story 6.4 (upgraded 2026-08-12, Menno's explicit direction to proceed to
   * implementation) — WatchlistsPage is no longer a synchronous, fixture-
   * identity component (Story 6.4's own real rework replaced that with a
   * real async Server Component reading a real session and calling real
   * listWatchlists()/getConnectorStatus() backend endpoints). Same treatment
   * as the Story 6.3 upgrade directly above: real-session-plus-real-fetch-
   * mocking rigor, proving all three real roles against the real page.
   */
  describe('Story 6.4 — WatchlistsPage under all three real roles (Platform Admin, Tenant Admin, Tenant User)', () => {
    afterEach(() => {
      jest.dontMock('next/headers');
      jest.dontMock('next/navigation');
      jest.resetModules();
      jest.restoreAllMocks();
    });

    async function renderWatchlistsPageAs(identity: ResolvedIdentity | null) {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity });

      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));

      const redirectMock = jest.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`);
      });
      jest.doMock('next/navigation', () => ({ redirect: redirectMock }));

      // GET /v1/watchlists (empty list) and GET /v1/connectors/gnews
      // (disconnected) both need distinct response shapes — routed by URL.
      // newswire is authMode: 'none' and never calls fetch at all.
      jest.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/v1/watchlists')) {
          return new Response(JSON.stringify({ watchlists: [] }), { status: 200 });
        }
        return new Response(
          JSON.stringify({ status: 'disconnected', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null }),
          { status: 200 }
        );
      });

      const { default: Page } = await import('../../src/app/tenant/watchlists/page');
      return { Page, redirectMock };
    }

    it('a platform_admin session requesting /tenant/watchlists is redirected, not rendered', async () => {
      const { Page, redirectMock } = await renderWatchlistsPageAs(PLATFORM_ADMIN);
      await expect(Page()).rejects.toThrow('NEXT_REDIRECT:/');
      expect(redirectMock).toHaveBeenCalledWith('/');
    });

    it('a tenant_admin session renders the real watchlists screen — no retired fixture text anywhere', async () => {
      const { Page, redirectMock } = await renderWatchlistsPageAs(TENANT_ADMIN);
      const element = await Page();
      expect(redirectMock).not.toHaveBeenCalled();
      const rendered = JSON.stringify(element);
      expect(rendered).toContain('Watchlists');
      expect(rendered).not.toContain('Breaking news');
      expect(rendered).not.toContain('PR mentions');
    });

    it('a tenant_user session renders the identical real watchlists screen — no admin-only broader view', async () => {
      const { Page, redirectMock } = await renderWatchlistsPageAs(TENANT_USER);
      const element = await Page();
      expect(redirectMock).not.toHaveBeenCalled();
      const rendered = JSON.stringify(element);
      expect(rendered).toContain('Watchlists');
      expect(rendered).not.toContain('Breaking news');
    });
  });

  /**
   * Story 6.5 (upgraded 2026-08-12, proactively — same category of ripple
   * Story 6.4's own healing pass just fixed above, applied here ahead of a
   * failing run since the cause was already known) — ConnectorStatusPage is
   * no longer a synchronous, fixture-identity component either (Story 6.5's
   * own real rework replaced that with a real async Server Component). Same
   * real-session-plus-real-fetch-mocking pattern as the Story 6.3/6.4 blocks
   * above.
   */
  describe('Story 6.5 — ConnectorStatusPage under a real tenant session', () => {
    afterEach(() => {
      jest.dontMock('next/headers');
      jest.dontMock('next/navigation');
      jest.resetModules();
      jest.restoreAllMocks();
    });

    it('a tenant_admin session renders the real connector status screen — no retired fixture text anywhere', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity: TENANT_ADMIN });

      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      const redirectMock = jest.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`);
      });
      jest.doMock('next/navigation', () => ({ redirect: redirectMock }));

      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ status: 'disconnected', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null }),
          { status: 200 }
        )
      );

      const { default: Page } = await import('../../src/app/tenant/connectors/status/page');
      const element = await Page();
      expect(redirectMock).not.toHaveBeenCalled();
      const rendered = JSON.stringify(element);
      expect(rendered).not.toContain('reddit');
      expect(rendered).not.toMatch(/"healthy",\s*"lastSuccessfulPoll"/);

      const clientProps = element.props.children.props;
      const html = renderComponent('../../src/app/tenant/connectors/status/ConnectorStatusClient', 'ConnectorStatusClient', clientProps);
      expect(html).toContain('Connector Health');
    });
  });
});
