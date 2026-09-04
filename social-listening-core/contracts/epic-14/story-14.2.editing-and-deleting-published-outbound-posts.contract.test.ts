// Contract: Story 14.2 (ADR-0119) — Editing and deleting published outbound posts (backend)
// See docs/user-stories/epic-14-adr-0118-to-0122.md#story-142
// and docs/adr/0119-editing-and-deleting-published-outbound-posts.md.
//
// Intent: Story 14.2 — Editing and deleting published outbound posts (backend) (ADR-0119)
// Scope:
// - social-listening-core/migrations/0074_create_outbound_activity_revisions_and_add_activity_audit_columns.sql
// - social-listening-core/src/connectors/types.ts
// - social-listening-core/src/outbound/outboundActivityStore.ts
// - social-listening-core/src/outbound/outboundActivityRevisionStore.ts
// - social-listening-core/src/outbound/outboundActivityRevisionService.ts
// - social-listening-core/src/http/versions/v1/outboundActivitiesRouter.ts
// - social-listening-core/src/http/versions/v1/router.ts
// - social-listening-core/.claude/skills/outbound-post-edit-and-delete/SKILL.md
// - social-listening-core/contracts/epic-14/story-14.2.editing-and-deleting-published-outbound-posts.contract.test.ts
// Contract to encode:
// - AC 1: outbound_activity_revisions table records edit/delete mutations with RLS tenant isolation.
// - AC 2: outbound_activities gains edited_at and deleted_at columns updated only on 'applied' revisions; no current_body column; latest applied edit revision is source of truth.
// - AC 3: PATCH /v1/outbound/activities/:id creates edit revision; pending updates in place without connector; sent calls connector.edit?().
// - AC 4: DELETE /v1/outbound/activities/:id creates delete revision for sent, or cancels pending without revision.
// - AC 5: GET /v1/outbound/activities/:id/revisions lists edits and deletes in created_at DESC order.
// - AC 6: Connectors without edit return 422 edit_not_supported; without delete return 422 delete_not_supported.
// - AC 7: Authorization: same user_id or tenant_admin only; other tenant_user or platform_admin gets 403.
// - AC 8: SocialConnector interface defines optional edit?() and delete?() methods.
// Explicitly out of scope:
// - Primary-source verification and per-platform connector implementation of edit/delete.
// - Frontend UI components for composer or post detail drawer edit/delete actions.
// - Retargeting an edit to a different target_asset_id.
// - Media asset re-upload or replacement on edit in v1.
// - Hard deletion of outbound_activities rows.

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
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';
import { registerSocialConnector, __resetRegistryForTests } from '../../src/connectors/registry';
import { __resetGateForTests } from '../../src/connectors/requestGate';
import { SocialConnector, OutboundActivitySummary } from '../../src/connectors/types';
import { insertPending, setSent, getById } from '../../src/outbound/outboundActivityStore';
import { getLatestAppliedEditRevision } from '../../src/outbound/outboundActivityRevisionStore';

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
    // Key may already be deleted or vault unavailable
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

