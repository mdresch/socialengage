// Contract: Story 2.5 (ADR-0023, superseded in part by ADR-0109/Story 13.1) —
// connector failure threshold.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-25--proportional-rate-relative-connector-failure-threshold
//
// Intent: Story 2.5 — Proportional, rate-relative connector failure
// threshold (ADR-0023)
//
// Scope: src/connectors/connectorHealth.ts (deriveConnectorHealth's `failing`
// derivation and shouldAttemptIngestion behavior only).
//
// Supersession update, 2026-08-28 (ADR-0109, Story 13.1): the rate-relative
// rule (>=50% of >=5 attempts in the trailing hour) and the 20-consecutive
// absolute ceiling are replaced. `failing` now follows directly from **5
// consecutive failed `ingestion_runs` of any kind**. Retryable vs
// non-retryable still matters: a non-retryable (`retryable = false`)
// failure on the *latest* run immediately disables the connector, taking
// precedence over `failing`; the latest run with `is_credential_failure =
// true` immediately yields `reconnect_required`, taking precedence over both.
// The half-open probe cooldown (`PROBE_COOLDOWN_MS`) added by the 2026-08-17
// healing pass is removed: `failing`, `disabled`, and `reconnect_required`
// are all blocked states — the only recovery path is the new
// `POST /v1/connectors/:platformId/enable` health check.
//
// Contract to encode under ADR-0109:
// (1) 5 consecutive failed runs -> `failing`.
// (2) Fewer than 5 consecutive failed runs -> not `failing` (degraded/stalled/healthy).
// (3) The 5-consecutive threshold is window-independent: failures spread
//     hours apart still count, because the streak is a counter, not a rate.
// (4) `shouldAttemptIngestion()` is `false` for a `failing` connector and
//     stays `false` — there is no probe allowance.
// (5) A non-retryable latest run immediately yields `disabled`.
//
// Out of scope: the manual re-enable flow (`POST .../enable`) is Story 13.1's
// own contract; `degraded` auto-recovery after 3 successes is also Story 13.1.

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { deriveConnectorHealth, shouldAttemptIngestion } from '../../src/connectors/connectorHealth';
import { startIngestionRun, completeIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';

jest.setTimeout(20000);

afterAll(async () => {
  await closePool();
});

async function recordRun(
  tenantId: string,
  platformId: string,
  status: 'succeeded' | 'failed',
  retryable?: boolean
): Promise<void> {
  const run = await startIngestionRun(tenantId, { platformId, triggerType: 'poll', connectorVersion: '1.0.0' });
  await completeIngestionRun(tenantId, run.id, {
    status,
    postsIngested: status === 'succeeded' ? 1 : 0,
    postsSkipped: 0,
    retryable: status === 'failed' ? retryable : undefined,
    errorSummary: status === 'failed' ? 'synthetic failure' : undefined,
  });
}

/** Inserts `count` failed runs spread `hoursApart` apart, oldest first. */
async function recordSpreadOutFailures(
  tenantId: string,
  platformId: string,
  count: number,
  hoursApart: number,
  retryable?: boolean
): Promise<void> {
  await withTenant(tenantId, async (client) => {
    await client.query(
      `INSERT INTO ingestion_runs
         (tenant_id, platform_id, trigger_type, connector_version, status, started_at, completed_at, posts_ingested, posts_skipped, error_summary, retryable)
       SELECT $1, $2, 'poll', '1.0.0', 'failed',
              now() - (gs * ($3 || ' hours')::interval),
              now() - (gs * ($3 || ' hours')::interval),
              0, 0, 'failure ' || gs, $5
       FROM generate_series(1, $4) AS gs`,
      [tenantId, platformId, String(hoursApart), count, retryable ?? null]
    );
  });
}

describe('Story 2.5 — connector failure threshold contract', () => {
  it('AC1: 5 consecutive failed runs -> failing', async () => {
    const platformId = 'example-poll';
    const tenant = randomUUID();
    for (let i = 0; i < 5; i++) {
      await recordRun(tenant, platformId, 'failed', true);
    }
    const health = await deriveConnectorHealth(tenant, platformId);
    expect(health.status).toBe('failing');
    expect(health.consecutiveFailures).toBe(5);
  });

  it('AC2: fewer than 5 consecutive failed runs is not failing', async () => {
    const tenant = randomUUID();
    const platformId = 'example-poll';
    // 3 failed, 1 succeeded -> not failing (degraded: both recent successes
    // and recent failures exist, and fewer than 3 consecutive successes).
    for (let i = 0; i < 3; i++) await recordRun(tenant, platformId, 'failed', true);
    await recordRun(tenant, platformId, 'succeeded');
    const health = await deriveConnectorHealth(tenant, platformId);
    expect(health.status).not.toBe('failing');
    expect(health.status).toBe('degraded');
  });

  it('AC3: the 5-consecutive threshold is window-independent', async () => {
    const tenant = randomUUID();
    const platformId = 'example-poll';
    // 5 failures, each 2 hours apart — none are in the same trailing hour,
    // but the consecutive streak still reaches the threshold.
    await recordSpreadOutFailures(tenant, platformId, 5, 2, true);
    const health = await deriveConnectorHealth(tenant, platformId);
    expect(health.consecutiveFailures).toBe(5);
    expect(health.status).toBe('failing');
  });

  it('AC4: the failing threshold is independent of polling frequency — consecutive count, not rate', async () => {
    const tenant = randomUUID();

    const highFreqPlatform = 'high-freq-poll';
    for (let i = 0; i < 5; i++) {
      await recordRun(tenant, highFreqPlatform, 'failed', true);
    }
    const highFreqHealth = await deriveConnectorHealth(tenant, highFreqPlatform);
    expect(highFreqHealth.status).toBe('failing');

    const lowFreqPlatform = 'low-freq-poll';
    await recordSpreadOutFailures(tenant, lowFreqPlatform, 5, 2, true);
    const lowFreqHealth = await deriveConnectorHealth(tenant, lowFreqPlatform);
    expect(lowFreqHealth.status).toBe('failing');
  });

  it('AC5 (ADR-0109): a failing connector blocks polling — no half-open probe', async () => {
    const tenant = randomUUID();
    const platformId = 'failing-blocks';
    await setConnectorActivation(tenant, platformId, 'tenant', true);
    for (let i = 0; i < 5; i++) {
      await recordRun(tenant, platformId, 'failed', true);
    }

    const health = await deriveConnectorHealth(tenant, platformId);
    expect(health.status).toBe('failing');
    expect(await shouldAttemptIngestion(tenant, platformId)).toBe(false);
  });

  it('AC6 (ADR-0109): the failing state stays blocking over time, not probe-eligible', async () => {
    const tenant = randomUUID();
    const platformId = 'failing-stale';
    await setConnectorActivation(tenant, platformId, 'tenant', true);
    await recordSpreadOutFailures(tenant, platformId, 5, 2, true);

    const health = await deriveConnectorHealth(tenant, platformId);
    expect(health.status).toBe('failing');
    expect(await shouldAttemptIngestion(tenant, platformId)).toBe(false);
  });

  it('a non-retryable failure on the latest run immediately disables, taking precedence over failing', async () => {
    const tenant = randomUUID();
    const platformId = 'non-retryable-latest';
    await setConnectorActivation(tenant, platformId, 'tenant', true);

    // 4 retryable failures, then 1 non-retryable on the latest run.
    for (let i = 0; i < 4; i++) await recordRun(tenant, platformId, 'failed', true);
    await recordRun(tenant, platformId, 'failed', false);

    const health = await deriveConnectorHealth(tenant, platformId);
    expect(health.status).toBe('disabled');
    expect(health.consecutiveFailures).toBe(5); // all 5 runs are consecutive failures
    expect(await shouldAttemptIngestion(tenant, platformId)).toBe(false);
  });
});
