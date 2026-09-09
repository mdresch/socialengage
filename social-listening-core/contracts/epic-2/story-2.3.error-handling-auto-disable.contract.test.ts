// Contract: Story 2.3 (ADR-0010) — retryable/non-retryable error handling with
// per-tenant auto-disable.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-23--retryablenon-retryable-error-handling-with-per-tenant-auto-disable
//
// Intent: Story 2.3 — Retryable/non-retryable error handling with per-tenant
// auto-disable (ADR-0010)
// Scope: src/ingestion/errorClassification.ts, src/ingestion/runIngestionAttempt.ts,
// src/connectors/connectorHealth.ts (shouldAttemptIngestion, getAutoDisableReason —
// shared with Story 4.3, whose own contract owns the derivation rules themselves)
// Contract to encode: (1) rate-limit/network/5xx errors trigger backoff and
// automatic retry within the same IngestionRun; (2) 401/403/malformed-watchlist
// errors mark the run failed immediately, no further blind retries; (3) an
// OAuth-capable attempt tries token refresh once before surfacing a credential
// failure — a successful refresh retries transparently, only a failed refresh
// surfaces; (4) auto-disable genuinely happens and is wired to derived health —
// proven with whatever failure count crosses the connector-level threshold, not a
// hardcoded rule-specific number (that number's correctness is Story 4.3's/2.5's
// own contract) — with a reason drawn from the most recent failure's errorSummary
// (auto-disable is *behavior* driven by derived health, not a separately stored
// disabled flag — ADR-0009's whole point); (5) a second tenant's connector for the
// same platform is provably unaffected by the first tenant's auto-disable.
// Explicitly out of scope: the actual failure-threshold derivation rule's
// correctness across all four ConnectorHealth states (Story 4.3's own contract)
// or its specific rate/floor/ceiling numbers (Story 2.5's own contract); real
// per-connector error classification against an actual platform's responses (no
// real connector exists yet).
//
// 2026-07-30 (dated note, ADR-0023): AC4 originally hardcoded "9 failures still
// allowed, 10th failure disables" — numbers specific to the flat "≥10/hour" rule
// ADR-0023 (accepted 2026-07-29) explicitly supersedes (see ADR-0009's/ADR-0010's
// "Supersession update" notes). That rule-specific claim cannot survive under any
// rate-based rule that can trigger before a flat count of exactly 10 — under
// ADR-0023's now-current rule, 5 consecutive pure failures already crossed the
// threshold. AC4 was rewritten to prove the same thing (auto-disable wiring +
// visible reason) using Story 2.5's then-current threshold.
//
// 2026-08-28 (dated note, ADR-0109/Story 13.1): the rate rule and 20-consecutive
// ceiling are replaced by a 5-consecutive-failure `failing` threshold and an
// immediate `disabled` state when the *latest* run is non-retryable. Auto-disable
// remains behavior driven by derived health and `shouldAttemptIngestion()`; the
// visible reason is still the most recent failure's `errorSummary`.
//
// 2026-08-12 (dated note, ADR-0051/Story 1.11): shouldAttemptIngestion() now
// additionally requires an active connector_activations row for the scope
// being checked (tenant-wide by default), alongside the health check this
// story's own AC4/AC5 exercise — a real, deliberate behavior change, not a
// weakening of this contract's own intent. AC4's/AC5's own "true" assertions
// (this file's own before-the-threshold-is-crossed / other-tenant-unaffected
// cases) now explicitly activate the connector first via
// setConnectorActivation() — a direct store-level call, the same
// test-infrastructure style this file already uses for withTenant() — so
// they keep proving what they always proved (health-driven eligibility),
// with activation held constant (always on) rather than left as an
// unrelated, accidental variable. The "false" assertions (already-failing
// health) are unaffected either way, since a failing health check alone is
// already sufficient to make shouldAttemptIngestion() return false.

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import {
  ClassifiableError,
  isRetryable,
} from '../../src/ingestion/errorClassification';
import { runIngestionAttempt } from '../../src/ingestion/runIngestionAttempt';
import { shouldAttemptIngestion, getAutoDisableReason } from '../../src/connectors/connectorHealth';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';

jest.setTimeout(20000);

afterAll(async () => {
  await closePool();
});

const connectorInfo = { platformId: 'example-poll', triggerType: 'poll' as const, connectorVersion: '1.0.0' };
const fastBackoff = () => 5;