describe('Story 14.2 — Editing and deleting published outbound posts (backend)', () => {
  const PROVIDER_FULL = 'full_support_platform';
  const PROVIDER_NO_EDIT = 'no_edit_platform';
  const PROVIDER_NO_DELETE = 'no_delete_platform';

  let editSpy: jest.Mock;
  let deleteSpy: jest.Mock;

  beforeEach(() => {
    editSpy = jest.fn().mockImplementation(async (activity: OutboundActivitySummary, body: string) => ({
      externalId: `${activity.externalId}_edited`,
      externalUrl: `https://example.com/posts/${activity.externalId}_edited`,
    }));

    deleteSpy = jest.fn().mockImplementation(async (activity: OutboundActivitySummary) => ({
      externalId: activity.externalId,
      externalUrl: `https://example.com/posts/${activity.externalId}`,
    }));

    const fullConnector: SocialConnector = {
      providerId: PROVIDER_FULL,
      authMode: 'none',
      deliveryMode: 'poll',
      getRateLimitConfig: () => ({ requestsPerWindow: 100, windowSeconds: 1 }),
      getOutboundRateLimitConfig: () => ({ requestsPerWindow: 100, windowSeconds: 1 }),
      normalize: () => ({
        externalId: 'ext-1',
        authorExternalId: 'auth-1',
        publishedAt: '2026-01-01T00:00:00Z',
        rawPayload: {},
      }),
      edit: editSpy,
      delete: deleteSpy,
    };

    const noEditConnector: SocialConnector = {
      providerId: PROVIDER_NO_EDIT,
      authMode: 'none',
      deliveryMode: 'poll',
      getRateLimitConfig: () => ({ requestsPerWindow: 100, windowSeconds: 1 }),
      getOutboundRateLimitConfig: () => ({ requestsPerWindow: 100, windowSeconds: 1 }),
      normalize: () => ({
        externalId: 'ext-2',
        authorExternalId: 'auth-2',
        publishedAt: '2026-01-01T00:00:00Z',
        rawPayload: {},
      }),
      delete: deleteSpy,
    };

    const noDeleteConnector: SocialConnector = {
      providerId: PROVIDER_NO_DELETE,
      authMode: 'none',
      deliveryMode: 'poll',
      getRateLimitConfig: () => ({ requestsPerWindow: 100, windowSeconds: 1 }),
      getOutboundRateLimitConfig: () => ({ requestsPerWindow: 100, windowSeconds: 1 }),
      normalize: () => ({
        externalId: 'ext-3',
        authorExternalId: 'auth-3',
        publishedAt: '2026-01-01T00:00:00Z',
        rawPayload: {},
      }),
      edit: editSpy,
    };

    registerSocialConnector(fullConnector);
    registerSocialConnector(noEditConnector);
    registerSocialConnector(noDeleteConnector);
  });

  describe('AC 8: SocialConnector interface methods', () => {
    it('declares optional edit and delete methods on SocialConnector', () => {
      const connector: SocialConnector = {
        providerId: 'sample',
        authMode: 'none',
        deliveryMode: 'poll',
        getRateLimitConfig: () => ({ requestsPerWindow: 10, windowSeconds: 1 }),
        normalize: () => ({
          externalId: '1',
          authorExternalId: '1',
          publishedAt: '2026-01-01T00:00:00Z',
          rawPayload: {},
        }),
      };
      expect(connector.edit).toBeUndefined();
      expect(connector.delete).toBeUndefined();
    });
  });

  describe('AC 1 & AC 2: Database schema, RLS, and audit columns', () => {
    it('outbound_activities has edited_at and deleted_at columns and no current_body column', async () => {
      const adminPool = getAdminPool();
      const { rows } = await adminPool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'outbound_activities'
          AND column_name IN ('edited_at', 'deleted_at', 'current_body')
      `);
      const colNames = rows.map((r: { column_name: string }) => r.column_name);
      expect(colNames).toContain('edited_at');
      expect(colNames).toContain('deleted_at');
      expect(colNames).not.toContain('current_body');
    });

    it('outbound_activity_revisions table exists with RLS enabled and tenant isolation', async () => {
      const adminPool = getAdminPool();
      const { rows: tableRows } = await adminPool.query(`
        SELECT rowsecurity
        FROM pg_tables
        WHERE tablename = 'outbound_activity_revisions'
      `);
      expect(tableRows.length).toBe(1);
      expect(tableRows[0].rowsecurity).toBe(true);
    });
  });

  describe('AC 3: PATCH /v1/outbound/activities/:id (edit)', () => {
    it('updates a pending activity in place and creates an applied revision without calling connector', async () => {
      const app = createApp();
      const { tenantId, userId } = await makeTenantWithUser();

      const pendingActivity = await insertPending({
        tenantId,
        userId,
        providerId: PROVIDER_FULL,
        credentialId: randomUUID(),
        activityType: 'post',
        body: 'Initial draft content',
      });

      const res = await request(app)
        .patch(`/v1/outbound/activities/${pendingActivity.id}`)
        .set('x-test-identity', identityHeader(tenantId, userId))
        .send({ body: 'Updated draft content' });

      expect(res.status).toBe(201);
      expect(res.body.revision).toBeDefined();
      expect(res.body.revision.revisionType).toBe('edit');
      expect(res.body.revision.status).toBe('applied');
      expect(res.body.revision.body).toBe('Updated draft content');

      // Check connector was NOT called
      expect(editSpy).not.toHaveBeenCalled();

      // Check parent was updated in place
      const updatedParent = await getById(tenantId, pendingActivity.id);
      expect(updatedParent?.body).toBe('Updated draft content');
      expect(updatedParent?.editedAt).not.toBeNull();
    });

    it('calls connector.edit?() for sent activities and marks revision applied on success', async () => {
      const app = createApp();
      const { tenantId, userId } = await makeTenantWithUser();
      await setConnectorActivation(tenantId, PROVIDER_FULL, 'user', true, userId, userId);
      const cred = await storeCredential(tenantId, PROVIDER_FULL, 'test-token', process.env.KEY_VAULT_KEY_ID!, 'user', userId);
      const credId = cred.id;

      const pending = await insertPending({
        tenantId,
        userId,
        providerId: PROVIDER_FULL,
        credentialId: credId,
        activityType: 'post',
        targetAssetId: 'page_123',
        targetAssetType: 'facebook_page',
        body: 'Sent content v1',
      });
      const sentActivity = await setSent(tenantId, pending.id, 'ext_post_100', 'https://example.com/100', new Date().toISOString());

      const res = await request(app)
        .patch(`/v1/outbound/activities/${sentActivity.id}`)
        .set('x-test-identity', identityHeader(tenantId, userId))
        .send({ body: 'Sent content v2 (corrected)' });

      expect(res.status).toBe(201);
      expect(res.body.revision.revisionType).toBe('edit');
      expect(res.body.revision.status).toBe('applied');
      expect(res.body.revision.externalId).toBe('ext_post_100_edited');
      expect(res.body.revision.externalUrl).toBe('https://example.com/posts/ext_post_100_edited');

      // Verify connector.edit was called with expected arguments
      expect(editSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: sentActivity.id,
          tenantId,
          userId,
          providerId: PROVIDER_FULL,
          externalId: 'ext_post_100',
        }),
        'Sent content v2 (corrected)',
        undefined,
        'test-token'
      );

      // Parent original body remains intact for sent activities
      const parent = await getById(tenantId, sentActivity.id);
      expect(parent?.body).toBe('Sent content v1');
      expect(parent?.editedAt).not.toBeNull();

      // Latest applied edit is the source of truth
      const latestEdit = await getLatestAppliedEditRevision(tenantId, sentActivity.id);
      expect(latestEdit?.body).toBe('Sent content v2 (corrected)');
    });

    it('rejects retargeting with 422 if targetAssetId is changed', async () => {
      const app = createApp();
      const { tenantId, userId } = await makeTenantWithUser();
      const pending = await insertPending({
        tenantId,
        userId,
        providerId: PROVIDER_FULL,
        credentialId: randomUUID(),
        activityType: 'post',
        targetAssetId: 'page_1',
        body: 'Some text',
      });

      const res = await request(app)
        .patch(`/v1/outbound/activities/${pending.id}`)
        .set('x-test-identity', identityHeader(tenantId, userId))
        .send({ body: 'Some new text', targetAssetId: 'page_2' });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('TARGET_ASSET_READ_ONLY');
    });
  });

  describe('AC 4: DELETE /v1/outbound/activities/:id (delete)', () => {
    it('cancels a pending activity without creating an outbound_activity_revisions row', async () => {
      const app = createApp();
      const { tenantId, userId } = await makeTenantWithUser();

      const pending = await insertPending({
        tenantId,
        userId,
        providerId: PROVIDER_FULL,
        credentialId: randomUUID(),
        activityType: 'post',
        body: 'Pending post to cancel',
      });

      const res = await request(app)
        .delete(`/v1/outbound/activities/${pending.id}`)
        .set('x-test-identity', identityHeader(tenantId, userId));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');

      // Check parent status is cancelled
      const parent = await getById(tenantId, pending.id);
      expect(parent?.status).toBe('cancelled');
      expect(parent?.cancelledAt).not.toBeNull();

      // Connector delete must NOT be called
      expect(deleteSpy).not.toHaveBeenCalled();

      // No revision created for pending cancellation
      const revRes = await request(app)
        .get(`/v1/outbound/activities/${pending.id}/revisions`)
        .set('x-test-identity', identityHeader(tenantId, userId));
      expect(revRes.body.revisions).toHaveLength(0);
    });

    it('creates a delete revision for sent activity, calls connector.delete, and sets parent deleted_at', async () => {
      const app = createApp();
      const { tenantId, userId } = await makeTenantWithUser();
      await setConnectorActivation(tenantId, PROVIDER_FULL, 'user', true, userId, userId);
      const cred = await storeCredential(tenantId, PROVIDER_FULL, 'test-token', process.env.KEY_VAULT_KEY_ID!, 'user', userId);
      const credId = cred.id;

      const pending = await insertPending({
        tenantId,
        userId,
        providerId: PROVIDER_FULL,
        credentialId: credId,
        activityType: 'post',
        targetAssetId: 'page_123',
        body: 'Published post to delete',
      });
      const sent = await setSent(tenantId, pending.id, 'ext_delete_1', 'https://example.com/delete_1', new Date().toISOString());

      const res = await request(app)
        .delete(`/v1/outbound/activities/${sent.id}`)
        .set('x-test-identity', identityHeader(tenantId, userId));

      expect([200, 202]).toContain(res.status);
      expect(res.body.revision.revisionType).toBe('delete');
      expect(res.body.revision.status).toBe('applied');

      // Verify connector.delete called
      expect(deleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: sent.id,
          externalId: 'ext_delete_1',
        }),
        'test-token'
      );

      // Verify parent deleted_at is updated
      const updatedParent = await getById(tenantId, sent.id);
      expect(updatedParent?.deletedAt).not.toBeNull();
    });
  });

  describe('AC 5: GET /v1/outbound/activities/:id/revisions', () => {
    it('lists all revisions for an activity ordered by created_at descending', async () => {
      const app = createApp();
      const { tenantId, userId } = await makeTenantWithUser();
      await setConnectorActivation(tenantId, PROVIDER_FULL, 'user', true, userId, userId);
      const cred = await storeCredential(tenantId, PROVIDER_FULL, 'test-token', process.env.KEY_VAULT_KEY_ID!, 'user', userId);
      const credId = cred.id;

      const pending = await insertPending({
        tenantId,
        userId,
        providerId: PROVIDER_FULL,
        credentialId: credId,
        activityType: 'post',
        body: 'Post to revise multiple times',
      });
      const sent = await setSent(tenantId, pending.id, 'ext_rev_1', 'https://example.com/rev_1', new Date().toISOString());

      // Edit 1
      await request(app)
        .patch(`/v1/outbound/activities/${sent.id}`)
        .set('x-test-identity', identityHeader(tenantId, userId))
        .send({ body: 'Revision 1' });

      // Edit 2
      await request(app)
        .patch(`/v1/outbound/activities/${sent.id}`)
        .set('x-test-identity', identityHeader(tenantId, userId))
        .send({ body: 'Revision 2' });

      const res = await request(app)
        .get(`/v1/outbound/activities/${sent.id}/revisions`)
        .set('x-test-identity', identityHeader(tenantId, userId));

      expect(res.status).toBe(200);
      expect(res.body.revisions).toHaveLength(2);
      expect(res.body.revisions[0].body).toBe('Revision 2');
      expect(res.body.revisions[1].body).toBe('Revision 1');
      expect(new Date(res.body.revisions[0].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(res.body.revisions[1].createdAt).getTime()
      );
    });
  });

  describe('AC 6: Unsupported connectors return 422 with *_not_supported', () => {
    it('returns 422 edit_not_supported when connector does not implement edit?()', async () => {
      const app = createApp();
      const { tenantId, userId } = await makeTenantWithUser();
      await setConnectorActivation(tenantId, PROVIDER_NO_EDIT, 'user', true, userId, userId);
      const cred = await storeCredential(tenantId, PROVIDER_NO_EDIT, 'test-token', process.env.KEY_VAULT_KEY_ID!, 'user', userId);
      const credId = cred.id;

      const pending = await insertPending({
        tenantId,
        userId,
        providerId: PROVIDER_NO_EDIT,
        credentialId: credId,
        activityType: 'post',
        body: 'Post on platform without edit',
      });
      const sent = await setSent(tenantId, pending.id, 'ext_no_edit', 'https://example.com/no_edit', new Date().toISOString());

      const res = await request(app)
        .patch(`/v1/outbound/activities/${sent.id}`)
        .set('x-test-identity', identityHeader(tenantId, userId))
        .send({ body: 'Attempting edit' });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('edit_not_supported');
    });

    it('returns 422 delete_not_supported when connector does not implement delete?()', async () => {
      const app = createApp();
      const { tenantId, userId } = await makeTenantWithUser();
      await setConnectorActivation(tenantId, PROVIDER_NO_DELETE, 'user', true, userId, userId);
      const cred = await storeCredential(tenantId, PROVIDER_NO_DELETE, 'test-token', process.env.KEY_VAULT_KEY_ID!, 'user', userId);
      const credId = cred.id;

      const pending = await insertPending({
        tenantId,
        userId,
        providerId: PROVIDER_NO_DELETE,
        credentialId: credId,
        activityType: 'post',
        body: 'Post on platform without delete',
      });
      const sent = await setSent(tenantId, pending.id, 'ext_no_del', 'https://example.com/no_del', new Date().toISOString());

      const res = await request(app)
        .delete(`/v1/outbound/activities/${sent.id}`)
        .set('x-test-identity', identityHeader(tenantId, userId));

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('delete_not_supported');
    });
  });

  describe('AC 7: Authorization and role gating', () => {
    it('allows a tenant_admin to edit an activity created by another user in the same tenant', async () => {
      const app = createApp();
      const { tenantId, userId: originalAuthorId } = await makeTenantWithUser('tenant_user');
      const email = `admin-${randomUUID()}@example.com`;
      const adminUser = await createInvitedUser(tenantId, { email, role: 'tenant_admin' });
      await resolveIdentity({ sub: `sub-${adminUser.id}`, email });

      const pending = await insertPending({
        tenantId,
        userId: originalAuthorId,
        providerId: PROVIDER_FULL,
        credentialId: randomUUID(),
        activityType: 'post',
        body: 'Author post',
      });

      const res = await request(app)
        .patch(`/v1/outbound/activities/${pending.id}`)
        .set('x-test-identity', identityHeader(tenantId, adminUser.id, 'tenant_admin'))
        .send({ body: 'Admin modified this draft' });

      expect(res.status).toBe(201);
      expect(res.body.revision.status).toBe('applied');
    });

    it('rejects with 403 when another tenant_user attempts to edit or delete', async () => {
      const app = createApp();
      const { tenantId, userId: authorId } = await makeTenantWithUser('tenant_user');
      const email = `other-${randomUUID()}@example.com`;
      const otherUser = await createInvitedUser(tenantId, { email, role: 'tenant_user' });
      await resolveIdentity({ sub: `sub-${otherUser.id}`, email });

      const pending = await insertPending({
        tenantId,
        userId: authorId,
        providerId: PROVIDER_FULL,
        credentialId: randomUUID(),
        activityType: 'post',
        body: 'Author post',
      });

      // Edit attempt by other user
      const editRes = await request(app)
        .patch(`/v1/outbound/activities/${pending.id}`)
        .set('x-test-identity', identityHeader(tenantId, otherUser.id, 'tenant_user'))
        .send({ body: 'Unauthorized edit' });
      expect(editRes.status).toBe(403);

      // Delete attempt by other user
      const delRes = await request(app)
        .delete(`/v1/outbound/activities/${pending.id}`)
        .set('x-test-identity', identityHeader(tenantId, otherUser.id, 'tenant_user'));
      expect(delRes.status).toBe(403);
    });

    it('rejects platform_admin with 403 (zero-tenant-content boundary)', async () => {
      const app = createApp();
      const { tenantId, userId } = await makeTenantWithUser();
      const pending = await insertPending({
        tenantId,
        userId,
        providerId: PROVIDER_FULL,
        credentialId: randomUUID(),
        activityType: 'post',
        body: 'Content protected from platform_admin',
      });

      const res = await request(app)
        .patch(`/v1/outbound/activities/${pending.id}`)
        .set('x-test-identity', JSON.stringify({ type: 'platform_admin', adminId: randomUUID() }))
        .send({ body: 'Platform admin edit' });

      expect(res.status).toBe(403);
    });
  });
});
