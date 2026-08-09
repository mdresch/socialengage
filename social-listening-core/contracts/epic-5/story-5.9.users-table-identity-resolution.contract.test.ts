/**
 * Story 5.9 — `users` table, RLS, and request-time identity resolution
 * Source ADR: ADR-0032 (accepted 2026-08-03, revised at review to replace
 * `status`'s `'suspended'` value with a nullable `access_ends_at`, §9)
 *
 * Intent: create `users` (tenant-scoped, RLS identical in shape to every
 * other tenant table) and `platform_admins` (a deliberately separate table —
 * Platform Admin is never a `users` row, ADR-0032 §3), plus a fourth,
 * even-narrower Postgres role than `platform_admin_role`'s own:
 * `identity_resolver_role` — `BYPASSRLS`, column-scoped `SELECT`-only on
 * both tables, no write grant at all (ADR-0032 §5). `resolveIdentity()` is
 * the request-time bootstrap: given a validated token's `sub`/`email`
 * claims, it resolves to a tenant user, a Platform Admin, or `null`
 * (rejected) — entirely through `identity_resolver_role`'s read-only path.
 *
 * A real design tension in ADR-0032, resolved here rather than left
 * ambiguous: §5 says the resolver role has "never any write grant," but §6
 * requires linking `external_subject`/`status` at first sign-in — a write.
 * Reconciled the way AC3 itself points to: the resolver role only ever
 * performs the initial *read* (by `sub`, then by `email` for an unlinked
 * `invited` row); once that read reveals `tenant_id`, the actual link write
 * runs through the *ordinary* `withTenant(tenantId, ...)` `app_user` path —
 * the same path every other tenant-scoped write in this codebase already
 * uses, never `identity_resolver_role` itself performing a write.
 *
 * Explicitly out of scope, per this story's own Acceptance Criteria note
 * and ADR-0032's Open Questions:
 * - The audit mechanism for `access_ends_at` writes (§9) — inherits the
 *   same unresolved "exact audit-log schema" question already open from
 *   ADR-0030 §5/ADR-0031, not designed here.
 * - Wiring `resolveIdentity()` into a real HTTP route/middleware — that's
 *   Story 5.10's job (retiring `X-Tenant-Id`); this story proves the
 *   resolution *logic* against the tables directly.
 * - A Tenant Reader/Tenant Business Analyst role split — ADR-0032 §4
 *   deliberately defers this; both map to `role = 'tenant_user'` in v1.
 * - Any mechanism for creating a `platform_admins` row for real (out-of-band
 *   provisioning, not designed by ADR-0032) — this contract inserts fixture
 *   rows directly via `platformAdminPool` the same way Story 5.7's own
 *   contract did for its fixtures.
 *
 * AC1: `users` has an active RLS policy identical in shape to every other
 *      tenant-scoped table.
 * AC2: `identity_resolver_role` is `BYPASSRLS`, `SELECT`-only on specific
 *      columns of `users`/`platform_admins`, with no write grant at all and
 *      no access to an ungranted column.
 * AC3: once resolved, subsequent queries run through the ordinary
 *      `withTenant(resolvedTenantId, ...)` path as `app_user`.
 * AC4: a `sub` matching no `users` row and no Platform Admin row is
 *      rejected (resolves to `null`).
 * AC5: Tenant-Admin creates a `users` row in `invited` status with no
 *      `external_subject`; at first successful sign-in matching that row's
 *      email, `external_subject` is populated and `status` moves to
 *      `active`.
 * AC6: Platform Admin is not a row in `users` — `platform_admins` has no
 *      `tenant_id` column and returns zero rows under any ordinary
 *      tenant-scoped session.
 * AC-access-ends-at: a user with a past `access_ends_at` resolves as
 *      not-active; a future `access_ends_at` still resolves as active;
 *      clearing it back to `NULL` restores active resolution.
 */

