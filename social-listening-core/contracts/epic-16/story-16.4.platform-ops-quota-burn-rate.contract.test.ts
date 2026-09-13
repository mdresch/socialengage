// Contract: Story 16.4 (ADR-0128, BRD-0128, FDD-0128, TDS-0128) — Platform Ops Quota Burn-Rate Forecasting and Connector Remediation (Backend)
// Intent:
// - Story: Story 16.4 (Epic 16)
// - ADR: ADR-0128 (Platform operations dashboard refinements — quota burn-rate forecasting and connector health playbooks)
// - BRD/FDD/TDS: BRD-0128, FDD-0128, TDS-0128
// - Scope:
//   1. AC1: Compute trailing 7-day token/ingestion velocity and linear burn-rate projection (healthy, warning_30d, critical_7d).
//   2. AC2: GET /v1/admin/platform-dashboard returns tenantQuotaBurnProjections containing quota velocity and exhaustion forecasts.
//   3. AC3: POST /v1/admin/connectors/:id/remediate role-gated to platform_admin with audit logging for retry_now, reprompt_credentials, override_backoff, clear_error_state.
// - Out of scope:
//   - Operator UI drawer & forecasting widget (separate frontend step).
//   - Automated self-healing retries without operator intervention (Q-0128-1).

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool, getPool } from '../../src/db/pool';
import {
  computeBurnProjection,
} from '../../src/platform/quotaBurnRatePredictor';

jest.setTimeout(30000);

