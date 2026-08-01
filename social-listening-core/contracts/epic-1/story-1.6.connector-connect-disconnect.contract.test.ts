/**
 * Story 1.6 — Connector Connect/Disconnect Contract
 * Phase 1 "also build, not storied" work for connector credential management.
 * 
 * AC0: POST /v1/connectors/:platformId/connect stores a credential and returns 201
 * AC1: POST requires X-Tenant-Id header, returns 400 without it
 * AC2: POST requires credential (string) in body, returns 400 without it
 * AC3: POST returns credential id, platformId, authMethod
 * AC4: DELETE /v1/connectors/:platformId/disconnect removes credential and returns 200
 * AC5: DELETE requires X-Tenant-Id header, returns 400 without it
 * AC6: Tenant isolation enforced — tenant can only access their own credentials
 * AC7: Connector health endpoint still works after connect
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';

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
        .set('X-Tenant-Id', tenantId)
        .set('Content-Type', 'application/json')
        .send({ credential });

      expect(response.status).toBe(201);
      const body = response.body;
      expect(body).toHaveProperty('id');
      expect(body.id).toBeTruthy();
      expect(body.platformId).toBe(TEST_PLATFORM_ID);
      expect(body.authMethod).toBe('api_key');
    });

    it('AC1: requires X-Tenant-Id header, returns 400 without it', async () => {
      const response = await request(app)
        .post(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}/connect`)
        .set('Content-Type', 'application/json')
        .send({ credential: 'test-key' });

      expect(response.status).toBe(400);
      const body = response.body;
      expect(body.error).toContain('X-Tenant-Id');
    });

    it('AC2: requires credential (string) in body, returns 400 without it', async () => {
      const tenantId = randomUUID();
      const response = await request(app)
        .post(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}/connect`)
        .set('X-Tenant-Id', tenantId)
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
        .set('X-Tenant-Id', tenantId)
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
        .set('X-Tenant-Id', tenantId)
        .set('Content-Type', 'application/json')
        .send({ credential: 'to-be-deleted' });

      // Then disconnect
      const response = await request(app)
        .delete(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}/disconnect`)
        .set('X-Tenant-Id', tenantId);

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

    it('AC5: requires X-Tenant-Id header, returns 400 without it', async () => {
      const response = await request(app)
        .delete(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}/disconnect`);

      expect(response.status).toBe(400);
      const body = response.body;
      expect(body.error).toContain('X-Tenant-Id');
    });
  });

  describe('Tenant isolation (AC6)', () => {
    it('tenant can only access their own credentials', async () => {
      const tenantId = randomUUID();
      const anotherTenantId = randomUUID();
      
      // Connect as tenantId
      await request(app)
        .post(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}/connect`)
        .set('X-Tenant-Id', tenantId)
        .set('Content-Type', 'application/json')
        .send({ credential: 'tenant1-key' });

      // Try to disconnect as another tenant - should succeed (no error) but not affect tenantId's data
      // due to RLS - the delete will affect 0 rows for anotherTenantId
      const response = await request(app)
        .delete(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}/disconnect`)
        .set('X-Tenant-Id', anotherTenantId);

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
        .set('X-Tenant-Id', tenantId)
        .set('Content-Type', 'application/json')
        .send({ credential: 'health-test-key' });

      // Check health
      const response = await request(app)
        .get(`${CONNECTOR_BASE}/${TEST_PLATFORM_ID}`)
        .set('X-Tenant-Id', tenantId);

      expect(response.status).toBe(200);
      const body = response.body;
      // Health endpoint should return data
      expect(body).toHaveProperty('status');
    });
  });
});