import { randomUUID } from 'crypto';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { getIdentityResolverPool, closeIdentityResolverPool } from '../../src/db/identityResolverPool';
import { getPool, closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { createTenant } from '../../src/tenants/tenantStore';
import {
  createInvitedUser,
  setAccessEndsAt,
  resolveIdentity,
} from '../../src/identity/identityResolution';

jest.setTimeout(30000);

afterAll(async () => {
  await closeIdentityResolverPool();
  await closePlatformAdminPool();
  await closePool();
  await closeAdminPool();
});

async function makeTenant(): Promise<string> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  return tenant.id;
}

describe('Story 5.9 — users table RLS', () => {
  it('AC1: users has RLS enabled and forced, with a tenant_id-scoped policy', async () => {
    const { rows } = await getAdminPool().query(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'users'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].relrowsecurity).toBe(true);
    expect(rows[0].relforcerowsecurity).toBe(true);

    const { rows: policyRows } = await getAdminPool().query(
      `SELECT qual FROM pg_policies WHERE tablename = 'users' AND policyname = 'tenant_isolation'`
    );
    expect(policyRows).toHaveLength(1);
    expect(policyRows[0].qual).toContain('tenant_id');
  });

  it('AC1: a tenant-scoped session sees only its own tenant’s users', async () => {
    const tenantA = await makeTenant();
    const tenantB = await makeTenant();
    await createInvitedUser(tenantA, { email: `a-${randomUUID()}@example.com` });
    await createInvitedUser(tenantB, { email: `b-${randomUUID()}@example.com` });

    const seenByA = await withTenant(tenantA, async (client) => {
      const { rows } = await client.query('SELECT tenant_id FROM users');
      return rows as { tenant_id: string }[];
    });

    expect(seenByA.length).toBeGreaterThan(0);
    expect(seenByA.every((r) => r.tenant_id === tenantA)).toBe(true);
  });
});

