// Contract: Story 3.14 (ADR-0073) — Outbound Reply Audit Table and POST/GET /v1/posts/:id/replies API
// See docs/user-stories/epic-3-data-model-storage-and-archival.md#story-314
// and docs/adr/0073-outbound-reply-to-ingested-posts.md.
//
// Intent: Story 3.14 — Outbound Reply Audit Table and `POST /v1/posts/:id/replies` API (ADR-0073)
// Scope: migrations/0041_create_outbound_activities.sql (new),
//        src/outbound/outboundActivityStore.ts (new — insertPending, setSent, setFailed, listForPost),
//        src/http/versions/v1/postsRouter.ts (add POST /:id/replies and GET /:id/replies),
//        .claude/skills/outbound-engagement/SKILL.md (update),
//        .claude/skills/posts-api/SKILL.md (update).
// Contract to encode: (1) migration creates outbound_activities with the ADR-0073 columns,
// RLS policy, GRANT to app_user, and the (post_id, tenant_id, created_at DESC) index;
// (2) POST /v1/posts/:id/replies creates a 'sent' row and returns 201 with the row when
// the caller has an active Tier-3 credential and the connector implements reply();
// (3) 404 for a cross-tenant or unknown post; (4) 422 REPLY_NOT_AVAILABLE when the
// credential is missing/inactive, the connector is unregistered, or it has no reply();
// (5) 429 for a rate_limited ClassifiableError from the connector's reply() call;
// (6) GET /v1/posts/:id/replies lists the tenant-scoped reply rows newest-first;
// (7) Platform-Admin identity is rejected (403) before reaching the audit table.
// Explicitly out of scope: real Facebook/Instagram/LinkedIn reply() implementations
// (Stories 2.26–2.27); admin UI (Story 6.38); editing/deleting sent replies.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool, getPool } from '../../src/db/pool';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';
import { storeCredential } from '../../src/credentials/credentialStore';
import { setConnectorActivation, isConnectorActive } from '../../src/connectors/connectorActivationStore';
import { registerSocialConnector, __resetRegistryForTests } from '../../src/connectors/registry';
import { __resetGateForTests } from '../../src/connectors/requestGate';
import { SocialConnector } from '../../src/connectors/types';
import { ClassifiableError } from '../../src/ingestion/errorClassification';
import { startIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { insertSocialPost } from '../../src/posts/socialPostStore';

jest.setTimeout(30000);

let testKeyName: string;

beforeAll(async () => {
  testKeyName = `test-key-${randomUUID()}`;
  const key = await getKeyClient().createRsaKey(testKeyName, { keySize: 2048 });
  process.env.KEY_VAULT_KEY_ID = key.id as string;
});

afterAll(async () => {
  try {
    const poller = await getKeyClient().beginDeleteKey(testKeyName);
    await poller.pollUntilDone();
  } catch {
    // Key may already be deleted or vault unavailable — same precedent as other stories.
  }
  __resetRegistryForTests();
  __resetGateForTests();
  await closeAdminPool();
  await closePool();
});

beforeEach(() => {
  __resetRegistryForTests();
  __resetGateForTests();
});

async function makeTenantWithUser(role: 'tenant_admin' | 'tenant_user' = 'tenant_user'): Promise<{
  tenantId: string;
  userId: string;
}> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  const email = `user-${randomUUID()}@example.com`;
  const invited = await createInvitedUser(tenant.id, { email, role });
  await resolveIdentity({ sub: `sub-${invited.id}`, email });
  return { tenantId: tenant.id, userId: invited.id };
}

function identityHeader(tenantId: string, userId: string, role: 'tenant_admin' | 'tenant_user' = 'tenant_user'): string {
  return testIdentityHeaderValue(tenantId, { userId, role });
}

const PROVIDER_ID = 'replyable';

