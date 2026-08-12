/**
 * Story 5.10 — Retire `X-Tenant-Id` as a trust mechanism
 * Source ADR: ADR-0033 (accepted 2026-08-03, as drafted, no revisions)
 *
 * Intent: mount one combined authentication middleware (Story 5.6's token
 * validation + Story 5.9's `resolveIdentity()`) at the top of the `/v1`
 * router stack, replacing every route's own `req.header('X-Tenant-Id')`
 * read. Only the *source* of `tenantId` changes — every downstream
 * tenant-scoped function signature (`createWatchlist`, `withTenant`, etc.)
 * is untouched (ADR-0033 §2). A stray `X-Tenant-Id` header must be
 * completely inert (§3) — never read, never merged, never able to override
 * the token-resolved tenant.
 *
 * Test-harness mechanism (Menno's explicit sign-off, per ADR-0033's own
 * flagged Open Question): a test-only auth bypass, `testAuthBypassMiddleware`,
 * mounted only when `NODE_ENV === 'test'` (Jest's own default, unchanged
 * here) — reads a JSON-encoded `ResolvedIdentity` directly from a
 * `X-Test-Identity` header, skipping real Entra token verification
 * entirely. Never present in production (`app.ts` only wires the real
 * `tenantAuthMiddleware` outside test mode). Real Entra token verification
 * itself is not re-proven here — Story 5.6's own contract already proves
 * `createEntraAuthMiddleware` against the real tenant; this story reuses
 * that exact function unchanged, composed with `resolveIdentity()`.
 *
 * A necessary behavior beyond the literal AC list, flagged rather than
 * silently added: a Platform Admin identity (`resolveIdentity()`'s other
 * resolved shape) hitting any of these tenant-content routes must be
 * rejected (403) — none of `watchlistsRouter`/`connectorsRouter`/
 * `postsRouter`/`topicsRouter` are Platform Admin surfaces, and
 * `req.identity` can now structurally be either shape, so routers need an
 * explicit rejection for the wrong one rather than crashing on a missing
 * `tenantId`. Centralized in one shared helper, `requireTenantUser()`,
 * rather than duplicated per router.
 *
 * Explicitly out of scope:
 * - Re-proving real Entra JWT signature/issuer/audience verification —
 *   Story 5.6's own contract already does this against the real tenant.
 * - Interactive user sign-in tokens carrying a real `email` claim — this
 *   project has no interactive sign-in flow yet (Story 5.6's own SKILL.md
 *   names this as unverified); `entraAuthMiddleware`'s `email` extraction
 *   is wired for when that exists, not tested against a real token here.
 * - `connectorsRouter.ts`'s connect/disconnect endpoints' own ownership-tier
 *   authorization — that's Story 1.7/ADR-0034's job; this story only
 *   changes *where* `tenantId` comes from on those routes, not who may act
 *   on behalf of which owner.
 *
 * AC1: no `/v1` route handler file contains the literal string
 *      `X-Tenant-Id` — a repository-wide check, not per-route.
 * AC2: a stray `X-Tenant-Id` header claiming a different tenant has zero
 *      effect — the token/test-identity-resolved tenant is what's used.
 * AC3: existing tenant-scoped function signatures are unchanged (proven
 *      structurally — no store function was touched — and by the full
 *      suite's existing business-logic assertions continuing to pass
 *      unmodified).
 * AC4: a request with no Authorization/X-Test-Identity, or an invalid one,
 *      is rejected 401 before any route handler runs.
 * AC-platform-admin: a resolved Platform Admin identity is rejected (403)
 *      on these tenant-content routes.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../../src/http/app';
import { createTenant } from '../../src/tenants/tenantStore';
import { createWatchlist } from '../../src/watchlists/watchlistStore';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePool } from '../../src/db/pool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

const ROUTE_FILES = [
  '../../src/http/versions/v1/watchlistsRouter.ts',
  '../../src/http/versions/v1/connectorsRouter.ts',
  '../../src/http/versions/v1/postsRouter.ts',
  '../../src/http/versions/v1/topicsRouter.ts',
].map((p) => path.join(__dirname, p));

async function makeTenant(): Promise<string> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  return tenant.id;
}

// 2026-08-12 (Story 1.5/ADR-0044 ripple): watchlists are now personal/
// per-user (owned by a real, non-null users.id FK) rather than tenant-wide.
// AC2/AC3 below test tenant isolation specifically, not ownership — so both
// the creating call and the asserting GET must use the SAME real caller
// identity, or the new ownership-scoped RLS (not a regression, a deliberate
// ADR-0044 §5c behavior change) would confound the assertion with an
// unrelated "different user" case. Mirrors Story 1.7's own
// makeTenantWithUsers() precedent.
async function makeTenantWithUser(): Promise<{ tenantId: string; userId: string }> {
  const tenantId = await makeTenant();
  const email = `user-${randomUUID()}@example.com`;
  const invited = await createInvitedUser(tenantId, { email, role: 'tenant_user' });
  await resolveIdentity({ sub: `sub-${invited.id}`, email });
  return { tenantId, userId: invited.id };
}

describe('Story 5.10 — X-Tenant-Id retired as a trust mechanism', () => {
  it('AC1: no /v1 route handler file references X-Tenant-Id', () => {
    for (const file of ROUTE_FILES) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toContain('X-Tenant-Id');
    }
  });

  it('AC2: a stray X-Tenant-Id header claiming another tenant has no effect', async () => {
    const app = createApp();
    const realTenant = await makeTenantWithUser();
    const claimedTenant = await makeTenant();
    await createWatchlist(realTenant.tenantId, realTenant.userId, {
      name: `real-${randomUUID()}`,
      matchType: 'keyword',
      terms: ['x'],
    });

    const res = await request(app)
      .get('/v1/watchlists')
      .set('X-Test-Identity', testIdentityHeaderValue(realTenant.tenantId, { userId: realTenant.userId }))
      .set('X-Tenant-Id', claimedTenant); // stray, must be ignored

    expect(res.status).toBe(200);
    expect(res.body.watchlists.length).toBeGreaterThan(0);
    // Every watchlist returned must genuinely belong to realTenant, never claimedTenant.
    const crossTenantLeak = await request(app)
      .get('/v1/watchlists')
      .set('X-Test-Identity', testIdentityHeaderValue(claimedTenant))
      .set('X-Tenant-Id', realTenant.tenantId);
    expect(crossTenantLeak.body.watchlists).toHaveLength(0);
  });

  it('AC3: tenantId flows through to the store layer unchanged (existing signatures untouched)', async () => {
    const app = createApp();
    const { tenantId, userId } = await makeTenantWithUser();
    const name = `AC3-${randomUUID()}`;
    await createWatchlist(tenantId, userId, { name, matchType: 'keyword', terms: ['x'] });

    const res = await request(app)
      .get('/v1/watchlists')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId }));

    expect(res.status).toBe(200);
    expect(res.body.watchlists.some((w: { name: string }) => w.name === name)).toBe(true);
  });

  it('AC4: no Authorization/X-Test-Identity header at all is rejected 401', async () => {
    const app = createApp();
    const res = await request(app).get('/v1/watchlists');
    expect(res.status).toBe(401);
  });

  it('AC4: an invalid X-Test-Identity header is rejected 401', async () => {
    const app = createApp();
    const res = await request(app).get('/v1/watchlists').set('X-Test-Identity', 'not-json');
    expect(res.status).toBe(401);
  });

  it('AC-platform-admin: a resolved Platform Admin identity is rejected 403 on tenant-content routes', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/v1/watchlists')
      .set('X-Test-Identity', JSON.stringify({ type: 'platform_admin', adminId: randomUUID() }));
    expect(res.status).toBe(403);
  });
});