describe('Story 5.9 — identity_resolver_role', () => {
  it('AC2: identity_resolver_role has BYPASSRLS', async () => {
    const { rows } = await getAdminPool().query(
      `SELECT rolbypassrls FROM pg_roles WHERE rolname = 'identity_resolver_role'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].rolbypassrls).toBe(true);
  });

  it('AC2: identity_resolver_role has no write grant at all', async () => {
    const tenantId = await makeTenant();
    const user = await createInvitedUser(tenantId, { email: `deny-${randomUUID()}@example.com` });

    await expect(
      getIdentityResolverPool().query(`UPDATE users SET status = 'active' WHERE id = $1`, [user.id])
    ).rejects.toThrow(/permission denied/i);
    await expect(
      getIdentityResolverPool().query(`INSERT INTO users (tenant_id, email) VALUES ($1, $2)`, [
        tenantId,
        `insert-${randomUUID()}@example.com`,
      ])
    ).rejects.toThrow(/permission denied/i);
    await expect(getIdentityResolverPool().query(`DELETE FROM users WHERE id = $1`, [user.id])).rejects.toThrow(
      /permission denied/i
    );
  });

  it('AC2: identity_resolver_role cannot read a column outside its narrow grant', async () => {
    await expect(getIdentityResolverPool().query(`SELECT display_name FROM users LIMIT 1`)).rejects.toThrow(
      /permission denied/i
    );
  });
});

describe('Story 5.9 — resolveIdentity()', () => {
  it('AC4: a sub matching no users row and no Platform Admin row resolves to null', async () => {
    const result = await resolveIdentity({ sub: `unknown-${randomUUID()}`, email: `unknown-${randomUUID()}@example.com` });
    expect(result).toBeNull();
  });

  it('AC5: an invited user links at first sign-in and resolves as an active tenant_user', async () => {
    const tenantId = await makeTenant();
    const email = `invite-${randomUUID()}@example.com`;
    const invited = await createInvitedUser(tenantId, { email, role: 'tenant_admin' });
    expect(invited.status).toBe('invited');
    expect(invited.externalSubject).toBeNull();

    const sub = `sub-${randomUUID()}`;
    const resolved = await resolveIdentity({ sub, email });

    expect(resolved).toEqual({ type: 'tenant_user', tenantId, userId: invited.id, role: 'tenant_admin' });

    // Confirm the link write actually landed, via the ordinary tenant-scoped path.
    const linked = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query('SELECT external_subject, status FROM users WHERE id = $1', [
        invited.id,
      ]);
      return rows[0];
    });
    expect(linked.external_subject).toBe(sub);
    expect(linked.status).toBe('active');

    // AC3: a subsequent request with the now-linked sub resolves without
    // relying on the invite/link path again, and the same resolved tenantId
    // works through the ordinary withTenant()/app_user route.
    const resolvedAgain = await resolveIdentity({ sub, email });
    expect(resolvedAgain).toEqual({ type: 'tenant_user', tenantId, userId: invited.id, role: 'tenant_admin' });

    const currentUser = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query('SELECT current_user');
      return rows[0].current_user;
    });
    expect(currentUser).toBe('app_user');
  });

  it('AC6: Platform Admin is not a users row — platform_admins has no tenant_id and returns zero rows under a tenant session', async () => {
    const { rows: columnRows } = await getAdminPool().query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'platform_admins'`
    );
    expect(columnRows.map((r) => r.column_name)).not.toContain('tenant_id');

    const adminSub = `admin-${randomUUID()}`;
    await getPlatformAdminPool().query(
      `INSERT INTO platform_admins (external_subject, email) VALUES ($1, $2)`,
      [adminSub, `admin-${randomUUID()}@example.com`]
    );

    const tenantId = await makeTenant();
    const seenByTenant = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query('SELECT * FROM platform_admins');
      return rows;
    });
    expect(seenByTenant).toHaveLength(0);

    const resolved = await resolveIdentity({ sub: adminSub, email: `irrelevant-${randomUUID()}@example.com` });
    expect(resolved).toEqual({ type: 'platform_admin', adminId: expect.any(String) });
  });

  it('AC-access-ends-at: a past access_ends_at resolves as not-active', async () => {
    const tenantId = await makeTenant();
    const email = `past-${randomUUID()}@example.com`;
    const sub = `sub-past-${randomUUID()}`;
    const user = await createInvitedUser(tenantId, { email });
    await resolveIdentity({ sub, email }); // link + activate

    const past = new Date(Date.now() - 60_000).toISOString();
    await setAccessEndsAt(tenantId, user.id, past, randomUUID());

    const resolved = await resolveIdentity({ sub, email });
    expect(resolved).toBeNull();
  });

  it('AC-access-ends-at: a future access_ends_at still resolves as active', async () => {
    const tenantId = await makeTenant();
    const email = `future-${randomUUID()}@example.com`;
    const sub = `sub-future-${randomUUID()}`;
    const user = await createInvitedUser(tenantId, { email });
    await resolveIdentity({ sub, email });

    const future = new Date(Date.now() + 60_000 * 60 * 24).toISOString();
    await setAccessEndsAt(tenantId, user.id, future, randomUUID());

    const resolved = await resolveIdentity({ sub, email });
    expect(resolved).toEqual({ type: 'tenant_user', tenantId, userId: user.id, role: 'tenant_user' });
  });

  it('AC-access-ends-at: clearing access_ends_at back to NULL restores active resolution', async () => {
    const tenantId = await makeTenant();
    const email = `clear-${randomUUID()}@example.com`;
    const sub = `sub-clear-${randomUUID()}`;
    const user = await createInvitedUser(tenantId, { email });
    await resolveIdentity({ sub, email });

    const past = new Date(Date.now() - 60_000).toISOString();
    await setAccessEndsAt(tenantId, user.id, past, randomUUID());
    expect(await resolveIdentity({ sub, email })).toBeNull();

    await setAccessEndsAt(tenantId, user.id, null, randomUUID());
    const resolved = await resolveIdentity({ sub, email });
    expect(resolved).toEqual({ type: 'tenant_user', tenantId, userId: user.id, role: 'tenant_user' });
  });
});