const replyableConnector: SocialConnector = {
  providerId: PROVIDER_ID,
  authMode: 'none',
  deliveryMode: 'poll',
  getRateLimitConfig: () => ({ requestsPerWindow: 10, windowSeconds: 1 }),
  getOutboundRateLimitConfig: () => ({ requestsPerWindow: 10, windowSeconds: 1 }),
  normalize: () => ({
    externalId: 'p',
    authorExternalId: 'a',
    publishedAt: '2024-01-01T00:00:00Z',
    rawPayload: {},
  }),
  reply: async (post, body, credential) => ({
    externalId: `reply-${post.id}`,
    externalUrl: `https://example.com/replies/${post.id}?body=${encodeURIComponent(body)}&cred=${credential.slice(0, 8)}`,
  }),
};

async function setupCredential(tenantId: string, userId: string): Promise<void> {
  await storeCredential(tenantId, PROVIDER_ID, 'dummy-credential', process.env.KEY_VAULT_KEY_ID!, 'user', userId);
  await setConnectorActivation(tenantId, PROVIDER_ID, 'user', true, userId, userId);
  expect(await isConnectorActive(tenantId, PROVIDER_ID, 'user', userId)).toBe(true);
}

async function makePost(tenantId: string, rawPayload: Record<string, unknown> = { providerId: PROVIDER_ID, title: 'Test post' }): Promise<string> {
  const run = await startIngestionRun(tenantId, {
    platformId: PROVIDER_ID,
    triggerType: 'poll',
    connectorVersion: '1.0.0',
  });
  const post = await insertSocialPost({ tenantId, authorId: null, acquisitionId: run.id, rawPayload });
  return post.id;
}

describe('Story 3.14 — outbound_activities schema (AC1)', () => {
  it('has the required columns, RLS enabled, app_user grants, and the post_id/tenant_id/created_at index', async () => {
    const { rows: columns } = await getAdminPool().query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'outbound_activities' ORDER BY ordinal_position`
    );
    const columnNames = columns.map((r) => r.column_name);
    expect(columnNames).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'post_id',
        'provider_id',
        'user_id',
        'credential_id',
        'activity_type',
        'body',
        'status',
        'external_id',
        'external_url',
        'error_code',
        'created_at',
        'sent_at',
        'failed_at',
      ])
    );

    const { rows: rls } = await getAdminPool().query<{ relrowsecurity: boolean }>(
      `SELECT relrowsecurity FROM pg_class WHERE relname = 'outbound_activities'`
    );
    expect(rls[0]?.relrowsecurity).toBe(true);

    const { rows: grants } = await getAdminPool().query<{ privilege_type: string }>(
      `SELECT privilege_type FROM information_schema.role_table_grants WHERE table_name = 'outbound_activities' AND grantee = 'app_user'`
    );
    const privileges = grants.map((r) => r.privilege_type);
    expect(privileges).toEqual(expect.arrayContaining(['SELECT', 'INSERT', 'UPDATE']));

    const { rows: indexes } = await getAdminPool().query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'outbound_activities'`
    );
    expect(indexes.map((r) => r.indexname)).toContain('idx_outbound_activities_post_tenant_created');
  });
});

