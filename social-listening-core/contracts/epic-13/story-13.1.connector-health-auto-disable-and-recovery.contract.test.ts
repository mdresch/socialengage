// Contract: Story 13.1 (ADR-0109) — Connector health auto-disable and recovery (backend)
// See docs/user-stories/epic-13-adr-0109-to-0117.md#story-13.1
//
// Intent: Story 13.1 — Connector health auto-disable and recovery (ADR-0109)
// Scope: src/connectors/connectorHealth.ts, src/ingestion/runIngestionAttempt.ts,
// src/ingestion/ingestionRunStore.ts, src/events/connectorIngestionAlertEvent.ts,
// src/events/publishConnectorAlertEvents.ts, src/http/versions/v1/connectorsRouter.ts,
// src/admin/platformAdminAuditLog.ts, .claude/skills/connector-health-and-error-handling/SKILL.md
// Contract to encode:
// (1) ConnectorHealth transitions to `failing` after 5 consecutive failed `ingestion_runs`
//     (counting any status='failed' run, not just non-retryable), superseding ADR-0023's
//     20-consecutive ceiling for Story 13.1.
// (2) A non-retryable ClassifiableError immediately disables the connector (status `disabled`);
//     credential-class 401/403 errors keep the existing `reconnect_required` status, now also
//     blocked and treated as a failing→disabled alert target.
// (3) `shouldAttemptIngestion()` returns `false` for `failing`, `disabled`, and `reconnect_required`
//     — the half-open probe for failing is removed.
// (4) `degraded` connectors auto-recover to `healthy` after 3 consecutive successful runs.
// (5) `POST /v1/connectors/:platformId/enable` re-enables a `failing`/`disabled` connector with a
//     health-check attempt; success -> `healthy`, failure -> `failing` with the consecutive-failure
//     counter reset to 1; every re-enable is recorded in `platform_admin_audit_log`.
// (6) `ConnectorIngestionAlertEvent` with `alertType: 'connector_disabled'` is emitted on the
//     `failing` -> `disabled` transition, and the existing `reconnect_required` alert type is emitted
//     on the `failing` -> `reconnect_required` transition.
//
// Explicitly out of scope: UI disabled badge / re-enable button (frontend); per-connector
// `limit=1` health-check implementations for connectors that do not yet expose `count`/`sample`
// (the health-check path is generic and falls back to a full `poll`/`pollUser` for those
// connectors, with `trigger_type='health_check'` recorded as the reset marker per ADR-0109).

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool } from '../../src/db/adminPool';
import { withTenant } from '../../src/db/withTenant';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import {
  startIngestionRun,
  completeIngestionRun,
} from '../../src/ingestion/ingestionRunStore';
import { ClassifiableError } from '../../src/ingestion/errorClassification';
import { runIngestionAttempt } from '../../src/ingestion/runIngestionAttempt';
import {
  deriveConnectorHealth,
  shouldAttemptIngestion,
  runConnectorHealthCheck,
  ConnectorHealth,
} from '../../src/connectors/connectorHealth';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';
import { registerSocialConnector, __resetRegistryForTests } from '../../src/connectors/registry';
import { SocialConnector } from '../../src/connectors/types';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import * as publishAlertEvents from '../../src/events/publishConnectorAlertEvents';
import { queryPlatformAdminAuditLog } from '../../src/admin/platformAdminAuditLog';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

beforeEach(() => {
  __resetRegistryForTests();
});

async function makeTenant(): Promise<string> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  return tenant.id;
}

async function makeTenantWithAdmin(): Promise<{ tenantId: string; userId: string }> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  const email = `admin-${randomUUID()}@example.com`;
  const invited = await createInvitedUser(tenant.id, { email, role: 'tenant_admin' });
  await resolveIdentity({ sub: `sub-${invited.id}`, email });
  return { tenantId: tenant.id, userId: invited.id };
}

async function makeTenantWithUser(): Promise<{ tenantId: string; userId: string }> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  const email = `user-${randomUUID()}@example.com`;
  const invited = await createInvitedUser(tenant.id, { email, role: 'tenant_user' });
  await resolveIdentity({ sub: `sub-${invited.id}`, email });
  return { tenantId: tenant.id, userId: invited.id };
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

