/**
 * Contract: Story 12.13 (ADR-0107, BRD-0107, FDD-0107) — Multi-user workspaces and RBAC permissions (backend).
 * See docs/user-stories/epic-12-adr-0101-to-0108.md#story-1213--multi-user-workspaces-and-rbac-permissions-backend
 * and docs/adr/0107-multi-user-workspaces-and-rbac-permissions.md
 */

import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { createWatchlist } from '../../src/watchlists/watchlistStore';
import {
  shareWatchlist,
  listWatchlistShares,
  removeWatchlistShare,
  getSharedWatchlistsForUser,
} from '../../src/watchlists/watchlistShareStore';
import { hasPermission, requirePermission } from '../../src/auth/permissionMatrix';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

async function createTenantFixture(name: string, maxSeats: number = 5): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count, active_seat_count) VALUES ($1, $2, $3) RETURNING id`,
    [name, maxSeats, 1]
  );
  return rows[0];
}

describe('Story 12.13 — Multi-user workspaces and RBAC permissions (backend)', () => {
  let tenant: { id: string };
  let adminUser: { id: string };
  let standardUser1: { id: string };
  let standardUser2: { id: string };
  let watchlist: { id: string };
  let app: any;

  beforeAll(async () => {
    tenant = await createTenantFixture(`Tenant RBAC ${Date.now()}`, 5);
    adminUser = await createInvitedUser(tenant.id, {
      email: `admin-${Date.now()}@example.com`,
      role: 'tenant_admin',
    });
    standardUser1 = await createInvitedUser(tenant.id, {
      email: `user1-${Date.now()}@example.com`,
      role: 'tenant_user',
    });
    standardUser2 = await createInvitedUser(tenant.id, {
      email: `user2-${Date.now()}@example.com`,
      role: 'tenant_user',
    });

    watchlist = await createWatchlist(tenant.id, standardUser1.id, {
      name: 'User 1 Brand Monitoring',
      terms: ['brand', 'product'],
      matchType: 'keyword',
    });

    app = createApp();
  });

  describe('AC1: Permission matrix logic (hasPermission & requirePermission)', () => {
    it('grants tenant_admin full manage permissions on users, settings, and connectors', () => {
      expect(hasPermission('tenant_admin', 'users', 'manage')).toBe(true);
      expect(hasPermission('tenant_admin', 'settings', 'manage')).toBe(true);
      expect(hasPermission('tenant_admin', 'connectors', 'manage')).toBe(true);
      expect(hasPermission('tenant_admin', 'watchlists', 'manage_all')).toBe(true);
    });

    it('limits tenant_user permissions to personal scope and reading', () => {
      expect(hasPermission('tenant_user', 'users', 'manage')).toBe(false);
      expect(hasPermission('tenant_user', 'users', 'read')).toBe(false);
      expect(hasPermission('tenant_user', 'connectors', 'activate_own')).toBe(true);
      expect(hasPermission('tenant_user', 'connectors', 'manage')).toBe(false);
      expect(hasPermission('tenant_user', 'watchlists', 'own')).toBe(true);
    });
  });

  describe('AC2: Watchlist sharing (watchlist_shares table with read and edit permission)', () => {
    it('shares a watchlist with another user with read permission', async () => {
      const share = await shareWatchlist(tenant.id, standardUser1.id, {
        watchlistId: watchlist.id,
        sharedWithUserId: standardUser2.id,
        permission: 'read',
      });

      expect(share).toHaveProperty('id');
      expect(share.watchlist_id).toBe(watchlist.id);
      expect(share.shared_with_user_id).toBe(standardUser2.id);
      expect(share.permission).toBe('read');
    });

    it('lists shares for a watchlist', async () => {
      const shares = await listWatchlistShares(tenant.id, watchlist.id);
      expect(shares.length).toBeGreaterThanOrEqual(1);
      expect(shares.some((s) => s.shared_with_user_id === standardUser2.id)).toBe(true);
    });

    it('retrieves shared watchlists for recipient user', async () => {
      const sharedLists = await getSharedWatchlistsForUser(tenant.id, standardUser2.id);
      expect(sharedLists.some((s) => s.watchlist_id === watchlist.id)).toBe(true);
    });

    it('removes a watchlist share', async () => {
      const removed = await removeWatchlistShare(tenant.id, watchlist.id, standardUser2.id);
      expect(removed).toBe(true);

      const shares = await listWatchlistShares(tenant.id, watchlist.id);
      expect(shares.some((s) => s.shared_with_user_id === standardUser2.id)).toBe(false);
    });
  });

  describe('AC3: Watchlist sharing HTTP API endpoints', () => {
    it('POST /v1/watchlists/:id/shares allows owner to share watchlist', async () => {
      const res = await request(app)
        .post(`/v1/watchlists/${watchlist.id}/shares`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: standardUser1.id, role: 'tenant_user' }))
        .send({
          sharedWithUserId: standardUser2.id,
          permission: 'edit',
        });

      expect(res.status).toBe(201);
      expect(res.body.permission).toBe('edit');
    });

    it('GET /v1/watchlists/:id/shares returns existing shares', async () => {
      const res = await request(app)
        .get(`/v1/watchlists/${watchlist.id}/shares`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: standardUser1.id, role: 'tenant_user' }));

      expect(res.status).toBe(200);
      expect(res.body.shares.length).toBeGreaterThanOrEqual(1);
    });

    it('DELETE /v1/watchlists/:id/shares/:userId removes a share', async () => {
      const res = await request(app)
        .delete(`/v1/watchlists/${watchlist.id}/shares/${standardUser2.id}`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: standardUser1.id, role: 'tenant_user' }));

      expect([200, 204]).toContain(res.status);
    });
  });

  describe('AC4: Feature gates per-tenant configuration', () => {
    it('GET /v1/tenants/me/features and PATCH /v1/tenants/me/features manage feature gates', async () => {
      const patchRes = await request(app)
        .patch('/v1/tenants/me/features')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: adminUser.id, role: 'tenant_admin' }))
        .send({
          featureGates: {
            aiClustering: true,
            advancedAnalytics: true,
            customWebhooks: false,
          },
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.featureGates.aiClustering).toBe(true);

      const getRes = await request(app)
        .get('/v1/tenants/me/features')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: adminUser.id, role: 'tenant_admin' }));

      expect(getRes.status).toBe(200);
      expect(getRes.body.featureGates.aiClustering).toBe(true);
    });

    it('rejects feature gate modifications from tenant_user with 403', async () => {
      const res = await request(app)
        .patch('/v1/tenants/me/features')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: standardUser1.id, role: 'tenant_user' }))
        .send({ featureGates: { aiClustering: false } });

      expect(res.status).toBe(403);
    });
  });

  describe('AC5: Seat limit enforcement', () => {
    it('enforces license_seat_count ceiling on new invites', async () => {
      const smallTenant = await createTenantFixture(`Small Tenant ${Date.now()}`, 1);
      const smallAdmin = await createInvitedUser(smallTenant.id, {
        email: `small-admin-${Date.now()}@example.com`,
        role: 'tenant_admin',
      });

      // active_seat_count is 1 and license_seat_count is 1 -> invite should return 409
      const res = await request(app)
        .post('/v1/tenants/users')
        .set('X-Test-Identity', testIdentityHeaderValue(smallTenant.id, { userId: smallAdmin.id, role: 'tenant_admin' }))
        .send({ email: 'overlimit@example.com', role: 'tenant_user' });

      expect(res.status).toBe(409);
    });
  });
});