afterAll(async () => {
  await closeAdminPool();
  await closePlatformAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

describe('Story 16.4 — Platform Ops Quota Burn-Rate Forecasting and Connector Remediation Backend Contract', () => {
  const app = createApp();

  describe('AC1: Trailing 7-Day Velocity & Linear Burn-Rate Calculation Engine', () => {
    it('accurately computes daily velocity, days remaining, and classifies health status', () => {
      // 1. Healthy: 50,000 monthly quota, 10,000 consumed, avg 500/day -> 40,000 / 500 = 80 days (>30d)
      const healthyProj = computeBurnProjection(50000, 10000, [500, 500, 500, 500, 500, 500, 500]);
      expect(healthyProj.dailyVelocity7d).toBe(500);
      expect(healthyProj.daysRemaining).toBe(80);
      expect(healthyProj.status).toBe('healthy');
      expect(healthyProj.projectedExhaustionDate).toBeDefined();

      // 2. Warning (8-30d): 100,000 monthly quota, 70,000 consumed, avg 1,500/day -> 30,000 / 1500 = 20 days
      const warningProj = computeBurnProjection(100000, 70000, [1500, 1500, 1500, 1500, 1500, 1500, 1500]);
      expect(warningProj.dailyVelocity7d).toBe(1500);
      expect(warningProj.daysRemaining).toBe(20);
      expect(warningProj.status).toBe('warning_30d');

      // 3. Critical (<=7d): 50,000 quota, 45,000 consumed, avg 2,000/day -> 5,000 / 2000 = 2.5 days
      const criticalProj = computeBurnProjection(50000, 45000, [2000, 2000, 2000, 2000, 2000, 2000, 2000]);
      expect(criticalProj.dailyVelocity7d).toBe(2000);
      expect(criticalProj.daysRemaining).toBe(2.5);
      expect(criticalProj.status).toBe('critical_7d');

      // 4. Exhausted (already consumed >= total)
      const exhaustedProj = computeBurnProjection(50000, 52000, [1000, 1000, 1000, 1000, 1000, 1000, 1000]);
      expect(exhaustedProj.daysRemaining).toBe(0);
      expect(exhaustedProj.status).toBe('critical_7d');

      // 5. Zero velocity: no exhaustion
      const zeroVelProj = computeBurnProjection(50000, 1000, [0, 0, 0, 0, 0, 0, 0]);
      expect(zeroVelProj.dailyVelocity7d).toBe(0);
      expect(zeroVelProj.daysRemaining).toBeNull();
      expect(zeroVelProj.projectedExhaustionDate).toBeNull();
      expect(zeroVelProj.status).toBe('healthy');
    });
  });

  describe('AC2: GET /v1/admin/platform-dashboard Exposing Tenant Quota Burn Projections', () => {
    it('returns tenantQuotaBurnProjections alongside platform summary metrics', async () => {
      const tenant = await createTenantFixture(`burn-tenant-${randomUUID()}`);
      const adminHeaders = {
        'x-test-identity': testIdentityHeaderValue(tenant.id, {
          role: 'platform_admin',
        }),
      };

      const res = await request(app)
        .get('/v1/admin/platform-dashboard')
        .set(adminHeaders);

      expect(res.status).toBe(200);
      expect(res.body.throughputPostsSec).toBeDefined();
      expect(res.body.tenantQuotaBurnProjections).toBeInstanceOf(Array);

      if (res.body.tenantQuotaBurnProjections.length > 0) {
        const proj = res.body.tenantQuotaBurnProjections[0];
        expect(proj.tenantId).toBeDefined();
        expect(proj.tenantName).toBeDefined();
        expect(proj.monthlyQuota).toBeGreaterThan(0);
        expect(proj.consumedTokens).toBeGreaterThanOrEqual(0);
        expect(proj.dailyVelocity7d).toBeGreaterThanOrEqual(0);
        expect(['healthy', 'warning_30d', 'critical_7d']).toContain(proj.status);
      }
    });
  });

  describe('AC3: Role-Gated Remediation API with Audit Logging', () => {
    it('forbids standard tenant users from executing connector remediation playbooks', async () => {
      const tenant = await createTenantFixture(`ac3-forbid-${randomUUID()}`);
      const userHeaders = {
        'x-test-identity': testIdentityHeaderValue(tenant.id, {
          role: 'tenant_user',
        }),
      };

      const res = await request(app)
        .post('/v1/admin/connectors/conn-1/remediate')
        .set(userHeaders)
        .send({ action: 'retry_now' });

      expect(res.status).toBe(403);
    });

    it('allows platform_admin to execute override_backoff and records audit entry', async () => {
      const tenant = await createTenantFixture(`ac3-remediate-${randomUUID()}`);
      const platformAdminHeaders = {
        'x-test-identity': testIdentityHeaderValue(tenant.id, {
          role: 'platform_admin',
        }),
      };

      const connectorId = `conn-gnews-${randomUUID()}`;

      const res = await request(app)
        .post(`/v1/admin/connectors/${connectorId}/remediate`)
        .set(platformAdminHeaders)
        .send({
          action: 'override_backoff',
          overrideMinutes: 20,
        });

      expect(res.status).toBe(200);
      expect(res.body.connectorId).toBe(connectorId);
      expect(res.body.status).toBe('active');
      expect(res.body.action).toBe('override_backoff');
      expect(res.body.backoffLiftedUntil).toBeDefined();

      // Check audit log row
      const { rows } = await getPlatformAdminPool().query<{
        operation: string;
        detail: any;
      }>(
        `SELECT operation, detail FROM platform_admin_audit_log
         WHERE operation = 'connector_remediation' AND (detail->>'connectorId' = $1)
         ORDER BY created_at DESC LIMIT 1`,
        [connectorId]
      );

      expect(rows.length).toBe(1);
      expect(rows[0].operation).toBe('connector_remediation');
      expect(rows[0].detail.action).toBe('override_backoff');
      expect(rows[0].detail.overrideMinutes).toBe(20);
    });

    it('allows platform_admin to execute retry_now and clear_error_state playbooks', async () => {
      const tenant = await createTenantFixture(`ac3-playbooks-${randomUUID()}`);
      const platformAdminHeaders = {
        'x-test-identity': testIdentityHeaderValue(tenant.id, {
          role: 'platform_admin',
        }),
      };

      const connId1 = `conn-retry-${randomUUID()}`;
      const retryRes = await request(app)
        .post(`/v1/admin/connectors/${connId1}/remediate`)
        .set(platformAdminHeaders)
        .send({ action: 'retry_now' });

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.action).toBe('retry_now');
      expect(retryRes.body.status).toBe('retrying');

      const connId2 = `conn-clear-${randomUUID()}`;
      const clearRes = await request(app)
        .post(`/v1/admin/connectors/${connId2}/remediate`)
        .set(platformAdminHeaders)
        .send({ action: 'clear_error_state' });

      expect(clearRes.status).toBe(200);
      expect(clearRes.body.action).toBe('clear_error_state');
      expect(clearRes.body.status).toBe('healthy');
    });
  });
});
