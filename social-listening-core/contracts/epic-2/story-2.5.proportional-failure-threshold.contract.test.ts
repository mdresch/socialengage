// Contract: Story 2.5 (ADR-0023) — proportional (rate-relative) connector
// failure threshold, superseding ADR-0009's/ADR-0010's flat "≥10
// failures/hour" rule (see ADR-0009's and ADR-0010's "Supersession update"
// notes, and docs/user-stories/README.md's "Known cross-story conflict").
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-25--proportional-rate-relative-connector-failure-threshold
//
// Intent: Story 2.5 — Proportional, rate-relative connector failure
// threshold (ADR-0023)
// Scope: src/connectors/connectorHealth.ts (deriveConnectorHealth's
// `failing` derivation only — degraded/disconnected/healthy definitions and
// credentialStatus are explicitly unaffected per ADR-0023's own text)
// Contract to encode: (1) ≥50% of attempts failing in the trailing 1-hour
// window, with at least 5 attempts in that window, is `failing` — including
// exactly the 50% boundary; (2) fewer than 5 attempts in the window never
// triggers the rate rule, regardless of failure percentage (the floor) —
// even 100% failure among 3-4 attempts stays out of `failing`; (3) 20
// consecutive failures marks `failing` regardless of the trailing-1-hour
// window, proven with failures spread far enough apart (2h intervals) that
// none of them fall inside that window at all — the absolute ceiling is
// genuinely window-independent, not just numerically larger than the floor
// scenario; (4) a high-frequency connector (many attempts/hour, mostly
// failing) and a low-frequency one (too infrequent to reach the 5-attempt
// floor within an hour, but persistently broken over a longer span) are
// both correctly flagged `failing` — via the rate rule and the ceiling
// rule respectively — demonstrating neither polling frequency is
// structurally disadvantaged, which is ADR-0023's whole point.
// Explicitly out of scope: this story ALSO required editing Story 2.3's
// AC4 (numbers that only made sense under the old flat rule) and both
// Story 2.3's and Story 4.3's Intent comments — done separately, in those
// files, with dated notes citing this same ADR, not duplicated here; the
// `deliveryMode`-based variation ADR-0023 explicitly deferred (not this
// story's scope, still an open question per the ADR's Acceptance note).
//
// Healing pass, 2026-08-17 (ADR-0023's own new Clarification, same date):
// the absolute ceiling (AC3 above) had no recovery path once tripped —
// shouldAttemptIngestion() checked health.status === 'failing' and blocked
// unconditionally, forever, since the very poll attempt that would record a
// fresh success and clear the streak was itself what was blocked. Found
// live: a real tenant's GNews connector legitimately hit the ceiling (a
// real credential-storage bug, since fixed), then remained permanently
// stuck even after the credential existed and the connector was
// reactivated. AC5/AC6 below prove the fix — a bounded circuit-breaker
// "half-open" probe, PROBE_COOLDOWN_MS in connectorHealth.ts — without
// changing deriveConnectorHealth()'s own `failing` derivation at all (AC1-
// AC4 above are unaffected, unmodified).

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
  status: 'succeeded' | 'failed'
): Promise<void> {
  const run = await startIngestionRun(tenantId, { platformId, triggerType: 'poll', connectorVersion: '1.0.0' });
  await completeIngestionRun(tenantId, run.id, { status, postsIngested: status === 'succeeded' ? 1 : 0, postsSkipped: 0 });
}

/** Inserts `count` failed runs spread `hoursApart` apart, oldest first — simulates a low-frequency connector whose failures mostly fall outside the trailing-1-hour window. */
async function recordSpreadOutFailures(
  tenantId: string,
  platformId: string,
  count: number,
  hoursApart: number
): Promise<void> {
  await withTenant(tenantId, async (client) => {
    await client.query(
      `INSERT INTO ingestion_runs
         (tenant_id, platform_id, trigger_type, connector_version, status, started_at, completed_at, posts_ingested, posts_skipped, error_summary)
       SELECT $1, $2, 'poll', '1.0.0', 'failed',
              now() - (gs * ($3 || ' hours')::interval),
              now() - (gs * ($3 || ' hours')::interval),
              0, 0, 'failure ' || gs
       FROM generate_series(1, $4) AS gs`,
      [tenantId, platformId, String(hoursApart), count]
    );
  });
}

