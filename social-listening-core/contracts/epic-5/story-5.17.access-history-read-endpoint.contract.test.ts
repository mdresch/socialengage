// Contract: Story 5.17 (ADR-0032 §9) — Audit trail for access_ends_at writes.
// See docs/user-stories/epic-5-security-isolation-and-messaging.md#story-517--audit-trail-for-access_ends_at-writes
//
// Intent: Story 5.17 — the read side of ADR-0032 §9's audit trail.
// Scope: src/identity/identityResolution.ts (extended — AccessHistoryEntry,
//   listAccessHistory()), src/http/versions/v1/tenantUsersRouter.ts
//   (extended — GET /:id/access-history), .claude/skills/identity-resolution/SKILL.md.
//
// A real, confirmed pre-existing-work finding, not assumed: Story 1.9
// (built 2026-08-09/10, ahead of this story) already had to create the
// write side of this exact mechanism to make its own PATCH endpoint work —
// migration 0024_create_user_access_audit_log.sql, and
// identityResolution.ts's setAccessEndsAt() already inserts one audit row
// per write, inside the same withTenant() transaction as the users UPDATE
// (verified directly against src/db/withTenant.ts's own real
// BEGIN/COMMIT/ROLLBACK wrapping — not assumed). Story 1.9's own AC9
// contract (contracts/epic-1/story-1.9...) already proves a row is written
// on both set and clear. This story's own genuinely new work is therefore
// narrower than its Acceptance Criteria read in isolation: the read
// endpoint (AC4), proven read-side coverage of both set-and-clear (AC3,
// from the read side, which no contract has exercised before this one),
// confirming break-glass stays independent (AC5), and cross-tenant
// isolation of the NEW endpoint specifically (AC6 — Story 1.9's own AC8
// isolation test predates this endpoint's existence).
//
// A real, honestly-named schema/AC drift, not silently patched: this
// story's own AC1 bullet (drafted 2026-08-05) names columns
// (user_id/changed_by/previous_value/changed_at) that don't match what
// Story 1.9 actually shipped (target_user_id/actor_user_id/old_value/
// occurred_at, plus an operation column AC1 doesn't mention) — confirmed
// directly against migrations/0024's own text, which itself says "Story
// 5.17 was drafted to own this design; Story 1.9 is the first caller."
// Not re-migrated here: changing already-shipped, already-tested column
// names for a pure naming difference would destabilize Story 1.9's own
// passing contract for no behavioral gain. Corrected via a dated note in
// docs/user-stories/epic-5-security-isolation-and-messaging.md instead of
// silently rewriting the AC text, per this project's own "don't rewrite
// history" convention — the same treatment Story 6.1's own naming
// correction and ADR-0031's own Supersession update note already used.
//
// Explicitly out of scope for this contract:
//   - Re-proving that a PATCH call writes an audit row at all, or that
//     set/clear each write the right operation/new_value — Story 1.9's own
//     AC9 tests already prove this directly; duplicating those assertions
//     here would be pure repetition, not additional coverage.
//   - Engineering a genuine mid-transaction failure to re-derive
//     withTenant()'s own ROLLBACK-on-throw behavior — that's a foundational
//     guarantee every tenant-scoped write in this codebase already depends
//     on (src/db/withTenant.ts), not something this one story re-proves in
//     isolation.
//   - Story 5.13's break-glass mechanism's own correctness (real Entra
//     calls) — this contract only proves that module never references
//     access_ends_at/user_access_audit_log at all, structurally.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import fs from 'fs';
import path from 'path';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 5]
  );
  return rows[0];
}

async function createUserFixture(tenantId: string, email: string): Promise<string> {
  const { rows } = await withTenant(tenantId, (client) =>
    client.query<{ id: string }>(
      `INSERT INTO users (tenant_id, email, role, status) VALUES ($1, $2, 'tenant_user', 'active') RETURNING id`,
      [tenantId, email]
    )
  );
  return rows[0].id;
}

function adminHeader(tenantId: string, userId?: string): string {
  return testIdentityHeaderValue(tenantId, { role: 'tenant_admin', userId: userId ?? randomUUID() });
}
function userHeader(tenantId: string): string {
  return testIdentityHeaderValue(tenantId, { role: 'tenant_user' });
}

