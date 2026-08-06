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
 */

import { getTenantShellActions } from '../../src/lib/role-routing';
import ConnectorsPage from '../../src/app/tenant/connectors/page';
import WatchlistsPage from '../../src/app/tenant/watchlists/page';
import ConnectorStatusPage from '../../src/app/tenant/connectors/status/page';

describe('Story 6.2 healing pass — ResolvedIdentity migration ripple into Stories 6.3/6.4/6.5', () => {
  it('the real ResolvedIdentity-shaped fixture used by connectors/page.tsx and connectors/status/page.tsx (tenant_admin) still yields the tenant-admin-only action', () => {
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

  it('Story 6.3 — ConnectorsPage still renders under the migrated call, with its own tenant-admin fixture action visible', () => {
    const element = ConnectorsPage();
    const rendered = JSON.stringify(element);
    expect(rendered).toContain('Tenant-wide connect');
    expect(rendered).toContain('Connect a platform');
    expect(rendered).toContain('GNews');
    expect(rendered).toContain('Newswire');
  });

  it('Story 6.4 — WatchlistsPage still renders under the migrated call, correctly omitting the tenant-admin-only action for its own tenant_user fixture', () => {
    const element = WatchlistsPage();
    const rendered = JSON.stringify(element);
    expect(rendered).not.toContain('Tenant-wide connect');
    expect(rendered).toContain('Watchlists');
    expect(rendered).toContain('Breaking news');
  });

  it('Story 6.5 — ConnectorStatusPage still renders under the migrated call, with its own tenant-admin fixture action visible', () => {
    const element = ConnectorStatusPage();
    const rendered = JSON.stringify(element);
    expect(rendered).toContain('Tenant-wide connect');
    expect(rendered).toContain('Connector status');
    expect(rendered).toContain('healthy');
  });
});