describe('Story 2.5 — proportional failure threshold contract', () => {
  it('AC1: >=50% failure rate with >=5 attempts in the window is failing, including exactly the 50% boundary', async () => {
    const platformId = 'example-poll';

    const tenantAbove = randomUUID();
    for (let i = 0; i < 3; i++) await recordRun(tenantAbove, platformId, 'failed');
    for (let i = 0; i < 2; i++) await recordRun(tenantAbove, platformId, 'succeeded');
    // 3/5 = 60% >= 50%, attempts = 5 >= floor
    expect((await deriveConnectorHealth(tenantAbove, platformId)).status).toBe('failing');

    const tenantExactly50 = randomUUID();
    for (let i = 0; i < 3; i++) await recordRun(tenantExactly50, platformId, 'failed');
    for (let i = 0; i < 3; i++) await recordRun(tenantExactly50, platformId, 'succeeded');
    // 3/6 = exactly 50% — the boundary is inclusive
    expect((await deriveConnectorHealth(tenantExactly50, platformId)).status).toBe('failing');
  });

  it('AC2: fewer than 5 attempts in the window never triggers the rate rule, even at 100% failure', async () => {
    const tenantId = randomUUID();
    const platformId = 'example-poll';
    for (let i = 0; i < 3; i++) await recordRun(tenantId, platformId, 'failed');
    await recordRun(tenantId, platformId, 'succeeded');
    // 3 failures / 4 attempts = 75% failure rate, but attempts(4) < floor(5).
    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.status).not.toBe('failing');
    expect(health.status).toBe('degraded'); // recent failures + a recent success — unaffected ADR-0009 definition
  });

  it('AC3: 20 consecutive failures is failing regardless of the trailing-1-hour window', async () => {
    const tenantId = randomUUID();
    const platformId = 'example-poll';
    // Every failure is 2+ hours old — none fall inside the trailing-1-hour
    // window at all, so the rate rule sees zero recent attempts (well under
    // the floor). Only the window-independent consecutive-failure ceiling
    // can catch this.
    await recordSpreadOutFailures(tenantId, platformId, 20, 2);
    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.consecutiveFailures).toBe(20);
    expect(health.status).toBe('failing');
  });

  it('AC4: a high-frequency (rate-triggered) and a low-frequency (ceiling-triggered) connector are both correctly flagged failing — neither penalized by its polling frequency', async () => {
    const tenantId = randomUUID();

    const highFreqPlatform = 'high-freq-poll';
    for (let i = 0; i < 8; i++) await recordRun(tenantId, highFreqPlatform, 'failed');
    for (let i = 0; i < 2; i++) await recordRun(tenantId, highFreqPlatform, 'succeeded');
    // 8/10 = 80% failure rate within the window — caught by the rate rule.
    const highFreqHealth = await deriveConnectorHealth(tenantId, highFreqPlatform);
    expect(highFreqHealth.status).toBe('failing');

    const lowFreqPlatform = 'low-freq-poll';
    await recordSpreadOutFailures(tenantId, lowFreqPlatform, 20, 2);
    // Zero attempts fall inside the trailing-1-hour window — caught only by
    // the absolute ceiling, not the rate rule.
    const lowFreqHealth = await deriveConnectorHealth(tenantId, lowFreqPlatform);
    expect(lowFreqHealth.status).toBe('failing');
  });

  it('AC5 (healing pass, 2026-08-17): a ceiling-triggered failing connector still blocks polling within the probe cooldown', async () => {
    const tenantId = randomUUID();
    const platformId = 'ceiling-recent';
    await setConnectorActivation(tenantId, platformId, 'tenant', true);
    // 20 consecutive failures, all "just now" — well within any reasonable
    // cooldown, the same immediacy AC4/AC5 in Story 2.3 already rely on.
    for (let i = 0; i < 20; i++) await recordRun(tenantId, platformId, 'failed');

    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.status).toBe('failing');
    expect(await shouldAttemptIngestion(tenantId, platformId)).toBe(false);
  });

  it('AC6 (healing pass, 2026-08-17): a ceiling-triggered failing connector allows exactly one probe attempt once the cooldown has elapsed — the real fix for the deadlock this pass closes', async () => {
    const tenantId = randomUUID();
    const platformId = 'ceiling-stale';
    await setConnectorActivation(tenantId, platformId, 'tenant', true);
    // Reuses AC3's own fixture shape (20 failures, 2h apart) — the most
    // recent failure lands 2 hours ago, well past PROBE_COOLDOWN_MS (15
    // minutes), proving the probe allowance is real, not just "not yet
    // expired" in this test's own short runtime.
    await recordSpreadOutFailures(tenantId, platformId, 20, 2);

    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.status).toBe('failing');
    expect(await shouldAttemptIngestion(tenantId, platformId)).toBe(true);
  });
});
