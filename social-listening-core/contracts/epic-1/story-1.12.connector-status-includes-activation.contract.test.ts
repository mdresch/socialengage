/**
 * Story 1.12 — GET /v1/connectors/:platformId combines activation state with derived health
 * Source: ADR-0051 Open Question 5 (Accepted 2026-08-12)
 *
 * Intent: extend GET /v1/connectors/:platformId's response with a real
 * `isActive` boolean, read via `isConnectorActive()` (`connectorActivationStore.ts`,
 * Story 1.11) for `ownerType: 'tenant'` — the scope every existing caller
 * of this endpoint already implicitly means. Read fresh on every call,
 * never folded into `ConnectorHealthCache`'s existing 60-second TTL cache
 * (ADR-0022's own dated note on this exact question: "activation can
 * simply be read fresh... no equivalent aggregation cost to what
 * deriveConnectorHealth() does"). A platform with no `connector_activations`
 * row returns `isActive: false`, never `null`/`undefined`, per Story 1.11's
 * own lazy-creation rule. Purely additive — `ConnectorHealth`'s own four
 * original fields, `deriveConnectorHealth()`, and the cache TTL/locality
 * decision are all unchanged.
 *
 * Explicitly out of scope: a user-scoped (`ownerType: 'user'`) variant of
 * this same read (no caller needs it yet); distinguishing "never activated"
 * from "deliberately deactivated" in the response (ADR-0051 Open Question 6).
 *
 * AC1: the response includes `isActive: boolean`, reflecting real
 *      activation state.
 * AC2: `isActive` is read fresh, not folded into the 60-second health
 *      cache — a GET immediately after activating (well within the TTL
 *      window) reflects the new state, not a stale cached one.
 * AC3: a platform with no activation row returns `isActive: false`, never
 *      `null`/`undefined`.
 * AC4: existing response fields are unchanged — this is purely additive.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool } from '../../src/db/adminPool';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';
import { flushConnectorHealthCache } from '../../src/connectors/connectorHealthCache';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
  await closeAdminPool();
});

async function makeTenantWithAdmin(): Promise<{ tenantId: string; adminUserId: string }> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  const adminEmail = `admin-${randomUUID()}@example.com`;
  const invitedAdmin = await createInvitedUser(tenant.id, { email: adminEmail, role: 'tenant_admin' });
  await resolveIdentity({ sub: `sub-${invitedAdmin.id}`, email: adminEmail });
  return { tenantId: tenant.id, adminUserId: invitedAdmin.id };
}

describe('Story 1.12 — GET /v1/connectors/:platformId includes isActive', () => {
  const app = createApp();

  it('AC3: a platform with no activation row returns isActive: false, never null/undefined', async () => {
    const { tenantId, adminUserId } = await makeTenantWithAdmin();
    const platformId = 'test-platform-1.12-never-activated';

    const res = await request(app)
      .get(`/v1/connectors/${platformId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }));

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it('AC1/AC4: isActive reflects real activation state, and existing ConnectorHealth fields are unchanged', async () => {
    const { tenantId, adminUserId } = await makeTenantWithAdmin();
    const platformId = 'test-platform-1.12-reflects-state';

    await setConnectorActivation(tenantId, platformId, 'tenant', true, adminUserId);

    const res = await request(app)
      .get(`/v1/connectors/${platformId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }));

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
    // Existing ConnectorHealth fields (Story 4.4/ADR-0022) are all still present.
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('lastSuccessfulFetchAt');
    expect(res.body).toHaveProperty('lastAttemptAt');
    expect(res.body).toHaveProperty('consecutiveFailures');
    expect(res.body).toHaveProperty('credentialStatus');
  });

  it('AC2: isActive is read fresh, not folded into the 60-second health cache', async () => {
    const { tenantId, adminUserId } = await makeTenantWithAdmin();
    const platformId = 'test-platform-1.12-fresh-not-cached';

    flushConnectorHealthCache();

    // First GET: not yet activated. This also populates the health cache
    // for this (tenantId, platformId) pair, well within its 60s TTL.
    const before = await request(app)
      .get(`/v1/connectors/${platformId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }));
    expect(before.body.isActive).toBe(false);

    await setConnectorActivation(tenantId, platformId, 'tenant', true, adminUserId);

    // Second GET, immediately after — still well within the health cache's
    // 60s TTL. If isActive were folded into that cache, this would still
    // read the stale `false` from the first call.
    const after = await request(app)
      .get(`/v1/connectors/${platformId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: adminUserId, role: 'tenant_admin' }));
    expect(after.body.isActive).toBe(true);
  });
});
