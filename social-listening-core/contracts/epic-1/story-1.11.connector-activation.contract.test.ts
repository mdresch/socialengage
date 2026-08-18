/**
 * Story 1.11 — Connector activation, decoupled from credential presence
 * Source ADR: ADR-0051 (accepted 2026-08-12, after seven in-place revisions
 * during live review)
 *
 * Intent: two new, ownership-scoped, credential-independent activation
 * tables — `connector_activations` (tenant-wide, ADR-0028 Tier 2) and
 * `connector_user_activations` (user-specific, Tier 3) — mirroring
 * `platform_credentials`' own tenant/user ownership-tier split (Story 1.7,
 * ADR-0034) exactly, but wholly separate from it: `is_active` on either
 * table asserts only that the owner of that scope has chosen this
 * connector to be on, never that a credential is present/valid or that
 * health is anything other than `failing`. Both tables are lazily
 * created — no row for any (tenantId, platformId[, userId]) exists until
 * the first real activate/deactivate call; absence of a row reads
 * identically to `is_active = false`. `POST /v1/connectors/:platformId/
 * activate|deactivate`, discriminated by `ownerType` in the body, mirror
 * `connect`/`disconnect`'s own existing authorization split (Story 1.7):
 * `ownerType: 'tenant'` requires `tenant_admin`; `ownerType: 'user'`
 * `activate` always uses the caller's own resolved identity (never a
 * client-supplied `userId`, matching `connect`'s self-only shape);
 * `ownerType: 'user'` `deactivate` succeeds for the owning user OR a
 * `tenant_admin` of the same tenant (matching `disconnect`'s own
 * offboarding-override shape, Story 1.7 AC5) — deactivating is strictly
 * less destructive than disconnecting, so a Tenant-Admin who may already
 * disconnect a user's credential must not be blocked from pausing it.
 * `ownerType: 'user'` is rejected `400` for an `authMode: 'none'` platform
 * (no personal scope exists for a connector with no credential to own
 * personally) — determined via the shared connector registry
 * (`getSocialConnector()`/`getAIProviderConnector()`), never a hardcoded
 * providerId literal (ADR-0048 §1's own CORE_FILES discipline).
 * `shouldAttemptIngestion()` (`connectorHealth.ts`) is extended to
 * additionally require `is_active = true` on the matching-scope
 * activation row, alongside its existing health check — closing the real,
 * shipped Newswire always-on bug and the credential-presence-as-
 * activation conflation this ADR exists to fix. Neither endpoint invokes
 * `runIngestionAttempt()` or any other ingestion path as a side effect —
 * a synchronous write to the activation table only (ADR-0051 Decision
 * §2's timing-semantics paragraph). Disconnect (Story 1.7, unchanged)
 * continues to hard-delete the credential and never touches either
 * activation table — deactivate and disconnect stay two distinct,
 * independently callable actions.
 *
 * Explicitly out of scope, per ADR-0051 Decision §6/§7/§8: live credential
 * validation; system-driven auto-deactivation; the `retryable`/non-
 * retryable auto-disable conflation fix in `deriveConnectorHealth()`
 * (addressed separately via ADR-0010/0023's own dated Clarification
 * notes). Also out of scope: `social-listening-admin` UI wiring, and
 * `GET /v1/connectors/:platformId`'s own response shape combining
 * activation with derived health (ADR-0051 Open Question 5).
 *
 * AC1: two new tables exist (`connector_activations`, `connector_user_
 *      activations`), both RLS-enabled and tenant-isolated.
 * AC2: no row is inserted into either table by tenant creation — a newly
 *      created tenant has zero rows in either table.
 * AC3: `POST .../activate` `ownerType: 'tenant'` (default) succeeds only
 *      for `tenant_admin`; `403` otherwise.
 * AC4: `POST .../activate` `ownerType: 'user'` always sets `userId` to the
 *      caller's own resolved identity — a spoofed `userId` has no effect.
 * AC5: `POST .../deactivate` `ownerType: 'user'` succeeds for the owning
 *      user or a `tenant_admin` of the same tenant, and no one else.
 * AC6: both endpoints are idempotent no-ops when the target state already
 *      matches — `activated_at` is not bumped on a repeat activate.
 * AC7: `ownerType: 'user'` is rejected `400` for an `authMode: 'none'`
 *      platform; `connector_user_activations` is never written for it.
 * AC8: activating/deactivating one scope never creates, modifies, or
 *      reads a row in the other scope for the same platform.
 * AC9: neither endpoint invokes `runIngestionAttempt()` — no `IngestionRun`
 *      row is created as a side effect of an activate/deactivate call.
 * AC10: `shouldAttemptIngestion()` additionally requires `is_active = true`
 *       on the matching-scope activation row.
 * AC11: `disconnect` (Story 1.7, unchanged) continues to hard-delete the
 *       credential and never touches either activation table; deactivate
 *       never deletes the credential.
 *
 * Clarification, 2026-08-17 (ADR-0028 Decision §1, found live — see
 * story-1.7's own matching AC8 and connector-connect-disconnect/SKILL.md):
 * AC12: `ownerType: 'user'` is rejected `400` for any real, registered
 *       `AIProviderConnector` (Azure AI Language, Azure OpenAI) — ADR-0028
 *       Tier 2 only, no Tier 3/personal variant; `connector_user_
 *       activations` is never written for one.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';
import { shouldAttemptIngestion } from '../../src/connectors/connectorHealth';
import { setConnectorActivation, isConnectorActive } from '../../src/connectors/connectorActivationStore';
import {
  registerSocialConnector,
  __resetRegistryForTests,
} from '../../src/connectors/registry';
import { SocialConnector } from '../../src/connectors/types';
import { runIngestionAttempt } from '../../src/ingestion/runIngestionAttempt';

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
    // Key may already be deleted or vault unavailable - ignore, same as Story 1.7's own precedent.
  }
  __resetRegistryForTests();
  await closePlatformAdminPool();
  await closePool();
  await closeAdminPool();
});

/** A tenant plus a linked, active tenant_admin and a linked, active tenant_user. */
async function makeTenantWithUsers(): Promise<{
  tenantId: string;
  adminUserId: string;
  memberUserId: string;
}> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  const adminEmail = `admin-${randomUUID()}@example.com`;
  const memberEmail = `member-${randomUUID()}@example.com`;
  const invitedAdmin = await createInvitedUser(tenant.id, { email: adminEmail, role: 'tenant_admin' });
  const invitedMember = await createInvitedUser(tenant.id, { email: memberEmail, role: 'tenant_user' });
  await resolveIdentity({ sub: `sub-${invitedAdmin.id}`, email: adminEmail });
  await resolveIdentity({ sub: `sub-${invitedMember.id}`, email: memberEmail });
  return { tenantId: tenant.id, adminUserId: invitedAdmin.id, memberUserId: invitedMember.id };
}

