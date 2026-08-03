/**
 * Story 5.8 — `tenants` table with its own RLS policy
 * Source ADR: ADR-0031 (accepted 2026-08-03, revised at review to add
 * sign-up domain capture, §5)
 *
 * Intent: create the `tenants` table — the first table whose own primary key
 * *is* the tenant identity, not a separate `tenant_id` foreign key (ADR-0031
 * §2) — with its RLS policy scoped by `id`, following ADR-0015's fail-closed
 * pattern exactly. Prove: (a) a tenant-scoped session sees exactly its own
 * row, never another tenant's; (b) `platform_admin_role` (Story 5.7) can
 * create a tenant and administer `status`/`license_seat_count`, but is
 * column-level DENIED from writing `active_seat_count` — a real,
 * DB-enforced boundary, not an application convention; (c) the seat-count
 * increment/decrement path runs as `app_user`, never `platform_admin_role`,
 * via a single atomic `UPDATE ... WHERE active_seat_count < license_seat_count`
 * statement that resolves ADR-0031 §3's own named race condition (its
 * suggested fix, not a different one); (d) `domain` (§5) is nullable and
 * unique only when non-null.
 *
 * Explicitly out of scope, per this story's own Acceptance Criteria note and
 * ADR-0031's Open Questions:
 * - The public-email-provider exclusion mechanism and the sign-up
 *   "rerouting" UX for `domain` matching — deferred to whoever builds
 *   candidate ADR #4's story.
 * - Wiring `incrementActiveSeatCount`/`decrementActiveSeatCount` into a real
 *   user-invitation flow — no `users` table exists yet (Story 5.9's job).
 *   This story proves the seat-count primitive in isolation, the same
 *   "prove the mechanism, not the whole pipeline" pattern used since Story
 *   4.1.
 * - Tenant deletion/offboarding and the audit-log schema for Platform-Admin
 *   writes to this table — both named Open Questions in ADR-0031, not
 *   resolved by this story.
 * - Any HTTP/REST surface for tenants — no Acceptance Criterion requires
 *   one; this story is table/store-level only.
 *
 * AC1: `tenants` has RLS enabled and forced, with a policy scoped by `id`.
 * AC2: a tenant-scoped session reading `tenants` sees exactly one row — its
 *      own.
 * AC3: `platform_admin_role` can create a tenant and update
 *      `status`/`license_seat_count` on any tenant row; it cannot write
 *      `active_seat_count` (column-level DB denial).
 * AC4: `active_seat_count` is incremented/decremented by `app_user`, never
 *      `platform_admin_role`.
 * AC5: a seat increment is rejected once `active_seat_count >=
 *      license_seat_count` for that tenant.
 * AC-domain: `domain` is nullable, and unique only when non-null.
 */

import { randomUUID } from 'crypto';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import {
  createTenant,
  updateTenantAdmin,
  getOwnTenant,
  incrementActiveSeatCount,
  decrementActiveSeatCount,
} from '../../src/tenants/tenantStore';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
  await closeAdminPool();
});