describe('Story 3.14 — POST /v1/posts/:id/replies', () => {
  const app = createApp();

  it('AC2/AC4: creates a sent reply and returns 201 with the row', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector(replyableConnector);
    await setupCredential(tenantId, userId);
    const postId = await makePost(tenantId);

    const res = await request(app)
      .post(`/v1/posts/${postId}/replies`)
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ body: 'Nice post!' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.postId).toBe(postId);
    expect(res.body.userId).toBe(userId);
    expect(res.body.providerId).toBe(PROVIDER_ID);
    expect(res.body.activityType).toBe('reply');
    expect(res.body.body).toBe('Nice post!');
    expect(res.body.status).toBe('sent');
    expect(res.body.externalId).toBe(`reply-${postId}`);
    expect(res.body.externalUrl).toContain(`https://example.com/replies/${postId}`);
    expect(res.body.errorCode).toBeNull();
    expect(res.body.createdAt).toBeDefined();
    expect(res.body.sentAt).toBeDefined();
    expect(res.body.failedAt).toBeNull();

    const list = await request(app)
      .get(`/v1/posts/${postId}/replies`)
      .set('X-Test-Identity', identityHeader(tenantId, userId));
    expect(list.status).toBe(200);
    expect(list.body.replies).toHaveLength(1);
    expect(list.body.replies[0].id).toBe(res.body.id);
    expect(list.body.replies[0].status).toBe('sent');
  });

  it('AC3: returns 404 for a post belonging to another tenant', async () => {
    const { tenantId: tenantA, userId: userA } = await makeTenantWithUser();
    const { tenantId: tenantB, userId: userB } = await makeTenantWithUser();
    registerSocialConnector(replyableConnector);
    await setupCredential(tenantB, userB);
    const postIdA = await makePost(tenantA, { providerId: PROVIDER_ID, title: 'A' });

    const res = await request(app)
      .post(`/v1/posts/${postIdA}/replies`)
      .set('X-Test-Identity', identityHeader(tenantB, userB))
      .send({ body: 'Should not work' });

    expect(res.status).toBe(404);
    expect(res.body.code || res.body.error).toBeDefined();
  });

  it('AC4: returns 422 REPLY_NOT_AVAILABLE when the user has no credential for the provider', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector(replyableConnector);
    const postId = await makePost(tenantId);

    const res = await request(app)
      .post(`/v1/posts/${postId}/replies`)
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ body: 'No credential' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('REPLY_NOT_AVAILABLE');
  });

  it('AC4: returns 422 REPLY_NOT_AVAILABLE when the connector has no reply() implementation', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector({
      ...replyableConnector,
      providerId: 'no-reply',
      reply: undefined,
    });
    await storeCredential(tenantId, 'no-reply', 'dummy', process.env.KEY_VAULT_KEY_ID!, 'user', userId);
    await setConnectorActivation(tenantId, 'no-reply', 'user', true, userId, userId);
    const postId = await makePost(tenantId, { providerId: 'no-reply', title: 'No reply' });

    const res = await request(app)
      .post(`/v1/posts/${postId}/replies`)
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ body: 'Unsupported' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('REPLY_NOT_AVAILABLE');
  });

  it('AC6: rejects a non-empty body and returns 422', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector(replyableConnector);
    await setupCredential(tenantId, userId);
    const postId = await makePost(tenantId);

    const res = await request(app)
      .post(`/v1/posts/${postId}/replies`)
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ body: '   ' });

    expect(res.status).toBe(422);
  });

  it('AC7: returns 429 when the connector reply() throws a rate_limited ClassifiableError', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector({
      ...replyableConnector,
      reply: async () => {
        throw new ClassifiableError('rate_limited', 'platform quota');
      },
    });
    await setupCredential(tenantId, userId);
    const postId = await makePost(tenantId);

    const res = await request(app)
      .post(`/v1/posts/${postId}/replies`)
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ body: 'Too fast' });

    expect(res.status).toBe(429);
    expect(res.body.errorCode).toBe('rate_limited');
    expect(res.body.status).toBe('failed');
  });
});

describe('Story 3.14 — GET /v1/posts/:id/replies', () => {
  const app = createApp();

  it('AC5: lists tenant-scoped replies newest-first and is empty when none exist', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector(replyableConnector);
    await setupCredential(tenantId, userId);
    const postId = await makePost(tenantId);

    const before = await request(app)
      .get(`/v1/posts/${postId}/replies`)
      .set('X-Test-Identity', identityHeader(tenantId, userId));
    expect(before.status).toBe(200);
    expect(before.body.replies).toEqual([]);

    await request(app)
      .post(`/v1/posts/${postId}/replies`)
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ body: 'First' });
    await request(app)
      .post(`/v1/posts/${postId}/replies`)
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ body: 'Second' });

    const after = await request(app)
      .get(`/v1/posts/${postId}/replies`)
      .set('X-Test-Identity', identityHeader(tenantId, userId));
    expect(after.status).toBe(200);
    expect(after.body.replies).toHaveLength(2);
    expect(after.body.replies[0].body).toBe('Second');
    expect(after.body.replies[1].body).toBe('First');
  });
});
