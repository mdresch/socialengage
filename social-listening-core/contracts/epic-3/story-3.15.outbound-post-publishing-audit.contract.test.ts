// Contract: Story 3.15 (ADR-0075) — Outbound Post Publishing Audit Table and
// POST/GET/DELETE /v1/outbound/posts API.
// See docs/user-stories/epic-3-data-model-storage-and-archival.md#story-315
// and docs/adr/0075-outbound-social-post-publishing.md.
//
// Intent: Story 3.15 — Outbound Post Publishing Audit Table and
// `POST /v1/outbound/posts` API (ADR-0075).
// Scope: migrations/0042_add_outbound_post_columns.sql (new),
//        src/outbound/outboundActivityStore.ts (extend insertPending, add
//        setSent/setFailed/cancel/listPosts/getById, support activity_type='post'),
//        src/http/versions/v1/outboundPostsRouter.ts (new POST/GET/DELETE),
//        src/http/versions/v1/router.ts (mount),
//        .claude/skills/outbound-post/SKILL.md (update),
//        .claude/skills/outbound-engagement/SKILL.md (update),
//        .claude/skills/posts-api/SKILL.md (update).
// Contract to encode: (1) migration adds target_asset_id, target_asset_type,
// payload, scheduled_for, cancelled_at to outbound_activities and widens
// activity_type/status checks to include 'post'/'cancelled'; (2) POST
// /v1/outbound/posts returns 201 with sent rows for immediate dispatch;
// (3) scheduled posts return 201 with pending rows and no publish() call;
// (4) 422 PUBLISH_NOT_AVAILABLE for missing/inactive/unsupported credentials
// or target assets; (5) 429 for rate_limited ClassifiableError from publish();
// (6) GET /v1/outbound/posts lists tenant-scoped post rows and filters by
// status/providerId; (7) DELETE /v1/outbound/posts/:id cancels a pending
// scheduled post; (8) DELETE returns 404 for cross-tenant or unknown rows;
// (9) RLS keeps tenants isolated.
// Explicitly out of scope: real Facebook/LinkedIn publish() implementations
// (Stories 2.29–2.30); media upload (deferred); the background scheduler
// for pending rows (ADR-0098); admin UI (Story 6.39).

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
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

const PROVIDER_ID = 'publishable';

const publishableConnector: SocialConnector = {
  providerId: PROVIDER_ID,
  authMode: 'none',
  deliveryMode: 'poll',
  getRateLimitConfig: () => ({ requestsPerWindow: 100, windowSeconds: 1 }),
  getOutboundRateLimitConfig: () => ({ requestsPerWindow: 100, windowSeconds: 1 }),
  targetAssets: (tenantId: string, _userId: string, _credential: string) => {
    if (tenantId === 'cross-tenant-b') {
      return ['asset-b'];
    }
    return ['asset-1'];
  },
  normalize: () => ({
    externalId: 'p',
    authorExternalId: 'a',
    publishedAt: '2024-01-01T00:00:00Z',
    rawPayload: {},
  }),
  publish: async (_tenantId, _userId, payload, credential) => ({
    externalId: `post-${payload.targetAssetId}`,
    externalUrl: `https://example.com/posts/post-${payload.targetAssetId}?cred=${credential.slice(0, 8)}`,
  }),
};

async function setupCredential(tenantId: string, userId: string): Promise<void> {
  await storeCredential(tenantId, PROVIDER_ID, 'dummy-credential', process.env.KEY_VAULT_KEY_ID!, 'user', userId);
  await setConnectorActivation(tenantId, PROVIDER_ID, 'user', true, userId, userId);
  expect(await isConnectorActive(tenantId, PROVIDER_ID, 'user', userId)).toBe(true);
}

function futureIso(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return d.toISOString();
}

describe('Story 3.15 — outbound_activities post columns (AC1/AC2)', () => {
  it('has the new columns and widened activity_type/status constraints', async () => {
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
        'target_asset_id',
        'target_asset_type',
        'body',
        'payload',
        'status',
        'external_id',
        'external_url',
        'error_code',
        'scheduled_for',
        'created_at',
        'sent_at',
        'failed_at',
        'cancelled_at',
      ])
    );

    const { rows: constraints } = await getAdminPool().query<{ constraint_name: string; definition: string }>(
      `SELECT conname AS constraint_name, pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE conrelid = 'outbound_activities'::regclass AND contype = 'c'`
    );
    const activityType = constraints.find((c) => c.definition.includes('activity_type'));
    const status = constraints.find((c) => c.definition.includes('status'));
    expect(activityType?.definition).toMatch(/'post'/);
    expect(status?.definition).toMatch(/'cancelled'/);
  });
});

