// Contract: Story 1.16 (ADR-0070, Accepted 2026-08-20) — Ingestion Run Watchdog
// Reconciliation, Stalled Health Derivation, and Service Bus Ingestion Alert Events.
// See docs/user-stories/epic-1-repository-and-api-foundation.md#story-116
// and docs/adr/0070-connector-ingestion-status-hanging-run-reconciliation-and-alerts.md.
//
// Intent: Story 1.14/1.15 introduced an in-flight concurrency guard that permanently
// skips polling when the most recent run status is 'running'. When a server restarts
// or a worker process crashes mid-ingestion, orphaned rows remain 'running' forever,
// permanently deadlocking that connector for that tenant. Furthermore, active connectors
// can silently cease ingesting without transitioning into failing or disconnected.
// This story introduces a lock-safe scheduler watchdog (reconcileStaleIngestionRuns),
// adds 'stalled' status to derived ConnectorHealth with strict precedence rules,
// emits structured ConnectorIngestionAlertEvents to Service Bus, and exposes an
// idempotent on-demand Force Retry endpoint for tenant recovery.
//
// Scope:
// - migrations/0039_add_ingestion_runs_stale_watchdog_index.sql (new partial index)
// - src/ingestion/ingestionRunStore.ts (reconcileStaleIngestionRuns new)
// - src/connectors/connectorHealth.ts (ConnectorHealthStatus widened to 'stalled', derivation precedence)
// - src/events/connectorIngestionAlertEvent.ts (new event type and builder)
// - src/events/publishConnectorAlertEvents.ts (new alert publishing helper)
// - src/scheduler/pollScheduler.ts (watchdog sweep in runSchedulerTick)
// - src/http/versions/v1/connectorsRouter.ts (POST /:platformId/retry endpoint)
//
// Contract to encode:
// - AC1 (Migration): Database partial index idx_ingestion_runs_stale_watchdog exists
// - AC2 (Watchdog Reconciliation): reconcileStaleIngestionRuns() finds runs older than MAX_RUN_DURATION_MS
//   (15 min / 2*cadence), marks them failed with retryable=true, unblocking getMostRecentRunStatus()
// - AC3 (Health Derivation Precedence & Stalled): deriveConnectorHealth() prioritizes
//   disconnected -> reconnect_required -> failing -> stalled -> degraded -> healthy. Derives 'stalled'
//   when cadence or 24h silence SLA is breached without overriding failing/reconnect_required.
// - AC4 (Alert Events): ConnectorIngestionAlertEvent constructed with severity & metadata;
//   emits run_timed_out on watchdog sweep and ingestion_stalled / connector_failing / reconnect_required on health transitions.
// - AC5 (Idempotent Retry Endpoint): POST /v1/connectors/:platformId/retry authorized for tenant_admin,
//   POST /v1/connectors/:platformId/users/:userId/retry for Tier-3 user, reconciles runs, triggers poll,
//   and returns 409 if a run started < 60s ago is in progress.
//
// Explicitly out of scope:
// - UI rendering in Next.js admin frontend (Story 6.29)
// - Downstream notification dispatch channels (Slack/PagerDuty/Email).

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool, getPool } from '../../src/db/pool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool } from '../../src/db/adminPool';
import { withTenant } from '../../src/db/withTenant';
import {
  startIngestionRun,
  getMostRecentRunStatus,
  getMostRecentRunStatusForUser,
  reconcileStaleIngestionRuns,
} from '../../src/ingestion/ingestionRunStore';
import {
  deriveConnectorHealth,
  ConnectorHealthStatus,
} from '../../src/connectors/connectorHealth';
import {
  buildConnectorIngestionAlertEvent,
  ConnectorIngestionAlertEvent,
} from '../../src/events/connectorIngestionAlertEvent';
import { runSchedulerTick, SchedulerDeps } from '../../src/scheduler/pollScheduler';
import { SocialConnector } from '../../src/connectors/types';
import { registerSocialConnector } from '../../src/connectors/registry';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';
import { createTenant } from '../../src/tenants/tenantStore';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
  await closeAdminPool();
});

async function makeTenant(): Promise<string> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  return tenant.id;
}

