/**
 * Story 2.12 — failure classification and the `failing`/`disabled` boundary
 * Source: ADR-0010, ADR-0023, ADR-0109/Story 13.1
 *
 * Supersession update, 2026-08-28 (ADR-0109): this contract originally proved
 * that retryable failures were *excluded* from `failing` derivation. That
 * exclusion itself is now superseded: **every failed `ingestion_runs` row
 * counts toward the 5-consecutive `failing` threshold** — a connector can no
 * longer be disconnected merely for transient quota or network blips, because
 * the threshold is only 5 (not 20) and the manual `POST .../enable` health
 * check is the recovery path. What *does* still depend on retryability is the
 * `disabled` state: the **latest** run being non-retryable (`retryable =
 * false`) and non-credential immediately yields `disabled`, taking precedence
 * over `failing`. A `NULL` `retryable` value is treated as unclassified and
 * does *not* immediately disable; it still counts toward `failing`.
 *
 * Contract to encode under ADR-0109:
 * AC1: a run of purely retryable failures crosses `failing` after 5.
 * AC2: the latest non-retryable failure immediately yields `disabled`, even
 *      after a shorter streak.
 * AC3: retryable and non-retryable failures both extend the consecutive
 *      streak that leads to `failing`.
 * AC4: a connector recovering from a blip (successes present) can become
 *      `healthy` after 3 consecutive successes.
 * AC5: a NULL `retryable` value counts as a failed run but does not disable.
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

describe('Story 2.12 — retryable and non-retryable failure states', () => {
  it('AC1: a run of purely retryable failures trips failing after 5 consecutive', async () => {
    const tenantId = randomUUID();
    for (let i = 0; i < 5; i++) {
      await recordRun(tenantId, 'failed', true);
    }
    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.status).toBe('failing');
    expect(health.consecutiveFailures).toBe(5);
  });

  it('AC2: the latest non-retryable failure immediately disables the connector', async () => {
    const tenantId = randomUUID();
    for (let i = 0; i < 5; i++) {
      await recordRun(tenantId, 'failed', false);
    }
    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.status).toBe('disabled');
    expect(health.consecutiveFailures).toBe(5);
  });

  it('AC3: a mixed run of retryable and non-retryable failures both count toward the consecutive failing streak', async () => {
    const tenantId = randomUUID();
    // 4 non-retryable + 1 retryable on the latest run -> the latest is
    // retryable, so the 5-consecutive threshold yields `failing`, not
    // `disabled`.
    await recordRun(tenantId, 'failed', false);
    await recordRun(tenantId, 'failed', true);
    await recordRun(tenantId, 'failed', false);
    await recordRun(tenantId, 'failed', true);
    await recordRun(tenantId, 'failed', false);
    await recordRun(tenantId, 'failed', true);
    await recordRun(tenantId, 'failed', false);
    await recordRun(tenantId, 'failed', true);
    await recordRun(tenantId, 'failed', false);
    await recordRun(tenantId, 'failed', true);

    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.consecutiveFailures).toBe(10);
    expect(health.status).toBe('failing');
  });

  it('AC4: a connector recovering from a blip becomes healthy after 3 consecutive successes', async () => {
    const tenantId = randomUUID();
    await recordRun(tenantId, 'succeeded');
    await recordRun(tenantId, 'failed', true);
    await recordRun(tenantId, 'failed', true);
    await recordRun(tenantId, 'succeeded');
    await recordRun(tenantId, 'succeeded');
    await recordRun(tenantId, 'succeeded');

    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.status).toBe('healthy');
    expect(health.consecutiveSuccesses).toBe(3);
  });

  it('AC5: a NULL retryable value counts as a failure but does not immediately disable', async () => {
    const tenantId = randomUUID();
    for (let i = 0; i < 5; i++) {
      await recordRun(tenantId, 'failed', undefined);
    }
    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.status).toBe('failing');
    expect(health.consecutiveFailures).toBe(5);
  });
});