async function recordRun(
  tenantId: string,
  platformId: string,
  status: 'succeeded' | 'failed',
  overrides: {
    retryable?: boolean;
    isCredentialFailure?: boolean;
    errorSummary?: string;
    triggerType?: 'poll' | 'health_check';
  } = {},
  userId?: string
): Promise<string> {
  const run = await startIngestionRun(tenantId, {
    platformId,
    triggerType: overrides.triggerType ?? 'poll',
    connectorVersion: '1.0.0',
    userId,
  });
  await completeIngestionRun(tenantId, run.id, {
    status,
    postsIngested: status === 'succeeded' ? 1 : 0,
    postsSkipped: 0,
    errorSummary: overrides.errorSummary,
    retryable: status === 'failed' ? overrides.retryable : undefined,
    isCredentialFailure: status === 'failed' ? (overrides.isCredentialFailure ?? false) : undefined,
  });
  return run.id;
}

async function createFailingConnector(
  tenantId: string,
  platformId: string,
  opts: { userId?: string; nonRetryable?: boolean } = {}
): Promise<ConnectorHealth> {
  await setConnectorActivation(tenantId, platformId, opts.userId ? 'user' : 'tenant', true, opts.userId, opts.userId);
  for (let i = 0; i < 5; i++) {
    await recordRun(tenantId, platformId, 'failed', {
      retryable: opts.nonRetryable ? false : true,
      errorSummary: `retryable failure ${i}`,
    }, opts.userId);
  }
  return deriveConnectorHealth(tenantId, platformId, opts.userId);
}

