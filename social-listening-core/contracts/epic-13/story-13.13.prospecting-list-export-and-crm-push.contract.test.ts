/**
 * Contract: Story 13.13 (ADR-0117, BRD-0117, FDD-0117) — Prospecting list export and CRM push.
 * See docs/user-stories/epic-13-adr-0109-to-0117.md#story-1313
 *
 * Intent:
 *   Add `GET /v1/prospecting-lists/:id/export(.csv)` and `POST /v1/prospecting-lists/:id/crm-handoff`
 *   so a Social-Selling-Strategist can export or push a curated prospecting list to a CRM.
 *   The export is metadata-only, bounded by ADR-0111, and the CRM handoff reuses the existing
 *   `CRMConnector` provider abstraction, mapping a batch of `ProspectingListEntryPayload` records
 *   to leads/contacts. Each handoff is recorded in `outbound_activities` as `activity_type='crm_prospect'`.
 *
 * Scope:
 *   - social-listening-core/src/prospecting/prospectingListStore.ts
 *   - social-listening-core/src/prospecting/prospectingListExportEngine.ts (new)
 *   - social-listening-core/src/crm/prospectingCRMHandoffService.ts (new)
 *   - social-listening-core/src/connectors/crm/types.ts
 *   - social-listening-core/src/connectors/crm/hubspotConnector.ts
 *   - social-listening-core/src/connectors/crm/salesforceConnector.ts
 *   - social-listening-core/src/connectors/crm/dynamics365Connector.ts
 *   - social-listening-core/src/http/versions/v1/prospectingListsRouter.ts
 *   - social-listening-core/migrations/0072_add_crm_prospect_activity_type.sql (new)
 *   - social-listening-core/migrations/0073_add_prospecting_list_entry_author_name_and_public_url.sql (new)
 *   - social-listening-core/.claude/skills/prospecting-lists/SKILL.md
 *   - social-listening-core/.claude/skills/crm-connector/SKILL.md
 *
 * Contract to encode:
 *   (1) `GET /v1/prospecting-lists/:id/export.csv` returns metadata-only CSV with columns
 *       author_id, author_name, platform_id, public_url, topic, engagement_score, authenticity_score,
 *       influence_score, relationship_stage, notes, tags. Phone and email columns are absent.
 *   (2) Synchronous export supports up to 5,000 rows; `POST /v1/prospecting-lists/:id/export` is async
 *       and supports up to 100,000 rows; limits outside these bounds return 400/422.
 *   (3) `POST /v1/prospecting-lists/:id/crm-handoff` accepts crmConnectorId, caseType='lead',
 *       optional selectedEntryIds, optional customFields, and returns outboundActivityIds, pushedCount,
 *       skippedCount, and an optional crmUrl.
 *   (4) The `CRMConnector` receives a batch of `ProspectingListEntryPayload` objects and maps them
 *       to the provider's lead/contact object (HubSpot contacts, Salesforce Lead, Dynamics lead).
 *   (5) Each push writes one `outbound_activities` row with `activity_type='crm_prospect'`.
 *   (6) Handoffs are processed in chunks of no more than 50 entries per `pushProspectsBatch` call.
 *   (7) Re-pushing the same author to the same CRM connector updates the existing record where
 *       the connector supports it (verified with HubSpot).
 *   (8) Only the list owner (per ADR-0086 RLS) can export or push; non-owners and tenant_admins
 *       without owner rights receive 404.
 *   (9) Export and CRM-handoff routes respect `requireFeatureGate('exports')` and
 *       `requireFeatureGate('prospecting_crm')` respectively.
 *
 * Explicitly out of scope / deferred:
 *   - Per-list "edit share" permission table (ADR-0129, Proposed). ADR-0086's owner-only sharing
 *     model is authoritative until ADR-0129 is accepted.
 *   - Tenant-admin override for handoff. ADR-0086 explicitly rejects tenant_admin override for
 *     list mutations; handoff is treated as an owner-only action for v1.
 *   - Single-entry CRM push, PDF/Excel export, scheduled pushes, and CRM campaign/list creation.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { registerCRMConnector } from '../../src/connectors/crm/crmRegistry';
import { drainActiveProspectingExportJobs } from '../../src/prospecting/prospectingListExportEngine';
import { resetExportRateLimits } from '../../src/posts/exportRateLimit';

jest.setTimeout(60000);

const app = createApp();

let testBatchCalls: { payloads: any[]; options?: any }[] = [];

class TestBatchConnector {
  public readonly id = 'test-batch';
  public readonly provider = 'hubspot' as const;

  public async validateCredentials(): Promise<boolean> {
    return true;
  }

  public async status() {
    return { isActive: true, provider: this.provider };
  }

  public async pushEntity(): Promise<any> {
    throw new Error('pushEntity should not be called for batch prospecting');
  }

  public async pushProspectsBatch(_ctx: any, payloads: any[], options?: any): Promise<any[]> {
    testBatchCalls.push({ payloads, options });
    return payloads.map((p) => ({
      entryId: p.entryId,
      crmRecordId: `test-${p.authorId}`,
      crmRecordUrl: `https://test.example.com/record/${p.authorId}`,
      entityType: 'lead',
    }));
  }
}

registerCRMConnector(new TestBatchConnector() as any);

afterAll(async () => {
  await drainActiveProspectingExportJobs();
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

beforeEach(() => {
  testBatchCalls = [];
  resetExportRateLimits();
  process.env.EXPORT_SYNC_ROW_LIMIT = '5000';
  process.env.EXPORT_ASYNC_CSV_MAX_ROWS = '100000';
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

async function createUser(tenantId: string, role: 'tenant_user' | 'tenant_admin' = 'tenant_user') {
  return createInvitedUser(tenantId, { email: `user-${randomUUID()}@example.com`, role });
}

async function createAuthorFixture(
  tenantId: string,
  handle: string,
  overrides: { displayName?: string; platform?: string; rawProfile?: Record<string, any> } = {}
) {
  const { rows } = await getAdminPool().query<{ id: string }>(
    `INSERT INTO authors (tenant_id, platform_id, external_author_id, handle, display_name, follower_count, raw_profile)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      tenantId,
      overrides.platform ?? 'twitter',
      `ext-${randomUUID()}`,
      handle,
      overrides.displayName ?? `Display ${handle}`,
      1000,
      JSON.stringify(overrides.rawProfile ?? {}),
    ]
  );
  return rows[0];
}

async function createList(tenantId: string, ownerId: string, name: string, shared = false) {
  const res = await request(app)
    .post('/v1/prospecting-lists')
    .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: ownerId, role: 'tenant_user' }))
    .send({ name, shared });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

async function addEntry(
  tenantId: string,
  ownerId: string,
  listId: string,
  authorId: string,
  overrides: Record<string, any> = {}
) {
  const res = await request(app)
    .post(`/v1/prospecting-lists/${listId}/entries`)
    .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: ownerId, role: 'tenant_user' }))
    .send({
      author_id: authorId,
      platform_id: 'twitter',
      topic: 'Fintech Cloud',
      engagement_score: 88.5,
      authenticity_score: 95.0,
      influence_score: 78.2,
      relationship_stage: 'new',
      notes: 'Spoke at conference',
      tags: ['fintech', 'speaker'],
      ...overrides,
    });
  expect(res.status).toBe(201);
  return res.body;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split('\n').filter((l) => l.length > 0);
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map((line) => line.split(','));
  return { headers, rows };
}

async function getOutboundProspectingActivities(tenantId: string, listId: string) {
  const { rows } = await getAdminPool().query(
    `SELECT id, tenant_id, author_id, provider_id, activity_type, status, external_id, external_url, payload
     FROM outbound_activities
     WHERE tenant_id = $1 AND activity_type = 'crm_prospect' AND payload->>'prospectingListId' = $2
     ORDER BY created_at ASC`,
    [tenantId, listId]
  );
  return rows;
}

async function pollForExportStatus(
  jobId: string,
  tenantId: string,
  userId: string,
  target: string,
  timeoutMs = 20000
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const res = await request(app)
      .get(`/v1/posts/exports/${jobId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId, role: 'tenant_user' }));
    if (res.status === 200 && res.body.status === target) {
      return res.body;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for export job ${jobId} to reach status ${target}`);
}

async function seedListWithEntries(
  tenantId: string,
  ownerId: string,
  count: number,
  shared = false
): Promise<{ listId: string; entries: any[]; authors: any[] }> {
  const listId = await createList(tenantId, ownerId, `List ${randomUUID()}`, shared);
  const authors: any[] = [];
  const entries: any[] = [];
  for (let i = 0; i < count; i++) {
    const author = await createAuthorFixture(tenantId, `lead-${i}`);
    authors.push(author);
    const entry = await addEntry(tenantId, ownerId, listId, author.id, {
      author_name: `Lead ${i}`,
      public_url: `https://x.com/lead${i}`,
      notes: i === 0 ? 'Call me at 555-0199' : `Note ${i}`,
      tags: [`tag-${i}`],
    });
    entries.push(entry);
  }
  return { listId, entries, authors };
}

describe('Story 13.13 — Prospecting list export and CRM push', () => {
  it('AC1: GET /v1/prospecting-lists/:id/export.csv returns metadata-only columns and excludes phone/email', async () => {
    const tenant = await createTenantFixture(`T-13.13-ac1-${randomUUID()}`);
    const owner = await createUser(tenant.id);
    const { listId } = await seedListWithEntries(tenant.id, owner.id, 1);

    const res = await request(app)
      .get(`/v1/prospecting-lists/${listId}/export.csv`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(/attachment/);

    const { headers, rows } = parseCsv(res.text);
    expect(headers).toEqual([
      'author_id',
      'author_name',
      'platform_id',
      'public_url',
      'topic',
      'engagement_score',
      'authenticity_score',
      'influence_score',
      'relationship_stage',
      'notes',
      'tags',
    ]);
    expect(headers).not.toContain('phone');
    expect(headers).not.toContain('email');
    expect(rows.length).toBeGreaterThanOrEqual(1);

    const row = rows[0];
    expect(row[headers.indexOf('author_name')]).toBe('Lead 0');
    expect(row[headers.indexOf('platform_id')]).toBe('twitter');
    expect(row[headers.indexOf('public_url')]).toBe('https://x.com/lead0');
    expect(row[headers.indexOf('topic')]).toBe('Fintech Cloud');
    expect(row[headers.indexOf('notes')]).toBe('Call me at 555-0199');
  });

  it('AC2: sync export is bounded to 5,000 rows; async export supports up to 100,000 rows', async () => {
    const tenant = await createTenantFixture(`T-13.13-ac2-${randomUUID()}`);
    const owner = await createUser(tenant.id);
    const { listId, entries } = await seedListWithEntries(tenant.id, owner.id, 2);

    // Sync within the limit returns CSV
    const syncRes = await request(app)
      .get(`/v1/prospecting-lists/${listId}/export.csv?limit=2`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }));
    expect(syncRes.status).toBe(200);
    expect(syncRes.text.split('\n').filter((l) => l.length > 0).length).toBeGreaterThanOrEqual(3);

    // Sync above the limit is rejected
    const overSyncRes = await request(app)
      .get(`/v1/prospecting-lists/${listId}/export.csv?limit=5001`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }));
    expect(overSyncRes.status).toBe(400);
    expect(overSyncRes.body.code).toBe('INVALID_LIMIT');

    // Async above the hard cap is rejected
    const overAsyncRes = await request(app)
      .post(`/v1/prospecting-lists/${listId}/export`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ limit: 100001 });
    expect(overAsyncRes.status).toBe(422);
    expect(overAsyncRes.body.code).toBe('EXPORT_TOO_LARGE');

    // Async within the limit is accepted and creates an export job
    const asyncRes = await request(app)
      .post(`/v1/prospecting-lists/${listId}/export`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ limit: 6000 });
    expect(asyncRes.status).toBe(202);
    expect(asyncRes.body).toMatchObject({
      jobId: expect.any(String),
      status: 'pending',
      statusUrl: expect.stringContaining(`/v1/posts/exports/${asyncRes.body.jobId}`),
    });

    const status = await pollForExportStatus(asyncRes.body.jobId, tenant.id, owner.id, 'ready');
    expect(status.status).toBe('ready');
    expect(status.rowCount).toBe(entries.length);
    expect(status.blobPath).toEqual(expect.any(String));
    expect(status.sha256).toHaveLength(64);
  });

  it('AC3: POST /v1/prospecting-lists/:id/crm-handoff accepts crmConnectorId, caseType=lead, and optional selectedEntryIds', async () => {
    const tenant = await createTenantFixture(`T-13.13-ac3-${randomUUID()}`);
    const owner = await createUser(tenant.id);
    const { listId, entries } = await seedListWithEntries(tenant.id, owner.id, 2);

    const res = await request(app)
      .post(`/v1/prospecting-lists/${listId}/crm-handoff`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({
        crmConnectorId: 'test-batch',
        caseType: 'lead',
        selectedEntryIds: [entries[0].id],
        customFields: { source: 'prospecting-list' },
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      outboundActivityIds: [expect.any(String)],
      pushedCount: 1,
      skippedCount: 0,
    });

    // Invalid caseType is rejected
    const invalidRes = await request(app)
      .post(`/v1/prospecting-lists/${listId}/crm-handoff`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ crmConnectorId: 'test-batch', caseType: 'opportunity' });
    expect(invalidRes.status).toBe(400);
  });

  it('AC4: CRMConnector receives a batch of ProspectingListEntryPayload and maps to the provider lead object', async () => {
    const tenant = await createTenantFixture(`T-13.13-ac4-${randomUUID()}`);
    const owner = await createUser(tenant.id);
    const { listId, entries } = await seedListWithEntries(tenant.id, owner.id, 2);

    for (const provider of ['hubspot', 'salesforce', 'dynamics365']) {
      const res = await request(app)
        .post(`/v1/prospecting-lists/${listId}/crm-handoff`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
        .send({ crmConnectorId: provider, caseType: 'lead' });

      expect(res.status).toBe(200);
      expect(res.body.pushedCount).toBe(entries.length);
      expect(res.body.skippedCount).toBe(0);
      expect(res.body.crmUrl).toEqual(expect.any(String));

      const activities = await getOutboundProspectingActivities(tenant.id, listId);
      const providerActivities = activities.filter((a: any) => a.provider_id === provider);
      expect(providerActivities.length).toBeGreaterThanOrEqual(entries.length);
    }
  });

  it('AC5: each CRM handoff writes an outbound_activities row with activity_type=crm_prospect', async () => {
    const tenant = await createTenantFixture(`T-13.13-ac5-${randomUUID()}`);
    const owner = await createUser(tenant.id);
    const { listId, entries } = await seedListWithEntries(tenant.id, owner.id, 2);

    const res = await request(app)
      .post(`/v1/prospecting-lists/${listId}/crm-handoff`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ crmConnectorId: 'test-batch', caseType: 'lead' });

    expect(res.status).toBe(200);
    expect(res.body.outboundActivityIds.length).toBe(entries.length);

    const activities = await getOutboundProspectingActivities(tenant.id, listId);
    expect(activities.length).toBe(entries.length);
    for (const a of activities) {
      expect(a.activity_type).toBe('crm_prospect');
      expect(a.status).toBe('sent');
      expect(a.external_id).toEqual(expect.any(String));
      expect(a.external_url).toEqual(expect.any(String));
      expect(a.payload).toMatchObject({
        prospectingListId: listId,
        authorId: expect.any(String),
        tags: expect.any(Array),
      });
    }
  });

  it('AC6: handoffs are chunked into batches of no more than 50 entries per pushProspectsBatch call', async () => {
    const tenant = await createTenantFixture(`T-13.13-ac6-${randomUUID()}`);
    const owner = await createUser(tenant.id);
    const { listId, entries } = await seedListWithEntries(tenant.id, owner.id, 55);

    const res = await request(app)
      .post(`/v1/prospecting-lists/${listId}/crm-handoff`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ crmConnectorId: 'test-batch', caseType: 'lead' });

    expect(res.status).toBe(200);
    expect(res.body.pushedCount).toBe(55);
    expect(testBatchCalls.length).toBeGreaterThanOrEqual(2);

    const totalPayloads = testBatchCalls.reduce((sum, c) => sum + c.payloads.length, 0);
    expect(totalPayloads).toBe(55);
    for (const call of testBatchCalls) {
      expect(call.payloads.length).toBeLessThanOrEqual(50);
      expect(call.payloads[0]).toMatchObject({
        entryId: expect.any(String),
        authorId: expect.any(String),
        authorName: expect.any(String),
        platformId: expect.any(String),
        topic: expect.any(String),
        engagementScore: expect.any(Number),
        authenticityScore: expect.any(Number),
        influenceScore: expect.any(Number),
        relationshipStage: expect.any(String),
        notes: expect.any(String),
        tags: expect.any(Array),
      });
    }
  });

  it('AC7: re-pushing the same author to the same CRM connector updates the existing record where supported', async () => {
    const tenant = await createTenantFixture(`T-13.13-ac7-${randomUUID()}`);
    const owner = await createUser(tenant.id);
    const { listId, entries } = await seedListWithEntries(tenant.id, owner.id, 2);

    const first = await request(app)
      .post(`/v1/prospecting-lists/${listId}/crm-handoff`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ crmConnectorId: 'hubspot', caseType: 'lead' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/v1/prospecting-lists/${listId}/crm-handoff`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({
        crmConnectorId: 'hubspot',
        caseType: 'lead',
        selectedEntryIds: entries.map((e) => e.id),
      });
    expect(second.status).toBe(200);

    const activities = await getOutboundProspectingActivities(tenant.id, listId);
    const byAuthor: Record<string, any[]> = {};
    for (const a of activities) {
      if (!byAuthor[a.author_id]) byAuthor[a.author_id] = [];
      byAuthor[a.author_id].push(a);
    }

    for (const authorId of Object.keys(byAuthor)) {
      const group = byAuthor[authorId];
      expect(group.length).toBe(2);
      const firstExternalId = group[0].external_id;
      const secondExternalId = group[1].external_id;
      expect(firstExternalId).toBeTruthy();
      expect(secondExternalId).toBe(firstExternalId);
    }
  });

  it('AC8: only the list owner can export or push; non-owners and tenant_admins receive 404', async () => {
    const tenant = await createTenantFixture(`T-13.13-ac8-${randomUUID()}`);
    const owner = await createUser(tenant.id);
    const teammate = await createUser(tenant.id);
    const admin = await createUser(tenant.id, 'tenant_admin');
    const { listId } = await seedListWithEntries(tenant.id, owner.id, 1, true);

    // Teammate cannot export
    const teamExport = await request(app)
      .get(`/v1/prospecting-lists/${listId}/export.csv`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: teammate.id, role: 'tenant_user' }));
    expect(teamExport.status).toBe(404);

    // Tenant admin cannot export
    const adminExport = await request(app)
      .get(`/v1/prospecting-lists/${listId}/export.csv`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'tenant_admin' }));
    expect(adminExport.status).toBe(404);

    // Teammate cannot push
    const teamPush = await request(app)
      .post(`/v1/prospecting-lists/${listId}/crm-handoff`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: teammate.id, role: 'tenant_user' }))
      .send({ crmConnectorId: 'test-batch', caseType: 'lead' });
    expect(teamPush.status).toBe(404);

    // Admin cannot push
    const adminPush = await request(app)
      .post(`/v1/prospecting-lists/${listId}/crm-handoff`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'tenant_admin' }))
      .send({ crmConnectorId: 'test-batch', caseType: 'lead' });
    expect(adminPush.status).toBe(404);

    // Owner can still export
    const ownerExport = await request(app)
      .get(`/v1/prospecting-lists/${listId}/export.csv`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }));
    expect(ownerExport.status).toBe(200);
  });

  it('AC9: export and CRM handoff are feature-gated', async () => {
    const tenant = await createTenantFixture(`T-13.13-ac9-${randomUUID()}`);
    const admin = await createUser(tenant.id, 'tenant_admin');
    const owner = await createUser(tenant.id);
    const { listId } = await seedListWithEntries(tenant.id, owner.id, 1);

    // Disable exports
    await request(app)
      .patch('/v1/tenants/me/features')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'tenant_admin' }))
      .send({ featureGates: { exports: false } });

    const exportRes = await request(app)
      .get(`/v1/prospecting-lists/${listId}/export.csv`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }));
    expect(exportRes.status).toBe(403);
    expect(exportRes.body.code).toBe('FEATURE_NOT_AVAILABLE');

    // Re-enable exports and disable CRM prospecting
    await request(app)
      .patch('/v1/tenants/me/features')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'tenant_admin' }))
      .send({ featureGates: { exports: true, prospecting_crm: false } });

    const pushRes = await request(app)
      .post(`/v1/prospecting-lists/${listId}/crm-handoff`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: owner.id, role: 'tenant_user' }))
      .send({ crmConnectorId: 'test-batch', caseType: 'lead' });
    expect(pushRes.status).toBe(403);
    expect(pushRes.body.code).toBe('FEATURE_NOT_AVAILABLE');
  });
});