describe('Story 2.3 — error handling and per-tenant auto-disable contract', () => {
  it('AC1: rate-limit/network/5xx errors trigger backoff and automatic retry', async () => {
    let calls = 0;
    const result = await runIngestionAttempt({
      tenantId: randomUUID(),
      connectorInfo,
      backoffMs: fastBackoff,
      attempt: async () => {
        calls += 1;
        if (calls < 3) throw new ClassifiableError('network', 'transient blip');
        return { postsIngested: 5, postsSkipped: 0 };
      },
    });

    expect(result.status).toBe('succeeded');
    expect(calls).toBe(3);
    for (const kind of ['rate_limit', 'network', 'http_5xx'] as const) {
      expect(isRetryable(kind)).toBe(true);
    }
  });

  it('AC2: 401/403/malformed-watchlist errors fail immediately with no further blind retries', async () => {
    let calls = 0;
    const result = await runIngestionAttempt({
      tenantId: randomUUID(),
      connectorInfo,
      backoffMs: fastBackoff,
      attempt: async () => {
        calls += 1;
        throw new ClassifiableError('malformed_watchlist', 'bad boolean query');
      },
    });

    expect(result.status).toBe('failed');
    expect(calls).toBe(1);
    for (const kind of ['http_401', 'http_403', 'malformed_watchlist'] as const) {
      expect(isRetryable(kind)).toBe(false);
    }
  });

  it('AC3: a successful OAuth refresh retries transparently; only a failed refresh surfaces', async () => {
    let attemptCalls = 0;
    let refreshCalls = 0;

    const succeeding = await runIngestionAttempt({
      tenantId: randomUUID(),
      connectorInfo,
      backoffMs: fastBackoff,
      attempt: async () => {
        attemptCalls += 1;
        if (attemptCalls === 1) throw new ClassifiableError('http_401', 'expired token');
        return { postsIngested: 2, postsSkipped: 0 };
      },
      refreshOAuthToken: async () => {
        refreshCalls += 1;
      },
    });
    expect(succeeding.status).toBe('succeeded');
    expect(refreshCalls).toBe(1);

    const failing = await runIngestionAttempt({
      tenantId: randomUUID(),
      connectorInfo,
      backoffMs: fastBackoff,
      attempt: async () => {
        throw new ClassifiableError('http_401', 'expired token');
      },
      refreshOAuthToken: async () => {
        throw new Error('refresh token itself is invalid');
      },
    });
    expect(failing.status).toBe('failed');
    expect(failing.errorSummary).toMatch(/refresh/i);
  });

  it('AC4: auto-disables once the connector-level failure threshold is crossed, with a visible reason', async () => {
    // ADR-0109's threshold: 5 consecutive failed runs of any kind. We use
    // `network` (retryable) so the state becomes `failing`, not the
    // immediate `disabled` a non-retryable latest run would produce.
    const tenantId = randomUUID();
    // 2026-08-12 (ADR-0051/Story 1.11): shouldAttemptIngestion() now also
    // requires activation — held constant (on) here so this AC keeps
    // proving what it always proved, health-driven eligibility.
    await setConnectorActivation(tenantId, connectorInfo.platformId, 'tenant', true);
    for (let i = 0; i < 4; i++) {
      await runIngestionAttempt({
        tenantId,
        connectorInfo,
        backoffMs: fastBackoff,
        maxRetries: 0,
        attempt: async () => {
          throw new ClassifiableError('network', `failure #${i}`);
        },
      });
    }
    expect(await shouldAttemptIngestion(tenantId, connectorInfo.platformId)).toBe(true);

    await runIngestionAttempt({
      tenantId,
      connectorInfo,
      backoffMs: fastBackoff,
      maxRetries: 0,
      attempt: async () => {
        throw new ClassifiableError('network', 'the fifth failure');
      },
    });

    expect(await shouldAttemptIngestion(tenantId, connectorInfo.platformId)).toBe(false);
    const reason = await getAutoDisableReason(tenantId, connectorInfo.platformId);
    expect(reason).toMatch(/the fifth failure/);
  });

  it('AC4a (ADR-0109): a non-retryable failure on the latest run immediately disables, not failing', async () => {
    const tenantId = randomUUID();
    await setConnectorActivation(tenantId, connectorInfo.platformId, 'tenant', true);

    // A single malformed-watchlist (non-retryable) run immediately produces
    // `disabled`; there is no threshold to cross.
    await runIngestionAttempt({
      tenantId,
      connectorInfo,
      backoffMs: fastBackoff,
      attempt: async () => {
        throw new ClassifiableError('malformed_watchlist', 'bad query disables immediately');
      },
    });

    expect(await shouldAttemptIngestion(tenantId, connectorInfo.platformId)).toBe(false);
    expect(await getAutoDisableReason(tenantId, connectorInfo.platformId)).toBe('bad query disables immediately');
  });

  it('AC5: a second tenant is provably unaffected by the first tenant\'s auto-disable', async () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    // 2026-08-12 (ADR-0051/Story 1.11): tenantB's own "true" assertion below
    // now also needs activation — tenantA's stays "false" regardless (a
    // failing health check alone already makes shouldAttemptIngestion()
    // return false), so tenantA is deliberately left unactivated here.
    await setConnectorActivation(tenantB, connectorInfo.platformId, 'tenant', true);

    for (let i = 0; i < 10; i++) {
      await runIngestionAttempt({
        tenantId: tenantA,
        connectorInfo,
        backoffMs: fastBackoff,
        attempt: async () => {
          throw new ClassifiableError('malformed_watchlist', `tenant A failure #${i}`);
        },
      });
    }
    await runIngestionAttempt({
      tenantId: tenantB,
      connectorInfo,
      backoffMs: fastBackoff,
      attempt: async () => ({ postsIngested: 1, postsSkipped: 0 }),
    });

    expect(await shouldAttemptIngestion(tenantA, connectorInfo.platformId)).toBe(false);
    expect(await shouldAttemptIngestion(tenantB, connectorInfo.platformId)).toBe(true);
  });
});

// Sanity check that AC4/AC5's failed runs actually landed in ingestion_runs under
// the expected tenant — guards against the test itself silently no-op'ing.
async function countFailedRuns(tenantId: string, platformId: string): Promise<number> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT count(*)::int AS c FROM ingestion_runs WHERE platform_id = $1 AND status = 'failed'`,
      [platformId]
    );
    return rows[0].c;
  });
}

describe('Story 2.3 — sanity check', () => {
  it('failed attempts really are recorded as failed IngestionRuns', async () => {
    const tenantId = randomUUID();
    await runIngestionAttempt({
      tenantId,
      connectorInfo,
      backoffMs: fastBackoff,
      attempt: async () => {
        throw new ClassifiableError('malformed_watchlist', 'x');
      },
    });
    expect(await countFailedRuns(tenantId, connectorInfo.platformId)).toBe(1);
  });
});