describe('Story 3.15 — POST /v1/outbound/posts', () => {
  const app = createApp();

  it('AC3/AC6: creates a sent post and returns 201 with the row', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector(publishableConnector);
    await setupCredential(tenantId, userId);

    const res = await request(app)
      .post('/v1/outbound/posts')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        text: 'Hello, outbound world!',
        targets: [{ providerId: PROVIDER_ID, targetAssetId: 'asset-1' }],
      });

    expect(res.status).toBe(201);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0].id).toBeDefined();
    expect(res.body.posts[0].postId).toBeNull();
    expect(res.body.posts[0].userId).toBe(userId);
    expect(res.body.posts[0].providerId).toBe(PROVIDER_ID);
    expect(res.body.posts[0].activityType).toBe('post');
    expect(res.body.posts[0].targetAssetId).toBe('asset-1');
    expect(res.body.posts[0].body).toBe('Hello, outbound world!');
    expect(res.body.posts[0].status).toBe('sent');
    expect(res.body.posts[0].externalId).toBe('post-asset-1');
    expect(res.body.posts[0].externalUrl).toContain('https://example.com/posts/post-asset-1');
    expect(res.body.posts[0].errorCode).toBeNull();
    expect(res.body.posts[0].createdAt).toBeDefined();
    expect(res.body.posts[0].sentAt).toBeDefined();
    expect(res.body.posts[0].failedAt).toBeNull();
  });

  it('AC5: creates a scheduled post and returns 201 with pending rows', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector(publishableConnector);
    await setupCredential(tenantId, userId);

    const scheduledFor = futureIso();

    const res = await request(app)
      .post('/v1/outbound/posts')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        text: 'Scheduled greeting',
        targets: [{ providerId: PROVIDER_ID, targetAssetId: 'asset-1' }],
        scheduledFor,
      });

    expect(res.status).toBe(201);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0].status).toBe('pending');
    expect(res.body.posts[0].scheduledFor).toBe(scheduledFor);
    expect(res.body.posts[0].externalId).toBeNull();
    expect(res.body.posts[0].externalUrl).toBeNull();
  });

  it('AC4: returns 422 PUBLISH_NOT_AVAILABLE when the user has no active credential', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector(publishableConnector);

    const res = await request(app)
      .post('/v1/outbound/posts')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        text: 'No credential',
        targets: [{ providerId: PROVIDER_ID, targetAssetId: 'asset-1' }],
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('PUBLISH_NOT_AVAILABLE');
  });

  it('AC4: returns 422 PUBLISH_NOT_AVAILABLE when the connector has no publish() implementation', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector({
      ...publishableConnector,
      providerId: 'no-publish',
      publish: undefined,
    });
    await storeCredential(tenantId, 'no-publish', 'dummy', process.env.KEY_VAULT_KEY_ID!, 'user', userId);
    await setConnectorActivation(tenantId, 'no-publish', 'user', true, userId, userId);

    const res = await request(app)
      .post('/v1/outbound/posts')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        text: 'Unsupported',
        targets: [{ providerId: 'no-publish', targetAssetId: 'asset-1' }],
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('PUBLISH_NOT_AVAILABLE');
  });

  it('AC4: returns 422 when targetAssetId is not in the caller enumerated asset list', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector(publishableConnector);
    await setupCredential(tenantId, userId);

    const res = await request(app)
      .post('/v1/outbound/posts')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        text: 'Wrong asset',
        targets: [{ providerId: PROVIDER_ID, targetAssetId: 'unknown-asset' }],
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('PUBLISH_NOT_AVAILABLE');
  });

  it('AC9: returns 429 when publish() throws a rate_limited ClassifiableError', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector({
      ...publishableConnector,
      publish: async () => {
        throw new ClassifiableError('rate_limited', 'platform quota');
      },
    });
    await setupCredential(tenantId, userId);

    const res = await request(app)
      .post('/v1/outbound/posts')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        text: 'Too fast',
        targets: [{ providerId: PROVIDER_ID, targetAssetId: 'asset-1' }],
      });

    expect(res.status).toBe(429);
    expect(res.body.posts[0].errorCode).toBe('rate_limited');
    expect(res.body.posts[0].status).toBe('failed');
  });

  it('rejects an empty text body with 422', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector(publishableConnector);
    await setupCredential(tenantId, userId);

    const res = await request(app)
      .post('/v1/outbound/posts')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        text: '   ',
        targets: [{ providerId: PROVIDER_ID, targetAssetId: 'asset-1' }],
      });

    expect(res.status).toBe(422);
  });
});

