/**
 * Story 2.12 — deriveConnectorHealth() excludes retryable failures from the `failing` derivation
 * Source: ADR-0010 §Clarification (2026-08-12), ADR-0023 §Clarification (2026-08-12)
 *
 * Intent: correct a confirmed implementation gap against ADR-0010's own
 * already-Accepted Decision text ("retryable errors → automatic retry;
 * non-retryable → immediate `failing` status"). `runIngestionAttempt.ts`
 * already classifies and persists `retryable` on every `ingestion_runs`
 * row it writes, but `deriveConnectorHealth()` never selected that column
 * — every failed run counted identically toward ADR-0023's rate-relative
 * `failing` derivation and the 20-consecutive-failure ceiling, regardless
 * of whether the failure was retryable (rate-limit/network/5xx) or
 * non-retryable (revoked credential/malformed watchlist). This directly
 * reproduced the historical Microsoft Social Engagement failure mode
 * Menno described: a connector disconnected merely for exhausting quota.
 *
 * `recentFailures` and `consecutiveFailures` now count only non-retryable
 * failed runs — a retryable-failed run is treated as fully invisible to
 * this derivation (neither counted as a failure nor as a successful
 * attempt), the same way `lastAttemptAt` still reflects it happened but
 * the failing/degraded/healthy status does not react to it in isolation.
 * A NULL `retryable` value (a fixture row created without classifying it,
 * e.g. Story 4.3's own contract) is treated as non-retryable — the
 * conservative default, since an unclassified failure should not be
 * silently excluded.
 *
 * Explicitly out of scope: ADR-0023's own accepted numeric defaults (50%
 * rate, 5-attempt floor, 20-consecutive ceiling) — unchanged; `deriveConnectorHealth()`'s
 * `credentialStatus`/`lastSuccessfulFetchAt`/`lastAttemptAt` fields —
 * unchanged; wiring `shouldAttemptIngestion()` into a real scheduler (none
 * exists yet).
 *
 * AC1: a run of purely retryable failures never crosses the rate-relative
 *      threshold or the consecutive ceiling on its own — status stays
 *      healthy/degraded, never failing.
 * AC2: a run of purely non-retryable failures still crosses both
 *      thresholds exactly as before.
 * AC3: a mixed run counts only the non-retryable failures toward
 *      recentFailures/consecutiveFailures.
 * AC4: a connector recovering from a purely-retryable blip (successes
 *      present, only retryable failures) reads healthy, not degraded.
 */

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { deriveConnectorHealth } from '../../src/connectors/connectorHealth';
import { startIngestionRun, completeIngestionRun } from '../../src/ingestion/ingestionRunStore';

jest.setTimeout(20000);

afterAll(async () => {
  await closePool();
});

const platformId = 'test-platform-2.12';

async function recordRun(
  tenantId: string,
  status: 'succeeded' | 'failed',
  retryable?: boolean
): Promise<void> {
  const run = await startIngestionRun(tenantId, {
    platformId,
    triggerType: 'poll',
    connectorVersion: '1.0.0',
  });
  await completeIngestionRun(tenantId, run.id, {
    status,
    postsIngested: status === 'succeeded' ? 1 : 0,
    postsSkipped: 0,
    errorSummary: status === 'failed' ? 'synthetic failure' : undefined,
    retryable: status === 'failed' ? retryable : undefined,
  });
}

describe('Story 2.12 — retryable failures excluded from the failing derivation', () => {
  it('AC1: a run of purely retryable failures never trips failing on its own, even past the consecutive ceiling', async () => {
    const tenantId = randomUUID();
    for (let i = 0; i < 25; i++) {
      await recordRun(tenantId, 'failed', true);
    }
    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.status).not.toBe('failing');
    expect(health.consecutiveFailures).toBe(0);
  });

  it('AC2: a run of purely non-retryable failures still trips failing exactly as before', async () => {
    const tenantId = randomUUID();
    for (let i = 0; i < 5; i++) {
      await recordRun(tenantId, 'failed', false);
    }
    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.status).toBe('failing');
    expect(health.consecutiveFailures).toBe(5);
  });

  it('AC3: a mixed run counts only the non-retryable failures toward recentFailures/consecutiveFailures', async () => {
    const tenantId = randomUUID();
    // 4 non-retryable failures interspersed with 3 retryable ones — the
    // retryable ones must not count toward the 5-attempt-floor/50%-rate
    // threshold ADR-0023 already accepts, nor toward consecutiveFailures.
    await recordRun(tenantId, 'failed', false);
    await recordRun(tenantId, 'failed', true);
    await recordRun(tenantId, 'failed', false);
    await recordRun(tenantId, 'failed', true);
    await recordRun(tenantId, 'failed', false);
    await recordRun(tenantId, 'failed', true);
    await recordRun(tenantId, 'failed', false);

    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.consecutiveFailures).toBe(4);
    expect(health.status).not.toBe('failing'); // 4 non-retryable failures, no successes at all — under the 5-attempt floor
  });

  it('AC4: a connector recovering from a purely-retryable blip (successes present) reads healthy, not degraded', async () => {
    const tenantId = randomUUID();
    await recordRun(tenantId, 'succeeded');
    await recordRun(tenantId, 'failed', true);
    await recordRun(tenantId, 'failed', true);
    await recordRun(tenantId, 'succeeded');

    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.status).toBe('healthy');
  });

  it('a NULL retryable value (an unclassified failure) is treated conservatively, as non-retryable', async () => {
    const tenantId = randomUUID();
    for (let i = 0; i < 5; i++) {
      await recordRun(tenantId, 'failed', undefined);
    }
    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.status).toBe('failing');
    expect(health.consecutiveFailures).toBe(5);
  });
});
