// Contract: Story 10.1 (ADR-0086, BRD-0086, FDD-0086) — Prospecting List Model & Sharing (Backend)
// See docs/user-stories/epic-10-adr-0086-to-0094.md#story-101

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

async function createAuthorFixture(tenantId: string, handle: string): Promise<{ id: string }> {
  const { rows } = await getAdminPool().query<{ id: string }>(
    `INSERT INTO authors (tenant_id, platform_id, external_author_id, handle, display_name, follower_count)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [tenantId, 'twitter', `ext-${randomUUID()}`, handle, `Display ${handle}`, 1000]
  );
  return rows[0];
}

describe('Story 10.1 — Prospecting List Model and Sharing Contract', () => {
  const app = createApp();

  it('AC1/AC2: CRUD on prospecting lists scoped to tenant and owner', async () => {
    const tenant = await createTenantFixture(`T-10.1-crud-${randomUUID()}`);
    const owner = await createInvitedUser(tenant.id, { email: `owner-${randomUUID()}@example.com` });

    // 1. Create list
    const createRes = await request(app)
      .post('/v1/prospecting-lists')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({
        name: 'Enterprise Tech Influencers',
        description: 'Key decision makers and tech evangelists',
        shared: false,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      id: expect.any(String),
      tenant_id: tenant.id,
      owner_id: owner.id,
      name: 'Enterprise Tech Influencers',
      description: 'Key decision makers and tech evangelists',
      shared: false,
    });

    const listId = createRes.body.id;

    // 2. List lists
    const listRes = await request(app)
      .get('/v1/prospecting-lists')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }));

    expect(listRes.status).toBe(200);
    expect(listRes.body.lists).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: listId, name: 'Enterprise Tech Influencers' })])
    );

    // 3. Get single list
    const getRes = await request(app)
      .get(`/v1/prospecting-lists/${listId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }));

    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(listId);

    // 4. Update list
    const updateRes = await request(app)
      .patch(`/v1/prospecting-lists/${listId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ name: 'Updated Tech Influencers', shared: true });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Updated Tech Influencers');
    expect(updateRes.body.shared).toBe(true);
  });

  it('AC3/AC4: Shared list is visible to teammates, but non-owner write returns 404 (no tenant_admin override)', async () => {
    const tenant = await createTenantFixture(`T-10.1-share-${randomUUID()}`);
    const owner = await createInvitedUser(tenant.id, { email: `owner-${randomUUID()}@example.com` });
    const teammate = await createInvitedUser(tenant.id, { email: `teammate-${randomUUID()}@example.com` });
    const admin = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com` });

    // Create shared list
    const createRes = await request(app)
      .post('/v1/prospecting-lists')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ name: 'Shared Team Leads', shared: true });
    const listId = createRes.body.id;

    // Teammate can read shared list
    const teamReadRes = await request(app)
      .get(`/v1/prospecting-lists/${listId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: teammate.id, role: 'tenant_user' }));
    expect(teamReadRes.status).toBe(200);
    expect(teamReadRes.body.id).toBe(listId);

    // Teammate write attempt returns 404
    const teamWriteRes = await request(app)
      .patch(`/v1/prospecting-lists/${listId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: teammate.id, role: 'tenant_user' }))
      .send({ name: 'Hacked by teammate' });
    expect(teamWriteRes.status).toBe(404);

    // Tenant Admin write attempt also returns 404 (no admin override, ADR-0086 §2)
    const adminWriteRes = await request(app)
      .patch(`/v1/prospecting-lists/${listId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'tenant_admin' }))
      .send({ name: 'Hacked by admin' });
    expect(adminWriteRes.status).toBe(404);
  });

  it('AC5/AC6/AC7/AC8: Managing entries, score snapshotting, 409 conflict, relationship stage validation and pagination', async () => {
    const tenant = await createTenantFixture(`T-10.1-entries-${randomUUID()}`);
    const owner = await createInvitedUser(tenant.id, { email: `owner-${randomUUID()}@example.com` });
    const author1 = await createAuthorFixture(tenant.id, 'lead1');
    const author2 = await createAuthorFixture(tenant.id, 'lead2');

    const listRes = await request(app)
      .post('/v1/prospecting-lists')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ name: 'Lead Pipeline' });
    const listId = listRes.body.id;

    // 1. Add entry with score snapshot and valid relationship stage
    const addRes = await request(app)
      .post(`/v1/prospecting-lists/${listId}/entries`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({
        author_id: author1.id,
        platform_id: 'twitter',
        topic: 'Fintech Cloud',
        engagement_score: 88.5,
        authenticity_score: 95.0,
        influence_score: 78.2,
        reach_score: 92.4,
        relationship_stage: 'new',
        notes: 'Spoke at conference',
        tags: ['fintech', 'speaker'],
        custom_attributes: { tier: 'VIP' },
      });

    expect(addRes.status).toBe(201);
    expect(addRes.body).toMatchObject({
      prospecting_list_id: listId,
      author_id: author1.id,
      relationship_stage: 'new',
      engagement_score: '88.50',
      influence_score: '78.20',
      notes: 'Spoke at conference',
      tags: ['fintech', 'speaker'],
      custom_attributes: { tier: 'VIP' },
    });

    const entryId = addRes.body.id;

    // 2. Duplicate entry returns 409 Conflict
    const dupRes = await request(app)
      .post(`/v1/prospecting-lists/${listId}/entries`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ author_id: author1.id, platform_id: 'twitter' });

    expect(dupRes.status).toBe(409);

    // 3. Invalid relationship stage returns 400
    const invalidStageRes = await request(app)
      .post(`/v1/prospecting-lists/${listId}/entries`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ author_id: author2.id, platform_id: 'twitter', relationship_stage: 'invalid_stage' });

    expect(invalidStageRes.status).toBe(400);

    // 4. Update entry stage & notes
    const updateEntryRes = await request(app)
      .patch(`/v1/prospecting-lists/${listId}/entries/${entryId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({
        relationship_stage: 'contacted',
        notes: 'Followed up on LinkedIn',
      });

    expect(updateEntryRes.status).toBe(200);
    expect(updateEntryRes.body.relationship_stage).toBe('contacted');
    expect(updateEntryRes.body.notes).toBe('Followed up on LinkedIn');

    // 5. Cursor-paginated read
    const getEntriesRes = await request(app)
      .get(`/v1/prospecting-lists/${listId}/entries?limit=10`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }));

    expect(getEntriesRes.status).toBe(200);
    expect(getEntriesRes.body.entries.length).toBe(1);
    expect(getEntriesRes.body.entries[0].author_id).toBe(author1.id);

    // 6. Delete entry
    const delEntryRes = await request(app)
      .delete(`/v1/prospecting-lists/${listId}/entries/${entryId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }));

    expect(delEntryRes.status).toBe(204);
  });

  it('AC10: Cross-tenant isolation strictly returns 404', async () => {
    const tenantA = await createTenantFixture(`T-10.1-tenantA-${randomUUID()}`);
    const tenantB = await createTenantFixture(`T-10.1-tenantB-${randomUUID()}`);
    const userA = await createInvitedUser(tenantA.id, { email: `userA-${randomUUID()}@example.com` });
    const userB = await createInvitedUser(tenantB.id, { email: `userB-${randomUUID()}@example.com` });

    const listRes = await request(app)
      .post('/v1/prospecting-lists')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantA.id, { userId: userA.id, role: 'tenant_user' }))
      .send({ name: 'Tenant A Secret List', shared: true });
    const listId = listRes.body.id;

    // User in Tenant B cannot read or write Tenant A list
    const getRes = await request(app)
      .get(`/v1/prospecting-lists/${listId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantB.id, { userId: userB.id, role: 'tenant_user' }));
    expect(getRes.status).toBe(404);

    const patchRes = await request(app)
      .patch(`/v1/prospecting-lists/${listId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantB.id, { userId: userB.id, role: 'tenant_user' }))
      .send({ name: 'Cross Tenant Overwrite' });
    expect(patchRes.status).toBe(404);
  });
});