describe('Story 5.17 — access-history read endpoint', () => {
  const app = createApp();

  describe('AC4: GET /v1/tenants/users/:id/access-history — tenant_admin only, RLS-scoped', () => {
    it('a tenant_admin sees the real entries produced by a prior PATCH, correctly shaped', async () => {
      const tenant = await createTenantFixture(`AccessHistory-${randomUUID()}`);
      const userId = await createUserFixture(tenant.id, `target-${randomUUID()}@example.org`);
      const actorId = randomUUID();

      await request(app)
        .patch(`/v1/tenants/users/${userId}`)
        .set('X-Test-Identity', adminHeader(tenant.id, actorId))
        .send({ accessEndsAt: '2099-01-01T00:00:00.000Z' });

      const res = await request(app)
        .get(`/v1/tenants/users/${userId}/access-history`)
        .set('X-Test-Identity', adminHeader(tenant.id));

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      const entry = res.body.entries[0];
      expect(entry.targetUserId).toBe(userId);
      expect(entry.actorUserId).toBe(actorId);
      expect(entry.operation).toBe('set_access_ends_at');
      expect(entry.oldValue).toBeNull();
      expect(entry.newValue).toBe('2099-01-01T00:00:00.000Z');
      expect(typeof entry.occurredAt).toBe('string');
    });

    it('returns 403 for a tenant_user session', async () => {
      const tenant = await createTenantFixture(`AccessHistory-${randomUUID()}`);
      const userId = await createUserFixture(tenant.id, `target-${randomUUID()}@example.org`);

      const res = await request(app)
        .get(`/v1/tenants/users/${userId}/access-history`)
        .set('X-Test-Identity', userHeader(tenant.id));

      expect(res.status).toBe(403);
    });

    it('returns 401 with no identity at all', async () => {
      const res = await request(app).get(`/v1/tenants/users/${randomUUID()}/access-history`);
      expect(res.status).toBe(401);
    });
  });

  describe('AC3 (read side): both a set and a subsequent clear are visible, in order, with a null new_value on the clear', () => {
    it('shows both entries, most recent first, the clear carrying newValue: null', async () => {
      const tenant = await createTenantFixture(`AccessHistory-${randomUUID()}`);
      const userId = await createUserFixture(tenant.id, `target-${randomUUID()}@example.org`);
      const actorHeader = adminHeader(tenant.id);

      await request(app)
        .patch(`/v1/tenants/users/${userId}`)
        .set('X-Test-Identity', actorHeader)
        .send({ accessEndsAt: '2099-01-01T00:00:00.000Z' });
      await request(app)
        .patch(`/v1/tenants/users/${userId}`)
        .set('X-Test-Identity', actorHeader)
        .send({ accessEndsAt: null });

      const res = await request(app)
        .get(`/v1/tenants/users/${userId}/access-history`)
        .set('X-Test-Identity', actorHeader);

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(2);
      expect(res.body.entries[0].operation).toBe('clear_access_ends_at');
      expect(res.body.entries[0].newValue).toBeNull();
      expect(res.body.entries[0].oldValue).toBe('2099-01-01T00:00:00.000Z');
      expect(res.body.entries[1].operation).toBe('set_access_ends_at');
    });
  });

  describe('AC2 (read side): the audit entry and the users row reflect the same write together', () => {
    it("a PATCH's resulting access_ends_at and its own audit entry's newValue agree, from one real write", async () => {
      const tenant = await createTenantFixture(`AccessHistory-${randomUUID()}`);
      const userId = await createUserFixture(tenant.id, `target-${randomUUID()}@example.org`);
      const actorHeader = adminHeader(tenant.id);

      const patchRes = await request(app)
        .patch(`/v1/tenants/users/${userId}`)
        .set('X-Test-Identity', actorHeader)
        .send({ accessEndsAt: '2099-06-01T00:00:00.000Z' });
      expect(patchRes.status).toBe(200);

      const historyRes = await request(app)
        .get(`/v1/tenants/users/${userId}/access-history`)
        .set('X-Test-Identity', actorHeader);

      expect(historyRes.body.entries[0].newValue).toBe(patchRes.body.accessEndsAt);
    });
  });

  describe('AC6: cross-tenant isolation on the new endpoint', () => {
    it("tenant A's admin querying tenant B's real target user id sees no rows (RLS-filtered, not a leak)", async () => {
      const tenantA = await createTenantFixture(`TenantA-${randomUUID()}`);
      const tenantB = await createTenantFixture(`TenantB-${randomUUID()}`);
      const userBId = await createUserFixture(tenantB.id, `target-${randomUUID()}@example.org`);

      await request(app)
        .patch(`/v1/tenants/users/${userBId}`)
        .set('X-Test-Identity', adminHeader(tenantB.id))
        .send({ accessEndsAt: '2099-01-01T00:00:00.000Z' });

      const res = await request(app)
        .get(`/v1/tenants/users/${userBId}/access-history`)
        .set('X-Test-Identity', adminHeader(tenantA.id));

      expect(res.status).toBe(200);
      expect(res.body.entries).toEqual([]);
    });
  });

  describe('AC5: the break-glass path (Story 5.13) never touches access_ends_at or user_access_audit_log', () => {
    it('breakGlassCredentialReset.ts references neither, structurally', () => {
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'admin', 'breakGlassCredentialReset.ts'),
        'utf8'
      );
      expect(source).not.toContain('access_ends_at');
      expect(source).not.toContain('user_access_audit_log');
    });
  });
});
