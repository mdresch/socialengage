/**
 * Contract: Story 17.1 (ADR-0129, BRD-0129, FDD-0129, TDS-0129)
 * Prospecting list model refinements — deduplicated CRM sync and scoped team sharing (Backend)
 *
 * Intent:
 * Refines the prospecting list model (Story 10.1) by replacing binary sharing with granular
 * sharing scopes ('private' | 'workspace_read' | 'workspace_write') and introducing cross-network
 * author deduplication for CRM handoffs.
 *
 * Scope:
 * 1. Schema migration 0080: add sharing_scope with check constraint and backfill from shared.
 * 2. Update RLS policies to allow teammates to view lists in workspace_read/workspace_write and
 *    mutate entries in workspace_write.
 * 3. Enforce that list ownership mutations (DELETE list, PATCH list properties, PATCH /:id/sharing) remain
 *    strictly reserved to owner_id. Non-owners get 403 on PATCH and 404 on DELETE (RLS).
 * 4. PATCH /v1/prospecting-lists/:id/sharing route for owner to update sharingScope.
 * 5. Deduplication clustering engine that groups multi-platform entries for the same creator across networks
 *    during CRM handoff (POST /v1/prospecting-lists/:id/crm-handoff?deduplicate=true).
 *
 * Explicitly out of scope:
 * - Frontend UI implementation (Story 17.2 or separate frontend story).
 * - Modifying core authors table schema.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { registerCRMConnector } from '../../src/connectors/crm/crmRegistry';

jest.setTimeout(60000);

const app = createApp();

let capturedCRMCalls: { payloads: any[]; options?: any }[] = [];

class MockDeduplicationCRMConnector {
  public readonly id = 'test-dedup-crm';
  public readonly provider = 'hubspot' as const;

  public async validateCredentials(): Promise<boolean> {
    return true;
  }

  public async status() {
    return { isActive: true, provider: this.provider };
  }

  public async pushEntity(): Promise<any> {
    throw new Error('pushEntity not called for batch');
  }

  public async pushProspectsBatch(_ctx: any, payloads: any[], options?: any): Promise<any[]> {
    capturedCRMCalls.push({ payloads, options });
    return payloads.map((p) => ({
      entryId: p.entryId,
      crmRecordId: `crm-rec-${p.authorId}`,
      crmRecordUrl: `https://crm.example.com/lead/${p.authorId}`,
      entityType: 'lead',
    }));
  }
}

registerCRMConnector(new MockDeduplicationCRMConnector() as any);

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

async function createAuthorFixture(
  tenantId: string,
  platformId: string,
  handle: string,
  displayName: string,
  scores: { engagement: number; influence: number }
): Promise<{ id: string }> {
  const { rows } = await getAdminPool().query<{ id: string }>(
    `INSERT INTO authors (
      tenant_id, platform_id, external_author_id, handle, display_name,
      follower_count, engagement_score, influence_score
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      tenantId,
      platformId,
      `ext-${randomUUID()}`,
      handle,
      displayName,
      5000,
      scores.engagement,
      scores.influence,
    ]
  );
  return rows[0];
}

describe('Story 17.1 — Prospecting List Model Refinements & Deduplicated CRM Sync Contract', () => {
  beforeEach(() => {
    capturedCRMCalls = [];
  });

  it('AC1: Schema refinement: sharing_scope defaults to private, accepts workspace_read / workspace_write, backfills shared=true', async () => {
    const tenant = await createTenantFixture(`T-17.1-schema-${randomUUID()}`);
    const owner = await createInvitedUser(tenant.id, { email: `owner-${randomUUID()}@example.com` });

    // 1. Default creation has sharing_scope = 'private'
    const defaultRes = await request(app)
      .post('/v1/prospecting-lists')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ name: 'Private Lead List' });

    expect(defaultRes.status).toBe(201);
    expect(defaultRes.body.sharing_scope).toBe('private');
    expect(defaultRes.body.shared).toBe(false);

    // 2. Explicit workspace_write creation
    const writeRes = await request(app)
      .post('/v1/prospecting-lists')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ name: 'Collaborative Pipeline', sharingScope: 'workspace_write' });

    expect(writeRes.status).toBe(201);
    expect(writeRes.body.sharing_scope).toBe('workspace_write');
    expect(writeRes.body.shared).toBe(true);

    // 3. Legacy shared: true maps to workspace_read
    const legacyRes = await request(app)
      .post('/v1/prospecting-lists')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ name: 'Legacy Shared List', shared: true });

    expect(legacyRes.status).toBe(201);
    expect(legacyRes.body.sharing_scope).toBe('workspace_read');
    expect(legacyRes.body.shared).toBe(true);
  });

  it('AC2/AC3: Teammate can view lists and entries in workspace_read, but cannot add, update, or delete entries (returns 404)', async () => {
    const tenant = await createTenantFixture(`T-17.1-read-${randomUUID()}`);
    const owner = await createInvitedUser(tenant.id, { email: `owner-${randomUUID()}@example.com` });
    const teammate = await createInvitedUser(tenant.id, { email: `teammate-${randomUUID()}@example.com` });
    const author = await createAuthorFixture(tenant.id, 'twitter', 'techlead', 'Tech Lead', { engagement: 80, influence: 85 });

    // Owner creates workspace_read list and adds entry
    const listRes = await request(app)
      .post('/v1/prospecting-lists')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ name: 'Read Only Team List', sharingScope: 'workspace_read' });
    const listId = listRes.body.id;

    const entryRes = await request(app)
      .post(`/v1/prospecting-lists/${listId}/entries`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ author_id: author.id, platform_id: 'twitter', topic: 'Architecture' });
    const entryId = entryRes.body.id;

    // Teammate can read list and entries
    const getListRes = await request(app)
      .get(`/v1/prospecting-lists/${listId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: teammate.id, role: 'tenant_user' }));
    expect(getListRes.status).toBe(200);
    expect(getListRes.body.sharing_scope).toBe('workspace_read');

    const getEntriesRes = await request(app)
      .get(`/v1/prospecting-lists/${listId}/entries`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: teammate.id, role: 'tenant_user' }));
    expect(getEntriesRes.status).toBe(200);
    expect(getEntriesRes.body.entries.length).toBe(1);

    // Teammate attempts to add entry -> 404
    const author2 = await createAuthorFixture(tenant.id, 'twitter', 'techlead2', 'Tech Lead 2', { engagement: 70, influence: 75 });
    const addFailRes = await request(app)
      .post(`/v1/prospecting-lists/${listId}/entries`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: teammate.id, role: 'tenant_user' }))
      .send({ author_id: author2.id, platform_id: 'twitter' });
    expect(addFailRes.status).toBe(404);

    // Teammate attempts to update entry -> 404
    const updateFailRes = await request(app)
      .patch(`/v1/prospecting-lists/${listId}/entries/${entryId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: teammate.id, role: 'tenant_user' }))
      .send({ notes: 'Unauthorized edit' });
    expect(updateFailRes.status).toBe(404);

    // Teammate attempts to delete entry -> 404
    const deleteFailRes = await request(app)
      .delete(`/v1/prospecting-lists/${listId}/entries/${entryId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: teammate.id, role: 'tenant_user' }));
    expect(deleteFailRes.status).toBe(404);
  });

  it('AC4: Teammate can add, update, and delete entries when sharing_scope is workspace_write', async () => {
    const tenant = await createTenantFixture(`T-17.1-write-${randomUUID()}`);
    const owner = await createInvitedUser(tenant.id, { email: `owner-${randomUUID()}@example.com` });
    const teammate = await createInvitedUser(tenant.id, { email: `teammate-${randomUUID()}@example.com` });
    const author = await createAuthorFixture(tenant.id, 'linkedin', 'janedoe', 'Jane Doe', { engagement: 90, influence: 92 });

    // Owner creates workspace_write list
    const listRes = await request(app)
      .post('/v1/prospecting-lists')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ name: 'Collaborative Selling', sharingScope: 'workspace_write' });
    const listId = listRes.body.id;

    // Teammate adds entry
    const addRes = await request(app)
      .post(`/v1/prospecting-lists/${listId}/entries`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: teammate.id, role: 'tenant_user' }))
      .send({
        author_id: author.id,
        platform_id: 'linkedin',
        relationship_stage: 'contacted',
        notes: 'Reached out via InMail',
      });
    expect(addRes.status).toBe(201);
    expect(addRes.body.relationship_stage).toBe('contacted');
    const entryId = addRes.body.id;

    // Teammate updates entry
    const updateRes = await request(app)
      .patch(`/v1/prospecting-lists/${listId}/entries/${entryId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: teammate.id, role: 'tenant_user' }))
      .send({
        relationship_stage: 'engaged',
        notes: 'Had a discovery call',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.relationship_stage).toBe('engaged');
    expect(updateRes.body.notes).toBe('Had a discovery call');

    // Teammate deletes entry
    const deleteRes = await request(app)
      .delete(`/v1/prospecting-lists/${listId}/entries/${entryId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: teammate.id, role: 'tenant_user' }));
    expect(deleteRes.status).toBe(204);

    // Verify entry is gone
    const verifyRes = await request(app)
      .get(`/v1/prospecting-lists/${listId}/entries`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }));
    expect(verifyRes.body.entries.length).toBe(0);
  });

  it('AC5: Teammate cannot mutate list properties or delete list even under workspace_write scope', async () => {
    const tenant = await createTenantFixture(`T-17.1-guard-${randomUUID()}`);
    const owner = await createInvitedUser(tenant.id, { email: `owner-${randomUUID()}@example.com` });
    const teammate = await createInvitedUser(tenant.id, { email: `teammate-${randomUUID()}@example.com` });

    const listRes = await request(app)
      .post('/v1/prospecting-lists')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ name: 'Protected List', sharingScope: 'workspace_write' });
    const listId = listRes.body.id;

    // Teammate attempts to rename list -> 404 via RLS isolation (no non-owner write on parent list)
    const patchRes = await request(app)
      .patch(`/v1/prospecting-lists/${listId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: teammate.id, role: 'tenant_user' }))
      .send({ name: 'Hijacked List' });
    expect(patchRes.status).toBe(404);

    // Teammate attempts to change sharing scope -> 403 Forbidden
    const shareRes = await request(app)
      .patch(`/v1/prospecting-lists/${listId}/sharing`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: teammate.id, role: 'tenant_user' }))
      .send({ sharingScope: 'private' });
    expect(shareRes.status).toBe(403);

    // Teammate attempts to delete list -> 404 via RLS
    const deleteRes = await request(app)
      .delete(`/v1/prospecting-lists/${listId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: teammate.id, role: 'tenant_user' }));
    expect(deleteRes.status).toBe(404);
  });

  it('AC6: Owner can update sharing scope via PATCH /v1/prospecting-lists/:id/sharing', async () => {
    const tenant = await createTenantFixture(`T-17.1-sharing-api-${randomUUID()}`);
    const owner = await createInvitedUser(tenant.id, { email: `owner-${randomUUID()}@example.com` });

    const listRes = await request(app)
      .post('/v1/prospecting-lists')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ name: 'Lifecycle List', sharingScope: 'private' });
    const listId = listRes.body.id;

    // Owner promotes to workspace_read
    const readRes = await request(app)
      .patch(`/v1/prospecting-lists/${listId}/sharing`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ sharingScope: 'workspace_read' });
    expect(readRes.status).toBe(200);
    expect(readRes.body.sharing_scope).toBe('workspace_read');
    expect(readRes.body.shared).toBe(true);

    // Owner promotes to workspace_write
    const writeRes = await request(app)
      .patch(`/v1/prospecting-lists/${listId}/sharing`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ sharingScope: 'workspace_write' });
    expect(writeRes.status).toBe(200);
    expect(writeRes.body.sharing_scope).toBe('workspace_write');
    expect(writeRes.body.shared).toBe(true);

    // Owner sets back to private
    const privRes = await request(app)
      .patch(`/v1/prospecting-lists/${listId}/sharing`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ sharingScope: 'private' });
    expect(privRes.status).toBe(200);
    expect(privRes.body.sharing_scope).toBe('private');
    expect(privRes.body.shared).toBe(false);

    // Invalid scope returns 400
    const invalidRes = await request(app)
      .patch(`/v1/prospecting-lists/${listId}/sharing`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ sharingScope: 'invalid_scope' });
    expect(invalidRes.status).toBe(400);
  });

  it('AC7: Cross-network author contact deduplication during CRM handoff', async () => {
    const tenant = await createTenantFixture(`T-17.1-dedup-${randomUUID()}`);
    const owner = await createInvitedUser(tenant.id, { email: `owner-${randomUUID()}@example.com` });

    // Seed two author records representing the same person across X/Twitter and LinkedIn (same canonical handle 'alex_investor')
    const authorX = await createAuthorFixture(tenant.id, 'twitter', '@alex_investor', 'Alex River', { engagement: 75, influence: 80 });
    const authorLinkedIn = await createAuthorFixture(tenant.id, 'linkedin', 'alex_investor', 'Alex River', { engagement: 88, influence: 94 });

    // Seed a third distinct author (different person)
    const authorDistinct = await createAuthorFixture(tenant.id, 'twitter', 'sam_cloud', 'Sam Cloud', { engagement: 60, influence: 65 });

    const listRes = await request(app)
      .post('/v1/prospecting-lists')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ name: 'Investors List' });
    const listId = listRes.body.id;

    // Add all three entries
    await request(app)
      .post(`/v1/prospecting-lists/${listId}/entries`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({
        author_id: authorX.id,
        platform_id: 'twitter',
        topic: 'AI Funding',
        notes: 'X engagement note',
        tags: ['investor', 'angel'],
      });

    await request(app)
      .post(`/v1/prospecting-lists/${listId}/entries`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({
        author_id: authorLinkedIn.id,
        platform_id: 'linkedin',
        topic: 'AI Funding',
        notes: 'Connected via LinkedIn',
        tags: ['series-a', 'vc'],
      });

    await request(app)
      .post(`/v1/prospecting-lists/${listId}/entries`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({
        author_id: authorDistinct.id,
        platform_id: 'twitter',
        topic: 'SaaS',
        notes: 'Different person entirely',
        tags: ['devops'],
      });

    // 1. CRM handoff with deduplicate=true
    const dedupHandoffRes = await request(app)
      .post(`/v1/prospecting-lists/${listId}/crm-handoff?deduplicate=true`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({
        crmConnectorId: 'test-dedup-crm',
        caseType: 'lead',
      });

    expect(dedupHandoffRes.status).toBe(200);
    // 3 raw entries clustered into 2 deduplicated contacts!
    expect(dedupHandoffRes.body.pushedCount).toBe(2);
    expect(dedupHandoffRes.body.rawEntriesCount).toBe(3);
    expect(dedupHandoffRes.body.deduplicatedContactsCount).toBe(2);

    // Verify the dispatched payloads to CRM
    expect(capturedCRMCalls.length).toBe(1);
    const dispatchedPayloads = capturedCRMCalls[0].payloads;
    expect(dispatchedPayloads.length).toBe(2);

    // Find the merged Alex contact
    const mergedAlex = dispatchedPayloads.find((p) => p.authorName === 'Alex River');
    expect(mergedAlex).toBeDefined();
    // Engagement and influence scores should be the highest between the two profiles
    expect(mergedAlex.engagementScore).toBe(88);
    expect(mergedAlex.influenceScore).toBe(94);
    // Notes and tags should be merged
    expect(mergedAlex.notes).toContain('X engagement note');
    expect(mergedAlex.notes).toContain('Connected via LinkedIn');
    expect(mergedAlex.tags).toEqual(expect.arrayContaining(['investor', 'angel', 'series-a', 'vc']));
    // Matched handles metadata
    expect(mergedAlex.matchedHandles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ platformId: 'twitter', handle: 'alex_investor' }),
        expect.objectContaining({ platformId: 'linkedin', handle: 'alex_investor' }),
      ])
    );

    // 2. CRM handoff without deduplication (deduplicate=false) preserves all 3 raw entries
    capturedCRMCalls = [];
    const rawHandoffRes = await request(app)
      .post(`/v1/prospecting-lists/${listId}/crm-handoff?deduplicate=false`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({
        crmConnectorId: 'test-dedup-crm',
        caseType: 'lead',
      });

    expect(rawHandoffRes.status).toBe(200);
    expect(rawHandoffRes.body.pushedCount).toBe(3);
    expect(capturedCRMCalls[0].payloads.length).toBe(3);
  });
});
