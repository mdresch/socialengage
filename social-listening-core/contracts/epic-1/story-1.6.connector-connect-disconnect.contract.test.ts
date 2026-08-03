/**
 * Story 1.6 — Connector Connect/Disconnect Contract
 * Phase 1 "also build, not storied" work for connector credential management.
 *
 * AC0: POST /v1/connectors/:platformId/connect stores a credential and returns 201
 * AC1: POST with no authenticated identity returns 401
 * AC2: POST requires credential (string) in body, returns 400 without it
 * AC3: POST returns credential id, platformId, authMethod
 * AC4: DELETE /v1/connectors/:platformId/disconnect removes credential and returns 200
 * AC5: DELETE with no authenticated identity returns 401
 * AC6: Tenant isolation enforced — tenant can only access their own credentials
 * AC7: Connector health endpoint still works after connect
 *
 * 2026-08-03 — Story 5.10 (ADR-0033): AC1/AC5 rewritten from "missing
 * X-Tenant-Id header → 400" to "missing Authorization/X-Test-Identity → 401"
 * — rejection now happens in the auth middleware, before any route handler
 * runs, not a per-route header check. Every other AC below just swapped its
 * identity-establishment mechanism (X-Test-Identity via
 * testAuthBypassMiddleware, NODE_ENV==='test' only) — see
 * .claude/skills/tenant-auth-middleware/SKILL.md. Business-logic assertions
 * are otherwise unchanged.
 *
 * 2026-08-03 — Story 1.7 (ADR-0034): this story's own authorization/schema
 * shape is now explicitly superseded, per ADR-0034 §4 item 6's own naming
 * of this exact supersession (not a surprise regression this pass
 * discovered — the ADR itself, accepted before this contract was touched,
 * names Story 1.7 as reworking Story 1.6's shape). Every connect/disconnect
 * call below is a tenant-wide operation, which now requires the caller's
 * resolved role to be `tenant_admin` (ADR-0034 §3, ADR-0028 Tier 2) —
 * updated from the generic `testIdentityHeaderValue(tenantId)` (implicitly
 * `tenant_user`) to explicitly pass `{ role: 'tenant_admin' }`, since that
 * was always this test's own implicit intent (Story 1.6 had no
 * ownership-tier concept at all, only ever tested tenant-wide credentials).
 * No other assertion changed — this file still proves the same basic
 * wiring (credential storage, tenant isolation via RLS, the health endpoint
 * working post-connect) it always did, now under real authorization rather
 * than none. See `contracts/epic-1/story-1.7.ownership-tier-connect-
 * disconnect.contract.test.ts` for the new ownership-tier coverage this
 * file was never meant to duplicate.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';

// Real, cold Azure Key Vault RSA key creation/deletion can exceed Jest's 5000ms
// default hook timeout — same real-network reasoning as Story 5.3's identical
// pattern (contracts/epic-5/story-5.3.credential-envelope-encryption.contract.test.ts),
// which already sets this. Added 2026-08-03 via heal-contract-failure after a
// real, reproduced marginal timeout on this file's own beforeAll/afterAll hooks —
// not a functional bug, no assertion changed.
jest.setTimeout(30000);

const CONNECTOR_BASE = '/v1/connectors';
const TEST_PLATFORM_ID = 'test-platform';

let app: ReturnType<typeof createApp>;
let testKeyName: string;

beforeAll(async () => {
  // Create a test key for credential wrapping (same pattern as Story 5.3)
  testKeyName = `test-key-${randomUUID()}`;
  const key = await getKeyClient().createRsaKey(testKeyName, { keySize: 2048 });
  
  // Set the test key ID for the app to use
  process.env.KEY_VAULT_KEY_ID = key.id as string;
  
  app = createApp();
});

afterAll(async () => {
  // Clean up test key
  try {
    const poller = await getKeyClient().beginDeleteKey(testKeyName);
    await poller.pollUntilDone();
  } catch (err) {
    // Key may already be deleted or vault unavailable - ignore
  }
  await closePool();
});

describe('Story 1.6 — Connector Connect/Disconnect Contract', () => {

  describe('POST /v1/connectors/:platformId/connect', () => {
    it('AC0: stores a credential and returns 201', async () => {
      const tenantId = randomUUID();
      const credential = 'test-api-key-12345';
      
      const response = await request(app)
        .post(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}/connect`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { role: 'tenant_admin' }))
        .set('Content-Type', 'application/json')
        .send({ credential });

      expect(response.status).toBe(201);
      const body = response.body;
      expect(body).toHaveProperty('id');
      expect(body.id).toBeTruthy();
      expect(body.platformId).toBe(TEST_PLATFORM_ID);
      expect(body.authMethod).toBe('api_key');
    });

    it('AC1: with no authenticated identity returns 401', async () => {
      const response = await request(app)
        .post(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}/connect`)
        .set('Content-Type', 'application/json')
        .send({ credential: 'test-key' });

      expect(response.status).toBe(401);
    });

    it('AC2: requires credential (string) in body, returns 400 without it', async () => {
      const tenantId = randomUUID();
      const response = await request(app)
        .post(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}/connect`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { role: 'tenant_admin' }))
        .set('Content-Type', 'application/json')
        .send({});

      expect(response.status).toBe(400);
      const body = response.body;
      expect(body.error).toContain('credential');
    });

    it('AC3: returns credential id, platformId, authMethod', async () => {
      const tenantId = randomUUID();
      const credential = 'another-test-key';
      
      const response = await request(app)
        .post(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}/connect`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { role: 'tenant_admin' }))
        .set('Content-Type', 'application/json')
        .send({ credential });

      expect(response.status).toBe(201);
      const body = response.body;
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('platformId');
      expect(body).toHaveProperty('authMethod');
    });
  });

  describe('DELETE /v1/connectors/:platformId/disconnect', () => {
    it('AC4: removes credential and returns 200', async () => {
      const tenantId = randomUUID();
      
      // First connect
      await request(app)
        .post(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}/connect`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { role: 'tenant_admin' }))
        .set('Content-Type', 'application/json')
        .send({ credential: 'to-be-deleted' });

      // Then disconnect
      const response = await request(app)
        .delete(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}/disconnect`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { role: 'tenant_admin' }));

      expect(response.status).toBe(200);
      const body = response.body;
      expect(body.status).toBe('disconnected');
      expect(body.platformId).toBe(TEST_PLATFORM_ID);

      // Verify credential is actually deleted
      const countResult = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query(
          `SELECT COUNT(*) as count FROM platform_credentials WHERE platform_id = $1`,
          [TEST_PLATFORM_ID]
        );
        return parseInt(rows[0].count, 10);
      });
      expect(countResult).toBe(0);
    });

    it('AC5: with no authenticated identity returns 401', async () => {
      const response = await request(app)
        .delete(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}/disconnect`);

      expect(response.status).toBe(401);
    });
  });

  describe('Tenant isolation (AC6)', () => {
    it('tenant can only access their own credentials', async () => {
      const tenantId = randomUUID();
      const anotherTenantId = randomUUID();
      
      // Connect as tenantId
      await request(app)
        .post(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}/connect`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { role: 'tenant_admin' }))
        .set('Content-Type', 'application/json')
        .send({ credential: 'tenant1-key' });

      // Try to disconnect as another tenant - should succeed (no error) but not affect tenantId's data
      // due to RLS - the delete will affect 0 rows for anotherTenantId
      const response = await request(app)
        .delete(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}/disconnect`)
        .set('X-Test-Identity', testIdentityHeaderValue(anotherTenantId, { role: 'tenant_admin' }));

      // RLS should prevent the delete from affecting other tenants
      // The endpoint returns 200 but no rows are deleted for anotherTenantId
      expect(response.status).toBe(200);

      // Verify tenantId's credential is still there
      const countResult = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query(
          `SELECT COUNT(*) as count FROM platform_credentials WHERE platform_id = $1`,
          [TEST_PLATFORM_ID]
        );
        return parseInt(rows[0].count, 10);
      });
      expect(countResult).toBe(1);
    });
  });

  describe('AC7: Connector health endpoint still works after connect', () => {
    it('health endpoint returns data for connected platform', async () => {
      const tenantId = randomUUID();
      
      // Connect first
      await request(app)
        .post(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}/connect`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { role: 'tenant_admin' }))
        .set('Content-Type', 'application/json')
        .send({ credential: 'health-test-key' });

      // Check health
      const response = await request(app)
        .get(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { role: 'tenant_admin' }));

      expect(response.status).toBe(200);
      const body = response.body;
      // Health endpoint should return data
      expect(body).toHaveProperty('status');
    });
  });
});
