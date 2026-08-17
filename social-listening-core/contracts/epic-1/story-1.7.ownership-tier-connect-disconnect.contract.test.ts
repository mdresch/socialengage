/**
 * Story 1.7 — Ownership-tier-aware connector connect/disconnect, superseding Story 1.6
 * Source ADR: ADR-0034 (accepted 2026-08-03, its own flagged interpretive
 * question — Tenant-Admin's offboarding revocation authority over a
 * user-bound credential — confirmed as drafted)
 *
 * Intent: rework `platform_credentials`/`connectorsRouter.ts`'s connect and
 * disconnect endpoints, which today trust `req.header('X-Tenant-Id')` with
 * zero role or ownership check of any kind, into real, enforced
 * authorization built on Story 5.9's identity resolution and Story 5.10's
 * retirement of `X-Tenant-Id`. `platform_credentials` gains `owner_type`
 * (`'tenant' | 'user'`) and a nullable `user_id`, added via an additive
 * migration — every existing row (Stories 1.6/2.6/2.7) becomes
 * `owner_type = 'tenant'`, still valid, no reinterpretation. `POST
 * /v1/connectors/:platformId/connect`'s `ownerType: 'tenant'` path requires
 * the caller's resolved role to be `tenant_admin` (ADR-0028 Tier 2);
 * `ownerType: 'user'` always sets `user_id` to the caller's own resolved
 * identity, never a client-supplied value (ADR-0028 Tier 3). Disconnect is
 * the one asymmetric case (ADR-0034 §3/§5): a tenant-wide credential
 * requires `tenant_admin`; a user-bound credential may be removed by its
 * owning user OR a `tenant_admin` of the same tenant (an offboarding safety
 * valve — confirmed, not silently assumed, at ADR-0034's own acceptance).
 * `deleteCredential()`/`getLatestCredentialId()` are reworked to accept
 * `(tenantId, platformId, ownerType, userId?)` — no longer an indiscriminate
 * `(tenantId, platformId)` delete, which would otherwise let an ordinary
 * tenant-wide disconnect silently destroy an unrelated user's personal
 * credential for the same platform (ADR-0034 §4 item 4, its own
 * "single most load-bearing item").
 *
 * Endpoint shape decided here, per ADR-0034 §5's own explicit deferral of
 * the exact syntax: connect stays a single body-discriminated
 * `POST .../connect` (`ownerType` in the request body, defaulting to
 * `'tenant'`); disconnect is a single `DELETE .../disconnect` discriminated
 * by an `ownerType` query parameter (defaulting to `'tenant'`), with an
 * optional `userId` query parameter for the Tenant-Admin offboarding case
 * (defaults to the caller's own id otherwise) — no request body on a
 * DELETE, matching every other route in this codebase.
 *
 * A new shared helper, `requireTenantUserIdentity()`, was added alongside
 * Story 5.10's existing `requireTenantUser()` (not a replacement — that
 * helper's four existing call sites across `watchlistsRouter.ts`/
 * `postsRouter.ts`/`topicsRouter.ts`/this router's own GET health route
 * only ever needed `tenantId` and are untouched) because this story's
 * authorization checks need the caller's `role` and `userId` too, which
 * `req.identity` already carries but `requireTenantUser()` discarded.
 *
 * Explicitly out of scope:
 * - A second RLS predicate on `user_id` — ADR-0034 §2 explicitly rejects
 *   this; ownership is an application-layer authorization concern, ordinary
 *   `tenant_id`-scoped RLS is unchanged.
 * - The two brainstormed Open Questions ADR-0034 explicitly leaves open
 *   (whether connector activation needs its own table; whether a tenant
 *   needs multiple activations of one platform) — not decided here.
 * - Any real OAuth flow — this story only changes who may create/delete a
 *   credential row, not how a credential's value is obtained.
 *
 * AC1: `platform_credentials` carries `owner_type`/`user_id` with a check
 *      constraint, added additively — every pre-existing row is valid as
 *      `owner_type = 'tenant'`.
 * AC2: `POST .../connect` with `ownerType: 'tenant'` (or omitted) succeeds
 *      only for a `tenant_admin` caller; `403` otherwise.
 * AC3: `POST .../connect` with `ownerType: 'user'` always sets `user_id` to
 *      the caller's own resolved identity — a client-supplied `user_id` in
 *      the body has no effect.
 * AC4: deleting a tenant-wide credential requires `tenant_admin`.
 * AC5: deleting a user-bound credential succeeds for the owning user or a
 *      `tenant_admin` of the same tenant, and for no one else.
 * AC6: `deleteCredential()` is scoped by `(tenantId, platformId, ownerType,
 *      userId?)` — disconnecting a tenant-wide credential never removes a
 *      coexisting user-bound one for the same platform, and vice versa.
 * AC7: `X-Tenant-Id` is no longer read or trusted by these endpoints.
 *
 * Clarification, 2026-08-17 (ADR-0028 Decision §1, found live: a real
 * tenant activated Azure AI Language via the personal/user-scope control,
 * which silently succeeded but had no effect, since enrichPost.ts only
 * ever reads a tenant-wide credential for any AIProviderConnector — see
 * ADR-0028's own dated Clarification and connector-connect-disconnect/
 * SKILL.md for the full account):
 * AC8: `ownerType: 'user'` is rejected (400) for any real, registered
 *      `AIProviderConnector` (Azure AI Language, Azure OpenAI) — ADR-0028
 *      Tier 2 only, no Tier 3/personal variant exists for these providers.
 *
 * Healing note, 2026-08-17 (ADR-0014 Decision — envelope encryption backed
 * by a real Azure Key Vault key — was never actually enforced at this
 * route's own configuration boundary; found live: Menno hit "Failed to
 * store credential" connecting GNews through the real browser UI. Every
 * test in this file already sets `KEY_VAULT_KEY_ID` itself in `beforeAll()`
 * (line ~109), so this gap was invisible to the accumulated suite — the
 * real, non-test `.env` never had it set at all, meaning connectorsRouter.ts's
 * own `|| 'placeholder-key-id'` fallback (a stale Phase 1 shim its own
 * comment said Phase 5's real Key Vault would replace) was the only thing
 * any real request ever used, and `'placeholder-key-id'` is not a valid
 * `CryptographyClient` key identifier — every real connect attempt always
 * failed. Not a new decision — ADR-0014's Decision already mandated a real
 * Key Vault key; this closes a mechanical-enforcement gap against it, the
 * same character as ADR-0028's own Clarification/AC8 fix above):
 * AC9: `POST .../connect` fails clearly (500, naming `KEY_VAULT_KEY_ID`) when
 *      that env var is genuinely unset — never silently attempts the invalid
 *      literal `'placeholder-key-id'` as a real key identifier.
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';

// Bumped from 30000 (Story 5.3's original precedent) after a real, reproduced
// timeout on AC3/AC6's own storeCredential() calls during this story's own
// full-suite validation — real Azure Key Vault latency under this session's
// cumulative load, not a functional bug. See
// .claude/skills/credential-envelope-encryption/SKILL.md's matching note.
jest.setTimeout(60000);

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
    // Key may already be deleted or vault unavailable - ignore, same as Story 1.6's own precedent.
  }
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

describe('Story 1.7 — platform_credentials ownership-tier schema', () => {
  it('AC1: owner_type/user_id exist with a check constraint, additive — pre-existing rows stay valid as tenant-owned', async () => {
    const { rows } = await getAdminPool().query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'platform_credentials'`
    );
    const columnNames = rows.map((r) => r.column_name);
    expect(columnNames).toContain('owner_type');
    expect(columnNames).toContain('user_id');

    const { rows: constraintRows } = await getAdminPool().query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'platform_credentials'::regclass AND contype = 'c'`
    );
    expect(constraintRows.some((r: { conname: string }) => r.conname === 'platform_credentials_owner_shape')).toBe(
      true
    );
  });
});

describe('Story 1.7 — POST /v1/connectors/:platformId/connect', () => {
  const app = createApp();
  const platformId = 'test-platform-1.7';

  it('AC2: ownerType "tenant" (default) succeeds only for a tenant_admin — 403 for a tenant_user', async () => {
    const { tenantId, adminUserId, memberUserId } = await makeTenantWithUsers();

    const asAdmin = await request(app)
      .post(`/v1/connectors/${platformId}/connect`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }))
      .send({ credential: 'admin-key' });
    expect(asAdmin.status).toBe(201);
    expect(asAdmin.body.ownerType).toBe('tenant');

    const asMember = await request(app)
      .post(`/v1/connectors/${platformId}/connect`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: memberUserId, role: 'tenant_user' }))
      .send({ credential: 'member-attempt' });
    expect(asMember.status).toBe(403);
  });

  it('AC3: ownerType "user" always sets user_id to the caller\'s own identity — a spoofed userId in the body has no effect', async () => {
    const { tenantId, memberUserId } = await makeTenantWithUsers();
    const someoneElsesId = randomUUID();

    const res = await request(app)
      .post(`/v1/connectors/${platformId}/connect`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: memberUserId, role: 'tenant_user' }))
      .send({ credential: 'personal-key', ownerType: 'user', userId: someoneElsesId });

    expect(res.status).toBe(201);
    expect(res.body.ownerType).toBe('user');

    const { rows } = await getAdminPool().query<{ user_id: string }>(
      `SELECT user_id FROM platform_credentials WHERE id = $1`,
      [res.body.id]
    );
    expect(rows[0].user_id).toBe(memberUserId);
    expect(rows[0].user_id).not.toBe(someoneElsesId);
  });

  it('AC8 (2026-08-17 Clarification): ownerType "user" is rejected for a real AIProviderConnector (azure-ai-language) — Tier 2 only, no personal variant', async () => {
    const { tenantId, memberUserId } = await makeTenantWithUsers();

    const res = await request(app)
      .post('/v1/connectors/azure-ai-language/connect')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: memberUserId, role: 'tenant_user' }))
      .send({ credential: 'personal-key', ownerType: 'user' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not valid|ownerType/i);
  });

  it("AC8: a real, non-AI social connector (gnews, authMode 'api_key') is unaffected — ownerType \"user\" still succeeds", async () => {
    const { tenantId, memberUserId } = await makeTenantWithUsers();

    const res = await request(app)
      .post('/v1/connectors/gnews/connect')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: memberUserId, role: 'tenant_user' }))
      .send({ credential: 'personal-gnews-key', ownerType: 'user' });

    expect(res.status).toBe(201);
    expect(res.body.ownerType).toBe('user');
  });

  it('AC9 (2026-08-17 healing note): fails clearly (500, naming KEY_VAULT_KEY_ID) when the env var is genuinely unset — never silently tries an invalid literal key identifier', async () => {
    const { tenantId, adminUserId } = await makeTenantWithUsers();
    const saved = process.env.KEY_VAULT_KEY_ID;
    delete process.env.KEY_VAULT_KEY_ID;

    try {
      const res = await request(app)
        .post(`/v1/connectors/${platformId}/connect`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }))
        .send({ credential: 'admin-key' });

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/KEY_VAULT_KEY_ID/);
    } finally {
      process.env.KEY_VAULT_KEY_ID = saved;
    }
  });
});

describe('Story 1.7 — DELETE /v1/connectors/:platformId/disconnect', () => {
  const app = createApp();
  const platformId = 'test-platform-1.7-disconnect';

  it('AC4: disconnecting a tenant-wide credential requires tenant_admin', async () => {
    const { tenantId, adminUserId, memberUserId } = await makeTenantWithUsers();
    await request(app)
      .post(`/v1/connectors/${platformId}/connect`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }))
      .send({ credential: 'tenant-key' });

    const asMember = await request(app)
      .delete(`/v1/connectors/${platformId}/disconnect`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: memberUserId, role: 'tenant_user' }));
    expect(asMember.status).toBe(403);

    const asAdmin = await request(app)
      .delete(`/v1/connectors/${platformId}/disconnect`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }));
    expect(asAdmin.status).toBe(200);
  });

  it('AC5: disconnecting a user-bound credential succeeds for the owning user or a tenant_admin, and no one else', async () => {
    const { tenantId, adminUserId, memberUserId } = await makeTenantWithUsers();
    const otherMember = await createInvitedUser(tenantId, {
      email: `other-${randomUUID()}@example.com`,
      role: 'tenant_user',
    });
    await resolveIdentity({ sub: `sub-${otherMember.id}`, email: otherMember.email });

    await request(app)
      .post(`/v1/connectors/${platformId}/connect`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: memberUserId, role: 'tenant_user' }))
      .send({ credential: 'personal-key', ownerType: 'user' });

    // A different, unrelated tenant_user may not delete someone else's personal credential.
    const asStranger = await request(app)
      .delete(`/v1/connectors/${platformId}/disconnect?ownerType=user&userId=${memberUserId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: otherMember.id, role: 'tenant_user' }));
    expect(asStranger.status).toBe(403);

    // A tenant_admin may (offboarding case), confirmed at ADR-0034's own acceptance.
    const asAdmin = await request(app)
      .delete(`/v1/connectors/${platformId}/disconnect?ownerType=user&userId=${memberUserId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }));
    expect(asAdmin.status).toBe(200);
  });

  it('AC5: the owning user may delete their own user-bound credential directly', async () => {
    const { tenantId, memberUserId } = await makeTenantWithUsers();
    await request(app)
      .post(`/v1/connectors/${platformId}/connect`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: memberUserId, role: 'tenant_user' }))
      .send({ credential: 'personal-key', ownerType: 'user' });

    const res = await request(app)
      .delete(`/v1/connectors/${platformId}/disconnect?ownerType=user`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: memberUserId, role: 'tenant_user' }));
    expect(res.status).toBe(200);
  });

  it('AC6: disconnecting a tenant-wide credential never removes a coexisting user-bound one for the same platform, and vice versa', async () => {
    const { tenantId, adminUserId, memberUserId } = await makeTenantWithUsers();

    await request(app)
      .post(`/v1/connectors/${platformId}/connect`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }))
      .send({ credential: 'tenant-key' });
    const userConnect = await request(app)
      .post(`/v1/connectors/${platformId}/connect`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: memberUserId, role: 'tenant_user' }))
      .send({ credential: 'personal-key', ownerType: 'user' });

    await request(app)
      .delete(`/v1/connectors/${platformId}/disconnect`) // ownerType defaults to 'tenant'
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }));

    const { rows } = await getAdminPool().query<{ id: string; owner_type: string }>(
      `SELECT id, owner_type FROM platform_credentials WHERE platform_id = $1`,
      [platformId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(userConnect.body.id);
    expect(rows[0].owner_type).toBe('user');
  });
});

describe('Story 1.7 — X-Tenant-Id retirement, extended to connect/disconnect', () => {
  it('AC7: neither connect nor disconnect route handler references X-Tenant-Id', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'src', 'http', 'versions', 'v1', 'connectorsRouter.ts'),
      'utf8'
    );
    expect(source).not.toContain('X-Tenant-Id');
  });

  it('AC7: a stray X-Tenant-Id header claiming another tenant has no effect on connect', async () => {
    const app = createApp();
    const platformId = 'test-platform-1.7-stray-header';
    const { tenantId, adminUserId } = await makeTenantWithUsers();
    const claimedTenant = await createTenant('test-actor', { name: `T-claim-${randomUUID()}`, licenseSeatCount: 1 });

    const res = await request(app)
      .post(`/v1/connectors/${platformId}/connect`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }))
      .set('X-Tenant-Id', claimedTenant.id)
      .send({ credential: 'real-tenant-key' });

    expect(res.status).toBe(201);

    const { rows } = await getAdminPool().query<{ tenant_id: string }>(
      `SELECT tenant_id FROM platform_credentials WHERE id = $1`,
      [res.body.id]
    );
    expect(rows[0].tenant_id).toBe(tenantId);
    expect(rows[0].tenant_id).not.toBe(claimedTenant.id);
  });
});