describe('Story 5.8 — tenants table RLS policy', () => {
  it('AC1: tenants has RLS enabled and forced, with a policy scoped by id', async () => {
    const { rows } = await getAdminPool().query(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'tenants'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].relrowsecurity).toBe(true);
    expect(rows[0].relforcerowsecurity).toBe(true);

    const { rows: policyRows } = await getAdminPool().query(
      `SELECT qual FROM pg_policies WHERE tablename = 'tenants' AND policyname = 'tenant_isolation'`
    );
    expect(policyRows).toHaveLength(1);
    expect(policyRows[0].qual).toContain('id');
  });

  it('AC2: a tenant-scoped session reading tenants sees exactly one row — its own', async () => {
    const tenantA = await createTenant('test-actor', { name: `AC2-A-${randomUUID()}`, licenseSeatCount: 5 });
    const tenantB = await createTenant('test-actor', { name: `AC2-B-${randomUUID()}`, licenseSeatCount: 5 });

    const seenByA = await withTenant(tenantA.id, async (client) => {
      const { rows } = await client.query('SELECT id FROM tenants');
      return rows as { id: string }[];
    });

    expect(seenByA).toHaveLength(1);
    expect(seenByA[0].id).toBe(tenantA.id);
    expect(seenByA.map((r) => r.id)).not.toContain(tenantB.id);
  });

  it('AC2: getOwnTenant returns the caller’s own row via the RLS-scoped session', async () => {
    const tenant = await createTenant('test-actor', { name: `AC2-get-${randomUUID()}`, licenseSeatCount: 2 });
    const fetched = await getOwnTenant(tenant.id);
    expect(fetched?.id).toBe(tenant.id);
    expect(fetched?.name).toBe(tenant.name);
    expect(fetched?.status).toBe('active');
  });

  it('AC3: platform_admin_role can create a tenant and update status/license_seat_count', async () => {
    const tenant = await createTenant('test-actor', { name: `AC3-${randomUUID()}`, licenseSeatCount: 3 });
    expect(tenant.status).toBe('active');
    expect(tenant.licenseSeatCount).toBe(3);

    const updated = await updateTenantAdmin('test-actor', tenant.id, {
      status: 'suspended',
      licenseSeatCount: 10,
    });
    expect(updated?.status).toBe('suspended');
    expect(updated?.licenseSeatCount).toBe(10);

    // Story 5.7's own load-bearing rule (platform-admin-access/SKILL.md):
    // every Platform Admin write must be recorded in the audit log.
    const { rows } = await getPlatformAdminPool().query(
      `SELECT operation, target_tenant_id FROM platform_admin_audit_log WHERE target_tenant_id = $1 ORDER BY created_at`,
      [tenant.id]
    );
    expect(rows.length).toBeGreaterThanOrEqual(2); // create + update
  });

  it('AC3: platform_admin_role cannot write active_seat_count — column-level DB denial, not just an app convention', async () => {
    const tenant = await createTenant('test-actor', { name: `AC3-deny-${randomUUID()}`, licenseSeatCount: 3 });

    await expect(
      getPlatformAdminPool().query(`UPDATE tenants SET active_seat_count = 1 WHERE id = $1`, [tenant.id])
    ).rejects.toThrow(/permission denied/i);
  });

  it('AC4: active_seat_count is incremented by app_user, never platform_admin_role', async () => {
    const tenant = await createTenant('test-actor', { name: `AC4-${randomUUID()}`, licenseSeatCount: 3 });

    const result = await incrementActiveSeatCount(tenant.id);
    expect(result?.activeSeatCount).toBe(1);

    const currentUser = await withTenant(tenant.id, async (client) => {
      const { rows } = await client.query('SELECT current_user');
      return rows[0].current_user;
    });
    expect(currentUser).toBe('app_user');
    expect(currentUser).not.toBe('platform_admin_role');
  });

  it('AC5: a seat increment is rejected once active_seat_count >= license_seat_count', async () => {
    const tenant = await createTenant('test-actor', { name: `AC5-${randomUUID()}`, licenseSeatCount: 1 });

    const first = await incrementActiveSeatCount(tenant.id);
    expect(first?.activeSeatCount).toBe(1);

    const second = await incrementActiveSeatCount(tenant.id);
    expect(second).toBeNull();

    const decremented = await decrementActiveSeatCount(tenant.id);
    expect(decremented?.activeSeatCount).toBe(0);

    const third = await incrementActiveSeatCount(tenant.id);
    expect(third?.activeSeatCount).toBe(1);
  });

  it('AC-domain: domain is nullable', async () => {
    const tenant = await createTenant('test-actor', { name: `AC-domain-null-${randomUUID()}`, licenseSeatCount: 1 });
    expect(tenant.domain).toBeNull();
  });

  it('AC-domain: two tenants may both have a NULL domain without conflict', async () => {
    const a = await createTenant('test-actor', { name: `AC-domain-nullA-${randomUUID()}`, licenseSeatCount: 1 });
    const b = await createTenant('test-actor', { name: `AC-domain-nullB-${randomUUID()}`, licenseSeatCount: 1 });
    expect(a.domain).toBeNull();
    expect(b.domain).toBeNull();
  });

  it('AC-domain: domain is unique only when non-null — a second tenant with the same domain is rejected', async () => {
    const domain = `example-${randomUUID()}.com`;
    await createTenant('test-actor', { name: `AC-domain-dup-A-${randomUUID()}`, licenseSeatCount: 1, domain });

    await expect(
      createTenant('test-actor', { name: `AC-domain-dup-B-${randomUUID()}`, licenseSeatCount: 1, domain })
    ).rejects.toThrow(/duplicate key|unique/i);
  });
});