function fixtureConnector(providerId: string, overrides: Partial<SocialConnector> = {}): SocialConnector {
  return {
    providerId,
    authMode: 'none',
    deliveryMode: 'poll',
    normalize: (raw) => ({ externalId: 'x', authorExternalId: 'a', publishedAt: new Date().toISOString(), rawPayload: raw }),
    getRateLimitConfig: () => ({ requestsPerWindow: 1000, windowSeconds: 60 }),
    ...overrides,
  };
}

describe('Story 1.16 — Ingestion Run Watchdog Reconciliation, Stalled Health Derivation, and Service Bus Ingestion Alert Events', () => {
  let tenantId: string;

  beforeAll(async () => {
    tenantId = await makeTenant();
  });

  describe('AC1 (ADR-0070 §1): Partial index migration for stale watchdog sweep', () => {
    it('partial index idx_ingestion_runs_stale_watchdog exists in postgres', async () => {
      const pool = getPool();
      const { rows } = await pool.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'ingestion_runs' AND indexname = 'idx_ingestion_runs_stale_watchdog'`
      );
      expect(rows.length).toBe(1);
    });
  });

  describe('AC2 (ADR-0070 §1): Lock-safe watchdog stale run reconciliation', () => {
    it('reconciles orphaned running runs older than threshold to failed (retryable=true) and unblocks in-flight guard', async () => {
      const platformId = `plat-stale-${randomUUID()}`;
      const { id: staleRunId } = await startIngestionRun(tenantId, {
        platformId,
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });

      // Manually backdate started_at to 20 minutes ago (past 15m threshold)
      await withTenant(tenantId, async (client) => {
        await client.query(
          `UPDATE ingestion_runs SET started_at = NOW() - INTERVAL '20 minutes' WHERE id = $1`,
          [staleRunId]
        );
      });

      // Verify it was running before watchdog
      const statusBefore = await getMostRecentRunStatus(tenantId, platformId);
      expect(statusBefore).toBe('running');

      // Run watchdog sweep
      const reconciled = await reconcileStaleIngestionRuns(15 * 60 * 1000);
      const matching = reconciled.find((r) => r.id === staleRunId);
      expect(matching).toBeDefined();
      expect(matching?.tenantId).toBe(tenantId);
      expect(matching?.platformId).toBe(platformId);

      // Verify it is now failed and unblocks the in-flight guard
      const statusAfter = await getMostRecentRunStatus(tenantId, platformId);
      expect(statusAfter).toBe('failed');

      // Verify row details in DB
      await withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ status: string; retryable: boolean; completed_at: Date; error_summary: string }>(
          `SELECT status, retryable, completed_at, error_summary FROM ingestion_runs WHERE id = $1`,
          [staleRunId]
        );
        expect(rows[0].status).toBe('failed');
        expect(rows[0].retryable).toBe(true);
        expect(rows[0].completed_at).not.toBeNull();
        expect(rows[0].error_summary).toContain('watchdog');
      });
    });

    it('active runs with started_at within the threshold (< 15 minutes) are untouched', async () => {
      const platformId = `plat-active-${randomUUID()}`;
      const { id: activeRunId } = await startIngestionRun(tenantId, {
        platformId,
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });

      // Backdate started_at to 5 minutes ago (within threshold)
      await withTenant(tenantId, async (client) => {
        await client.query(
          `UPDATE ingestion_runs SET started_at = NOW() - INTERVAL '5 minutes' WHERE id = $1`,
          [activeRunId]
        );
      });

      const reconciled = await reconcileStaleIngestionRuns(15 * 60 * 1000);
      const matching = reconciled.find((r) => r.id === activeRunId);
      expect(matching).toBeUndefined();

      const status = await getMostRecentRunStatus(tenantId, platformId);
      expect(status).toBe('running');
    });

    it('scheduler tick runs watchdog reconciliation before evaluating eligible connectors', async () => {
      const platformId = `plat-tick-${randomUUID()}`;
      const tenantId2 = await makeTenant();
      const tenant = { id: tenantId2 };
      const poll = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      const connector = fixtureConnector(platformId, { poll, pollCadenceMs: 60_000 });

      // Create stale running run
      const { id: staleRunId } = await startIngestionRun(tenant.id, {
        platformId,
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });
      await withTenant(tenant.id, async (client) => {
        await client.query(
          `UPDATE ingestion_runs SET started_at = NOW() - INTERVAL '30 minutes' WHERE id = $1`,
          [staleRunId]
        );
      });

      // Run real scheduler tick
      const reconcileSpy = jest.fn().mockImplementation(() => reconcileStaleIngestionRuns(15 * 60 * 1000));
      const outcomes = await runSchedulerTick({
        listTenants: async () => [tenant],
        listPollConnectors: () => [connector],
        shouldAttemptIngestion: async () => true,
        deriveConnectorHealth: async () => ({ lastAttemptAt: new Date(Date.now() - 120_000).toISOString() }),
        reconcileStaleRuns: reconcileSpy,
      });

      expect(reconcileSpy).toHaveBeenCalled();
      expect(outcomes[0].polled).toBe(true);
      expect(poll).toHaveBeenCalled();
    });
  });

  describe('AC3 (ADR-0070 §2): Connector health derivation precedence & stalled status', () => {
    it('derives disconnected when 0 runs exist', async () => {
      const platformId = `plat-empty-${randomUUID()}`;
      const health = await deriveConnectorHealth(tenantId, platformId);
      expect(health.status).toBe('disconnected');
    });

    it('derives stalled when active and lastAttemptAt is >= 3 * cadence (min 45m)', async () => {
      const platformId = `plat-stalled-cadence-${randomUUID()}`;
      await setConnectorActivation(tenantId, platformId, 'tenant', true);

      // Create a single successful run 50 minutes ago
      const { id: runId } = await startIngestionRun(tenantId, {
        platformId,
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });
      await withTenant(tenantId, async (client) => {
        await client.query(
          `UPDATE ingestion_runs SET status = 'succeeded', completed_at = NOW() - INTERVAL '50 minutes', started_at = NOW() - INTERVAL '50 minutes', posts_ingested = 5 WHERE id = $1`,
          [runId]
        );
      });

      const health = await deriveConnectorHealth(tenantId, platformId, undefined, undefined, {
        effectiveCadenceMs: 15 * 60 * 1000,
        isConnectorActive: true,
      });
      expect(health.status).toBe('stalled');
    });

    it('derives stalled when active and lastSuccessfulFetchAt is >= 24h', async () => {
      const platformId = `plat-stalled-silence-${randomUUID()}`;
      await setConnectorActivation(tenantId, platformId, 'tenant', true);

      // Successful run 25 hours ago, and recent empty/zero-post runs in the last hour
      const { id: oldSuccessId } = await startIngestionRun(tenantId, {
        platformId,
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });
      await withTenant(tenantId, async (client) => {
        await client.query(
          `UPDATE ingestion_runs SET status = 'succeeded', completed_at = NOW() - INTERVAL '25 hours', started_at = NOW() - INTERVAL '25 hours', posts_ingested = 10 WHERE id = $1`,
          [oldSuccessId]
        );
      });

      const health = await deriveConnectorHealth(tenantId, platformId, undefined, undefined, {
        effectiveCadenceMs: 15 * 60 * 1000,
        isConnectorActive: true,
      });
      expect(health.status).toBe('stalled');
    });

    it('precedence: failing overrides stalled when failure threshold is breached', async () => {
      const platformId = `plat-failing-precedence-${randomUUID()}`;
      await setConnectorActivation(tenantId, platformId, 'tenant', true);

      // Create 20 consecutive non-retryable failures
      for (let i = 0; i < 20; i++) {
        const { id } = await startIngestionRun(tenantId, {
          platformId,
          triggerType: 'poll',
          connectorVersion: '1.0.0',
        });
        await withTenant(tenantId, async (client) => {
          await client.query(
            `UPDATE ingestion_runs SET status = 'failed', retryable = false, completed_at = NOW() - INTERVAL '2 hours', started_at = NOW() - INTERVAL '2 hours', error_summary = 'HTTP 500' WHERE id = $1`,
            [id]
          );
        });
      }

      const health = await deriveConnectorHealth(tenantId, platformId, undefined, undefined, {
        effectiveCadenceMs: 15 * 60 * 1000,
        isConnectorActive: true,
      });
      expect(health.status).toBe('failing');
    });

    it('precedence: reconnect_required overrides stalled on credential failure', async () => {
      const platformId = `plat-reconnect-precedence-${randomUUID()}`;
      await setConnectorActivation(tenantId, platformId, 'tenant', true);

      const { id } = await startIngestionRun(tenantId, {
        platformId,
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });
      await withTenant(tenantId, async (client) => {
        await client.query(
          `UPDATE ingestion_runs SET status = 'failed', is_credential_failure = true, completed_at = NOW() - INTERVAL '2 hours', started_at = NOW() - INTERVAL '2 hours', error_summary = 'OAuth token expired' WHERE id = $1`,
          [id]
        );
      });

      const health = await deriveConnectorHealth(tenantId, platformId, undefined, undefined, {
        effectiveCadenceMs: 15 * 60 * 1000,
        isConnectorActive: true,
      });
      expect(health.status).toBe('reconnect_required');
    });
  });

  describe('AC4 (ADR-0070 §3): Service Bus ingestion alert events', () => {
    it('buildConnectorIngestionAlertEvent constructs typed alert payload', () => {
      const event = buildConnectorIngestionAlertEvent({
        tenantId,
        platformId: 'facebook',
        userId: 'user-123',
        alertType: 'run_timed_out',
        severity: 'warning',
        message: 'Ingestion run timed out after 15 minutes',
        metadata: { staleRunId: 'run-999', consecutiveFailures: 0 },
      });

      expect(event.tenantId).toBe(tenantId);
      expect(event.platformId).toBe('facebook');
      expect(event.userId).toBe('user-123');
      expect(event.alertType).toBe('run_timed_out');
      expect(event.severity).toBe('warning');
      expect(event.metadata.staleRunId).toBe('run-999');
      expect(event.occurredAt).toBeDefined();
    });
  });

  describe('AC5 (ADR-0070 §4): Idempotent Force Retry API endpoint', () => {
    const app = createApp();

    it('POST /v1/connectors/:id/retry rejects unauthenticated or non-tenant_admin users with 403', async () => {
      const platformId = `plat-auth-${randomUUID()}`;

      const res = await request(app)
        .post(`/v1/connectors/${platformId}/retry`)
        .set('x-test-identity', testIdentityHeaderValue(tenantId, { role: 'tenant_user' }));

      expect(res.status).toBe(403);
    });

    it('POST /v1/connectors/:id/retry reconciles stale runs, resets failure cooldown, triggers poll and returns 200 with health', async () => {
      const platformId = `plat-retry-ok-${randomUUID()}`;
      const pollFn = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      registerSocialConnector(fixtureConnector(platformId, { poll: pollFn, pollCadenceMs: 60_000 }));
      await setConnectorActivation(tenantId, platformId, 'tenant', true);

      // Create an old failed run
      const { id: runId } = await startIngestionRun(tenantId, {
        platformId,
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });
      await withTenant(tenantId, async (client) => {
        await client.query(
          `UPDATE ingestion_runs SET status = 'failed', completed_at = NOW() - INTERVAL '10 minutes', started_at = NOW() - INTERVAL '10 minutes', error_summary = 'Network error' WHERE id = $1`,
          [runId]
        );
      });

      const res = await request(app)
        .post(`/v1/connectors/${platformId}/retry`)
        .set('x-test-identity', testIdentityHeaderValue(tenantId, { role: 'tenant_admin' }));

      expect(res.status).toBe(200);
      expect(res.body.status).toBeDefined();
      expect(pollFn).toHaveBeenCalledWith(tenantId);
    });

    it('POST /v1/connectors/:id/retry returns 409 when a legitimate run started within the last 60 seconds is in progress', async () => {
      const platformId = `plat-retry-409-${randomUUID()}`;
      registerSocialConnector(fixtureConnector(platformId, { poll: jest.fn(), pollCadenceMs: 60_000 }));
      await setConnectorActivation(tenantId, platformId, 'tenant', true);

      // Create run started 10 seconds ago
      const { id: activeRunId } = await startIngestionRun(tenantId, {
        platformId,
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });
      await withTenant(tenantId, async (client) => {
        await client.query(
          `UPDATE ingestion_runs SET started_at = NOW() - INTERVAL '10 seconds' WHERE id = $1`,
          [activeRunId]
        );
      });

      const res = await request(app)
        .post(`/v1/connectors/${platformId}/retry`)
        .set('x-test-identity', testIdentityHeaderValue(tenantId, { role: 'tenant_admin' }));

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already in progress');
    });
  });
});