describe('Story 3.15 — GET /v1/outbound/posts', () => {
  const app = createApp();

  it('AC7: lists tenant-scoped outbound posts newest-first and filters by status/provider', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector(publishableConnector);
    await setupCredential(tenantId, userId);

    const scheduledFor = futureIso();

    await request(app)
      .post('/v1/outbound/posts')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        text: 'First',
        targets: [{ providerId: PROVIDER_ID, targetAssetId: 'asset-1' }],
      });

    const scheduled = await request(app)
      .post('/v1/outbound/posts')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        text: 'Second',
        targets: [{ providerId: PROVIDER_ID, targetAssetId: 'asset-1' }],
        scheduledFor,
      });

    const all = await request(app)
      .get('/v1/outbound/posts')
      .set('X-Test-Identity', identityHeader(tenantId, userId));
    expect(all.status).toBe(200);
    expect(all.body.posts).toHaveLength(2);
    expect(all.body.posts[0].status).toBe('pending');
    expect(all.body.posts[1].status).toBe('sent');

    const sentOnly = await request(app)
      .get(`/v1/outbound/posts?status=sent`)
      .set('X-Test-Identity', identityHeader(tenantId, userId));
    expect(sentOnly.status).toBe(200);
    expect(sentOnly.body.posts).toHaveLength(1);
    expect(sentOnly.body.posts[0].status).toBe('sent');

    const pendingOnly = await request(app)
      .get(`/v1/outbound/posts?providerId=${PROVIDER_ID}&status=pending`)
      .set('X-Test-Identity', identityHeader(tenantId, userId));
    expect(pendingOnly.status).toBe(200);
    expect(pendingOnly.body.posts).toHaveLength(1);
    expect(pendingOnly.body.posts[0].id).toBe(scheduled.body.posts[0].id);
  });
});

describe('Story 3.15 — DELETE /v1/outbound/posts/:id', () => {
  const app = createApp();

  it('AC8: cancels a pending scheduled post and returns 200 with the cancelled row', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    registerSocialConnector(publishableConnector);
    await setupCredential(tenantId, userId);

    const created = await request(app)
      .post('/v1/outbound/posts')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        text: 'Cancel me',
        targets: [{ providerId: PROVIDER_ID, targetAssetId: 'asset-1' }],
        scheduledFor: futureIso(),
      });

    expect(created.status).toBe(201);
    const id = created.body.posts[0].id;

    const res = await request(app)
      .delete(`/v1/outbound/posts/${id}`)
      .set('X-Test-Identity', identityHeader(tenantId, userId));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect(res.body.cancelledAt).toBeDefined();
  });

  it('AC8: returns 404 for an outbound post belonging to another tenant', async () => {
    const { tenantId: tenantA, userId: userA } = await makeTenantWithUser();
    const { tenantId: tenantB, userId: userB } = await makeTenantWithUser();
    registerSocialConnector(publishableConnector);
    await setupCredential(tenantA, userA);

    const created = await request(app)
      .post('/v1/outbound/posts')
      .set('X-Test-Identity', identityHeader(tenantA, userA))
      .send({
        text: 'Tenant A only',
        targets: [{ providerId: PROVIDER_ID, targetAssetId: 'asset-1' }],
        scheduledFor: futureIso(),
      });

    const id = created.body.posts[0].id;

    const res = await request(app)
      .delete(`/v1/outbound/posts/${id}`)
      .set('X-Test-Identity', identityHeader(tenantB, userB));

    expect(res.status).toBe(404);
  });
});