describe('Story 13.1 — Connector health auto-disable and recovery contract', () => {
  describe('AC1: 5 consecutive failed runs (any failure) -> failing', () => {
    it('transitions to failing after 5 consecutive retryable failures', async () => {
      const tenantId = await makeTenant();
      const platformId = `plat-fail-${randomUUID()}`;
      await setConnectorActivation(tenantId, platformId, 'tenant', true);

      for (let i = 0; i < 5; i++) {
        await recordRun(tenantId, platformId, 'failed', { retryable: true, errorSummary: `retryable ${i}` });
      }

      const health = await deriveConnectorHealth(tenantId, platformId);
      expect(health.status).toBe('failing');
      expect(health.consecutiveFailures).toBe(5);
      expect(await shouldAttemptIngestion(tenantId, platformId)).toBe(false);
    });

    it('transitions to failing after 5 consecutive unclassified (NULL retryable) failures', async () => {
      const tenantId = await makeTenant();
      const platformId = `plat-null-${randomUUID()}`;
      await setConnectorActivation(tenantId, platformId, 'tenant', true);

      for (let i = 0; i < 5; i++) {
        await recordRun(tenantId, platformId, 'failed', { retryable: undefined, errorSummary: `null ${i}` });
      }

      const health = await deriveConnectorHealth(tenantId, platformId);
      expect(health.status).toBe('failing');
      expect(health.consecutiveFailures).toBe(5);
    });

    it('4 consecutive failed runs is not failing', async () => {
      const tenantId = await makeTenant();
      const platformId = `plat-4-${randomUUID()}`;
      await setConnectorActivation(tenantId, platformId, 'tenant', true);

      for (let i = 0; i < 4; i++) {
        await recordRun(tenantId, platformId, 'failed', { retryable: true, errorSummary: `retryable ${i}` });
      }

      const health = await deriveConnectorHealth(tenantId, platformId);
      expect(health.status).not.toBe('failing');
      expect(health.consecutiveFailures).toBe(4);
    });

    it('consecutive-failure counter ignores successes and counts only trailing failed runs', async () => {
      const tenantId = await makeTenant();
      const platformId = `plat-mixed-${randomUUID()}`;
      await setConnectorActivation(tenantId, platformId, 'tenant', true);

      await recordRun(tenantId, platformId, 'failed', { retryable: true });
      await recordRun(tenantId, platformId, 'succeeded');
      for (let i = 0; i < 5; i++) {
        await recordRun(tenantId, platformId, 'failed', { retryable: true, errorSummary: `after-success ${i}` });
      }

      const health = await deriveConnectorHealth(tenantId, platformId);
      expect(health.status).toBe('failing');
      expect(health.consecutiveFailures).toBe(5);
    });
  });

  describe('AC2: non-retryable failures immediately disable', () => {
    it('a non-credential non-retryable run on an otherwise healthy connector -> disabled', async () => {
      const tenantId = await makeTenant();
      const platformId = `plat-disable-${randomUUID()}`;
      await recordRun(tenantId, platformId, 'succeeded');

      await recordRun(tenantId, platformId, 'failed', {
        retryable: false,
        errorSummary: 'malformed watchlist',
      });

      const health = await deriveConnectorHealth(tenantId, platformId);
      expect(health.status).toBe('disabled');
      expect(await shouldAttemptIngestion(tenantId, platformId)).toBe(false);
    });

    it('a credential-class 401/403 run -> reconnect_required (still blocked)', async () => {
      const tenantId = await makeTenant();
      const platformId = `plat-reconnect-${randomUUID()}`;
      await recordRun(tenantId, platformId, 'succeeded');

      await recordRun(tenantId, platformId, 'failed', {
        retryable: false,
        isCredentialFailure: true,
        errorSummary: 'OAuth token revoked',
      });

      const health = await deriveConnectorHealth(tenantId, platformId);
      expect(health.status).toBe('reconnect_required');
      expect(await shouldAttemptIngestion(tenantId, platformId)).toBe(false);
    });

    it('a non-retryable after the connector is already failing -> disabled and emits connector_disabled alert', async () => {
      const publishSpy = jest.spyOn(publishAlertEvents, 'publishConnectorAlertEvent').mockResolvedValue(null as any);

      const tenantId = await makeTenant();
      const platformId = `plat-fail-to-disable-${randomUUID()}`;
      await setConnectorActivation(tenantId, platformId, 'tenant', true);

      // First 5 retryable failures to reach failing.
      for (let i = 0; i < 5; i++) {
        await recordRun(tenantId, platformId, 'failed', { retryable: true, errorSummary: `before ${i}` });
      }

      const beforeHealth = await deriveConnectorHealth(tenantId, platformId);
      expect(beforeHealth.status).toBe('failing');

      // 6th run is a non-retryable, non-credential failure -> disabled.
      const ok = await runIngestionAttempt({
        tenantId,
        connectorInfo: { platformId, triggerType: 'poll', connectorVersion: '1.0.0' },
        maxRetries: 0,
        attempt: async () => {
          throw new ClassifiableError('malformed_watchlist', 'bad query');
        },
      });
      expect(ok.status).toBe('failed');

      const afterHealth = await deriveConnectorHealth(tenantId, platformId);
      expect(afterHealth.status).toBe('disabled');

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          platformId,
          alertType: 'connector_disabled',
        })
      );

      publishSpy.mockRestore();
    });

    it('a credential failure after the connector is already failing -> reconnect_required alert', async () => {
      const publishSpy = jest.spyOn(publishAlertEvents, 'publishConnectorAlertEvent').mockResolvedValue(null as any);

      const tenantId = await makeTenant();
      const platformId = `plat-fail-to-reconnect-${randomUUID()}`;
      await setConnectorActivation(tenantId, platformId, 'tenant', true);

      for (let i = 0; i < 5; i++) {
        await recordRun(tenantId, platformId, 'failed', { retryable: true, errorSummary: `before ${i}` });
      }

      const ok = await runIngestionAttempt({
        tenantId,
        connectorInfo: { platformId, triggerType: 'poll', connectorVersion: '1.0.0' },
        maxRetries: 0,
        attempt: async () => {
          throw new ClassifiableError('http_401', 'token revoked');
        },
      });
      expect(ok.status).toBe('failed');

      const afterHealth = await deriveConnectorHealth(tenantId, platformId);
      expect(afterHealth.status).toBe('reconnect_required');

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          platformId,
          alertType: 'reconnect_required',
        })
      );

      publishSpy.mockRestore();
    });
  });

  describe('AC3: auto-recovery from degraded to healthy', () => {
    it('1 failure then 1 success is degraded', async () => {
      const tenantId = await makeTenant();
      const platformId = `plat-degraded-${randomUUID()}`;
      await setConnectorActivation(tenantId, platformId, 'tenant', true);

      await recordRun(tenantId, platformId, 'failed', { retryable: true });
      await recordRun(tenantId, platformId, 'succeeded');

      const health = await deriveConnectorHealth(tenantId, platformId);
      expect(health.status).toBe('degraded');
    });

    it('1 failure then 3 consecutive successes becomes healthy', async () => {
      const tenantId = await makeTenant();
      const platformId = `plat-recover-${randomUUID()}`;
      await setConnectorActivation(tenantId, platformId, 'tenant', true);

      await recordRun(tenantId, platformId, 'failed', { retryable: true });
      await recordRun(tenantId, platformId, 'succeeded');
      await recordRun(tenantId, platformId, 'succeeded');
      await recordRun(tenantId, platformId, 'succeeded');

      const health = await deriveConnectorHealth(tenantId, platformId);
      expect(health.status).toBe('healthy');
      expect(health.consecutiveSuccesses).toBe(3);
    });

    it('recovery counter resets on a new failure after successes', async () => {
      const tenantId = await makeTenant();
      const platformId = `plat-recover-reset-${randomUUID()}`;
      await setConnectorActivation(tenantId, platformId, 'tenant', true);

      await recordRun(tenantId, platformId, 'failed', { retryable: true });
      await recordRun(tenantId, platformId, 'succeeded');
      await recordRun(tenantId, platformId, 'succeeded');
      await recordRun(tenantId, platformId, 'failed', { retryable: true });

      const health = await deriveConnectorHealth(tenantId, platformId);
      expect(health.status).toBe('degraded');
      expect(health.consecutiveSuccesses).toBe(0);
      expect(health.consecutiveFailures).toBe(1);
    });
  });

  describe('AC4: POST /v1/connectors/:platformId/enable', () => {
    it('re-enables a failing connector; a successful health check returns healthy and resets the counter', async () => {
      const { tenantId, userId } = await makeTenantWithAdmin();
      const platformId = `plat-enable-ok-${randomUUID()}`;
      const okConnector: SocialConnector = {
        ...fixtureConnector(platformId),
        authMode: 'none',
        deliveryMode: 'poll',
        poll: async (tId: string) =>
          runIngestionAttempt({
            tenantId: tId,
            connectorInfo: { platformId, triggerType: 'poll', connectorVersion: '1.0.0' },
            maxRetries: 0,
            attempt: async () => ({ postsIngested: 1, postsSkipped: 0 }),
          }),
      };
      registerSocialConnector(okConnector);

      await createFailingConnector(tenantId, platformId);

      const before = await shouldAttemptIngestion(tenantId, platformId);
      expect(before).toBe(false);

      const app = createApp();
      const res = await request(app)
        .post(`/v1/connectors/${platformId}/enable`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId, role: 'tenant_admin' }))
        .send({ ownerType: 'tenant' });

      expect(res.status).toBe(200);
      expect(res.body.health.status).toBe('healthy');
      expect(res.body.health.consecutiveFailures).toBe(0);
      expect(res.body.health.consecutiveSuccesses).toBe(1);
      expect(res.body.health.status).not.toBe('degraded');

      const after = await shouldAttemptIngestion(tenantId, platformId);
      expect(after).toBe(true);
    });

    it('a failed health check resets the counter to 1 and stays failing', async () => {
      const { tenantId, userId } = await makeTenantWithAdmin();
      const platformId = `plat-enable-fail-${randomUUID()}`;
      const failConnector: SocialConnector = {
        ...fixtureConnector(platformId),
        authMode: 'none',
        deliveryMode: 'poll',
        poll: async (tId: string) =>
          runIngestionAttempt({
            tenantId: tId,
            connectorInfo: { platformId, triggerType: 'poll', connectorVersion: '1.0.0' },
            maxRetries: 0,
            attempt: async () => {
              throw new ClassifiableError('network', 'still down');
            },
          }),
      };
      registerSocialConnector(failConnector);

      await createFailingConnector(tenantId, platformId);

      const app = createApp();
      const res = await request(app)
        .post(`/v1/connectors/${platformId}/enable`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId, role: 'tenant_admin' }))
        .send({ ownerType: 'tenant' });

      expect(res.status).toBe(200);
      expect(res.body.health.status).toBe('failing');
      expect(res.body.health.consecutiveFailures).toBe(1);
      expect(await shouldAttemptIngestion(tenantId, platformId)).toBe(false);
    });

    it('records every re-enable in platform_admin_audit_log', async () => {
      const { tenantId, userId } = await makeTenantWithAdmin();
      const platformId = `plat-audit-${randomUUID()}`;
      const okConnector: SocialConnector = {
        ...fixtureConnector(platformId),
        poll: async (tId: string) =>
          runIngestionAttempt({
            tenantId: tId,
            connectorInfo: { platformId, triggerType: 'poll', connectorVersion: '1.0.0' },
            maxRetries: 0,
            attempt: async () => ({ postsIngested: 1, postsSkipped: 0 }),
          }),
      };
      registerSocialConnector(okConnector);

      await createFailingConnector(tenantId, platformId);

      const app = createApp();
      const res = await request(app)
        .post(`/v1/connectors/${platformId}/enable`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId, role: 'tenant_admin' }))
        .send({ ownerType: 'tenant' });

      expect(res.status).toBe(200);

      const audit = await queryPlatformAdminAuditLog({ tenantId, operation: 'connector_enable' });
      expect(audit.entries.length).toBeGreaterThanOrEqual(1);
      const entry = audit.entries.find((e) => e.operation === 'connector_enable' && e.targetTenantId === tenantId);
      expect(entry).toBeTruthy();
      expect(entry!.detail).toMatchObject({ platformId, ownerType: 'tenant' });
    });

    it('allows a Tier-3 owning user to re-enable their own user-bound connector', async () => {
      const { tenantId, userId } = await makeTenantWithUser();
      const platformId = `plat-user-enable-${randomUUID()}`;
      const okConnector: SocialConnector = {
        ...fixtureConnector(platformId),
        deliveryMode: 'poll',
        authMode: 'oauth',
        pollUser: async (tId: string, uId: string) =>
          runIngestionAttempt({
            tenantId: tId,
            connectorInfo: { platformId, triggerType: 'poll', connectorVersion: '1.0.0', userId: uId },
            maxRetries: 0,
            attempt: async () => ({ postsIngested: 1, postsSkipped: 0 }),
          }),
      };
      registerSocialConnector(okConnector);

      await createFailingConnector(tenantId, platformId, { userId });

      const app = createApp();
      const res = await request(app)
        .post(`/v1/connectors/${platformId}/enable`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId, role: 'tenant_user' }))
        .send({ ownerType: 'user' });

      expect(res.status).toBe(200);
      expect(res.body.health.status).toBe('healthy');
    });

    it('rejects an unauthorized caller with 403', async () => {
      const { tenantId } = await makeTenantWithAdmin();
      const { userId: otherUser } = await makeTenantWithUser();
      const platformId = `plat-unauth-${randomUUID()}`;
      registerSocialConnector(fixtureConnector(platformId));

      const app = createApp();
      const res = await request(app)
        .post(`/v1/connectors/${platformId}/enable`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId: otherUser, role: 'tenant_user' }))
        .send({ ownerType: 'tenant' });

      expect(res.status).toBe(403);
    });

    it('rejects enable for an already-healthy connector', async () => {
      const { tenantId, userId } = await makeTenantWithAdmin();
      const platformId = `plat-healthy-${randomUUID()}`;
      registerSocialConnector(fixtureConnector(platformId));
      await setConnectorActivation(tenantId, platformId, 'tenant', true);
      await recordRun(tenantId, platformId, 'succeeded');

      const app = createApp();
      const res = await request(app)
        .post(`/v1/connectors/${platformId}/enable`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId, role: 'tenant_admin' }))
        .send({ ownerType: 'tenant' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/healthy|disabled|reconnect/);
    });
  });

  describe('AC5: health-check reset marker', () => {
    it('runConnectorHealthCheck records a health_check run and resets the failure streak', async () => {
      const { tenantId, userId } = await makeTenantWithAdmin();
      const platformId = `plat-hc-${randomUUID()}`;
      const okConnector: SocialConnector = {
        ...fixtureConnector(platformId),
        healthCheck: async (tId: string, uId?: string) =>
          runIngestionAttempt({
            tenantId: tId,
            connectorInfo: { platformId, triggerType: 'health_check', connectorVersion: '1.0.0', userId: uId },
            maxRetries: 0,
            attempt: async () => ({ postsIngested: 1, postsSkipped: 0 }),
          }),
      };
      registerSocialConnector(okConnector);

      await createFailingConnector(tenantId, platformId);

      const result = await withTenant(tenantId, async () =>
        runConnectorHealthCheck({ tenantId, platformId })
      );

      expect(result.status).toBe('succeeded');
      const health = await deriveConnectorHealth(tenantId, platformId);
      expect(health.status).toBe('healthy');
      expect(health.consecutiveFailures).toBe(0);
    });
  });
});