const AUTH_NONE_PLATFORM_ID = 'test-authmode-none-1.11';
const authNoneConnector: SocialConnector = {
  providerId: AUTH_NONE_PLATFORM_ID,
  authMode: 'none',
  deliveryMode: 'poll',
  getRateLimitConfig: () => ({ requestsPerWindow: 10, windowSeconds: 60 }),
  normalize: (raw) => raw as never,
};

describe('Story 1.11 — connector_activations / connector_user_activations schema', () => {
  it('AC1: both tables exist, columns present, RLS enabled', async () => {
    for (const table of ['connector_activations', 'connector_user_activations']) {
      const { rows } = await getAdminPool().query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        [table]
      );
      const columnNames = rows.map((r) => r.column_name);
      expect(columnNames).toEqual(
        expect.arrayContaining(['tenant_id', 'platform_id', 'is_active', 'activated_at', 'deactivated_at', 'updated_by'])
      );

      const { rows: rlsRows } = await getAdminPool().query<{ relrowsecurity: boolean }>(
        `SELECT relrowsecurity FROM pg_class WHERE relname = $1`,
        [table]
      );
      expect(rlsRows[0].relrowsecurity).toBe(true);
    }

    const { rows: userIdCols } = await getAdminPool().query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'connector_user_activations'`
    );
    expect(userIdCols.map((r) => r.column_name)).toContain('user_id');
  });
});

describe('Story 1.11 — lazy row creation', () => {
  it('AC2: a newly created tenant has zero rows in either activation table', async () => {
    const { tenantId } = await makeTenantWithUsers();

    const { rows: tenantRows } = await getAdminPool().query(
      `SELECT 1 FROM connector_activations WHERE tenant_id = $1`,
      [tenantId]
    );
    const { rows: userRows } = await getAdminPool().query(
      `SELECT 1 FROM connector_user_activations WHERE tenant_id = $1`,
      [tenantId]
    );
    expect(tenantRows).toHaveLength(0);
    expect(userRows).toHaveLength(0);
  });
});

describe('Story 1.11 — POST /v1/connectors/:platformId/activate', () => {
  const app = createApp();
  const platformId = 'test-platform-1.11-activate';

  it('AC3: ownerType "tenant" (default) succeeds only for a tenant_admin — 403 for a tenant_user', async () => {
    const { tenantId, adminUserId, memberUserId } = await makeTenantWithUsers();

    const asMember = await request(app)
      .post(`/v1/connectors/${platformId}/activate`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: memberUserId, role: 'tenant_user' }))
      .send({});
    expect(asMember.status).toBe(403);

    const asAdmin = await request(app)
      .post(`/v1/connectors/${platformId}/activate`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }))
      .send({});
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.isActive).toBe(true);
    expect(asAdmin.body.ownerType).toBe('tenant');
  });

  it('AC4: ownerType "user" always sets userId to the caller\'s own identity — a spoofed userId in the body has no effect', async () => {
    const { tenantId, memberUserId } = await makeTenantWithUsers();
    const someoneElsesId = randomUUID();

    const res = await request(app)
      .post(`/v1/connectors/${platformId}/activate`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: memberUserId, role: 'tenant_user' }))
      .send({ ownerType: 'user', userId: someoneElsesId });

    expect(res.status).toBe(200);
    expect(res.body.ownerType).toBe('user');

    const { rows } = await getAdminPool().query<{ user_id: string }>(
      `SELECT user_id FROM connector_user_activations WHERE tenant_id = $1 AND platform_id = $2`,
      [tenantId, platformId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(memberUserId);
    expect(rows[0].user_id).not.toBe(someoneElsesId);
  });

  it('AC6: activating an already-active row is a no-op — activated_at is not bumped', async () => {
    const { tenantId, adminUserId } = await makeTenantWithUsers();
    const first = await request(app)
      .post(`/v1/connectors/${platformId}/activate`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }))
      .send({});
    expect(first.status).toBe(200);
    const firstActivatedAt = first.body.activatedAt;

    await new Promise((resolve) => setTimeout(resolve, 10));

    const second = await request(app)
      .post(`/v1/connectors/${platformId}/activate`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }))
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.activatedAt).toBe(firstActivatedAt);
  });

  it('AC7: ownerType "user" is rejected 400 for an authMode:\'none\' platform, and no row is written', async () => {
    registerSocialConnector(authNoneConnector);
    const { tenantId, memberUserId } = await makeTenantWithUsers();

    const res = await request(app)
      .post(`/v1/connectors/${AUTH_NONE_PLATFORM_ID}/activate`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: memberUserId, role: 'tenant_user' }))
      .send({ ownerType: 'user' });

    expect(res.status).toBe(400);

    const { rows } = await getAdminPool().query(
      `SELECT 1 FROM connector_user_activations WHERE tenant_id = $1 AND platform_id = $2`,
      [tenantId, AUTH_NONE_PLATFORM_ID]
    );
    expect(rows).toHaveLength(0);
  });

  it('AC12 (2026-08-17 Clarification): ownerType "user" is rejected 400 for a real AIProviderConnector (azure-ai-language), and no row is written', async () => {
    const { tenantId, memberUserId } = await makeTenantWithUsers();

    const res = await request(app)
      .post('/v1/connectors/azure-ai-language/activate')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: memberUserId, role: 'tenant_user' }))
      .send({ ownerType: 'user' });

    expect(res.status).toBe(400);

    const { rows } = await getAdminPool().query(
      `SELECT 1 FROM connector_user_activations WHERE tenant_id = $1 AND platform_id = $2`,
      [tenantId, 'azure-ai-language']
    );
    expect(rows).toHaveLength(0);
  });

  it('AC12: a real, non-AI social connector (gnews) is unaffected — ownerType "user" activation still succeeds', async () => {
    const { tenantId, memberUserId } = await makeTenantWithUsers();

    const res = await request(app)
      .post('/v1/connectors/gnews/activate')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: memberUserId, role: 'tenant_user' }))
      .send({ ownerType: 'user' });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
  });

  it('AC9: activating does not invoke runIngestionAttempt() — no IngestionRun is created as a side effect', async () => {
    const { tenantId, adminUserId } = await makeTenantWithUsers();
    const sideEffectPlatform = 'test-platform-1.11-no-side-effect';

    await request(app)
      .post(`/v1/connectors/${sideEffectPlatform}/activate`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }))
      .send({});

    const { rows } = await getAdminPool().query(
      `SELECT 1 FROM ingestion_runs WHERE tenant_id = $1 AND platform_id = $2`,
      [tenantId, sideEffectPlatform]
    );
    expect(rows).toHaveLength(0);
  });
});

describe('Story 1.11 — POST /v1/connectors/:platformId/deactivate', () => {
  const app = createApp();
  const platformId = 'test-platform-1.11-deactivate';

  it('AC5: ownerType "user" succeeds for the owning user or a tenant_admin, and no one else', async () => {
    const { tenantId, adminUserId, memberUserId } = await makeTenantWithUsers();
    const otherMember = await createInvitedUser(tenantId, {
      email: `other-${randomUUID()}@example.com`,
      role: 'tenant_user',
    });
    await resolveIdentity({ sub: `sub-${otherMember.id}`, email: otherMember.email });

    await request(app)
      .post(`/v1/connectors/${platformId}/activate`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: memberUserId, role: 'tenant_user' }))
      .send({ ownerType: 'user' });

    const asStranger = await request(app)
      .post(`/v1/connectors/${platformId}/deactivate`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: otherMember.id, role: 'tenant_user' }))
      .send({ ownerType: 'user', userId: memberUserId });
    expect(asStranger.status).toBe(403);

    const asAdmin = await request(app)
      .post(`/v1/connectors/${platformId}/deactivate`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }))
      .send({ ownerType: 'user', userId: memberUserId });
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.isActive).toBe(false);
  });

  it('AC11: deactivate never deletes the credential, and disconnect (Story 1.7, unchanged) never touches activation state', async () => {
    const { tenantId, adminUserId } = await makeTenantWithUsers();

    await request(app)
      .post(`/v1/connectors/${platformId}/connect`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }))
      .send({ credential: 'tenant-key' });
    await request(app)
      .post(`/v1/connectors/${platformId}/activate`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }))
      .send({});

    const deactivateRes = await request(app)
      .post(`/v1/connectors/${platformId}/deactivate`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }))
      .send({});
    expect(deactivateRes.status).toBe(200);

    const { rows: credentialRows } = await getAdminPool().query(
      `SELECT 1 FROM platform_credentials WHERE tenant_id = $1 AND platform_id = $2`,
      [tenantId, platformId]
    );
    expect(credentialRows).toHaveLength(1);

    const disconnectRes = await request(app)
      .delete(`/v1/connectors/${platformId}/disconnect`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }));
    expect(disconnectRes.status).toBe(200);

    const { rows: credentialRowsAfter } = await getAdminPool().query(
      `SELECT 1 FROM platform_credentials WHERE tenant_id = $1 AND platform_id = $2`,
      [tenantId, platformId]
    );
    expect(credentialRowsAfter).toHaveLength(0);

    const { rows: activationRowsAfterDisconnect } = await getAdminPool().query<{ is_active: boolean }>(
      `SELECT is_active FROM connector_activations WHERE tenant_id = $1 AND platform_id = $2`,
      [tenantId, platformId]
    );
    expect(activationRowsAfterDisconnect).toHaveLength(1);
    expect(activationRowsAfterDisconnect[0].is_active).toBe(false);
  });
});

describe('Story 1.11 — scope independence', () => {
  it('AC8: activating/deactivating one scope never creates, modifies, or reads a row in the other scope', async () => {
    const { tenantId, adminUserId, memberUserId } = await makeTenantWithUsers();
    const platformId = 'test-platform-1.11-scope-independence';

    await setConnectorActivation(tenantId, platformId, 'tenant', true, adminUserId);
    await setConnectorActivation(tenantId, platformId, 'user', true, memberUserId, memberUserId);

    await setConnectorActivation(tenantId, platformId, 'tenant', false, adminUserId);

    expect(await isConnectorActive(tenantId, platformId, 'tenant')).toBe(false);
    expect(await isConnectorActive(tenantId, platformId, 'user', memberUserId)).toBe(true);

    await setConnectorActivation(tenantId, platformId, 'user', false, memberUserId, memberUserId);
    expect(await isConnectorActive(tenantId, platformId, 'user', memberUserId)).toBe(false);
    expect(await isConnectorActive(tenantId, platformId, 'tenant')).toBe(false);
  });
});

describe('Story 1.11 — shouldAttemptIngestion() requires activation', () => {
  const connectorInfo = { platformId: 'test-platform-1.11-should-attempt', triggerType: 'poll' as const, connectorVersion: '1.0.0' };

  it('AC10: a healthy connector with no activation row does not attempt ingestion; activating it makes it eligible again', async () => {
    const tenantId = randomUUID();

    await runIngestionAttempt({
      tenantId,
      connectorInfo,
      backoffMs: () => 1,
      attempt: async () => ({ postsIngested: 1, postsSkipped: 0 }),
    });

    expect(await shouldAttemptIngestion(tenantId, connectorInfo.platformId)).toBe(false);

    await setConnectorActivation(tenantId, connectorInfo.platformId, 'tenant', true);
    expect(await shouldAttemptIngestion(tenantId, connectorInfo.platformId)).toBe(true);
  });

  it('AC10: a user-scoped activation gates the user-scoped call independently of the tenant-wide scope', async () => {
    // connector_user_activations.user_id has a real FK to users(id)
    // (mirrors watchlists.user_id's own ON DELETE CASCADE precedent) — a
    // synthetic randomUUID() userId with no real users row would violate
    // it, unlike the tenant-wide table (tenant_id has no FK, matching
    // every other tenant-scoped table's own RLS-only convention).
    const { tenantId, memberUserId: userId } = await makeTenantWithUsers();

    await runIngestionAttempt({
      tenantId,
      connectorInfo,
      backoffMs: () => 1,
      attempt: async () => ({ postsIngested: 1, postsSkipped: 0 }),
    });

    expect(await shouldAttemptIngestion(tenantId, connectorInfo.platformId, 'user', userId)).toBe(false);
    await setConnectorActivation(tenantId, connectorInfo.platformId, 'user', true, undefined, userId);
    expect(await shouldAttemptIngestion(tenantId, connectorInfo.platformId, 'user', userId)).toBe(true);
    // Tenant-wide scope is still independently inactive.
    expect(await shouldAttemptIngestion(tenantId, connectorInfo.platformId, 'tenant')).toBe(false);
  });
});
