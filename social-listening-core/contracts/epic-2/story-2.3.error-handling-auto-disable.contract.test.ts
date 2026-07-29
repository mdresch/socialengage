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
// surfaces; (4) after >=10 failed IngestionRuns in the trailing hour,
// shouldAttemptIngestion() returns false with a reason drawn from the most recent
// failure's errorSummary (auto-disable is *behavior* driven by Story 4.3's derived
// health, not a separately stored disabled flag — ADR-0009's whole point); (5) a
// second tenant's connector for the same platform is provably unaffected by the
// first tenant's auto-disable.
// Explicitly out of scope: the actual ≥10/trailing-hour derivation rule's
// correctness across all four ConnectorHealth states (Story 4.3's own contract);
// real per-connector error classification against an actual platform's responses
// (no real connector exists yet); the rate-relative threshold that would replace
// the flat 10 (Story 2.5 / ADR-0023, Blocked).

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import {
  ClassifiableError,
  isRetryable,
} from '../../src/ingestion/errorClassification';
import { runIngestionAttempt } from '../../src/ingestion/runIngestionAttempt';
import { shouldAttemptIngestion, getAutoDisableReason } from '../../src/connectors/connectorHealth';

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

  it('AC4: auto-disables after >=10 failed IngestionRuns in the trailing hour, with a visible reason', async () => {
    const tenantId = randomUUID();
    for (let i = 0; i < 9; i++) {
      await runIngestionAttempt({
        tenantId,
        connectorInfo,
        backoffMs: fastBackoff,
        attempt: async () => {
          throw new ClassifiableError('malformed_watchlist', `failure #${i}`);
        },
      });
    }
    expect(await shouldAttemptIngestion(tenantId, connectorInfo.platformId)).toBe(true);

    await runIngestionAttempt({
      tenantId,
      connectorInfo,
      backoffMs: fastBackoff,
      attempt: async () => {
        throw new ClassifiableError('malformed_watchlist', 'the tenth failure');
      },
    });

    expect(await shouldAttemptIngestion(tenantId, connectorInfo.platformId)).toBe(false);
    expect(await getAutoDisableReason(tenantId, connectorInfo.platformId)).toBe('the tenth failure');
  });

  it('AC5: a second tenant is provably unaffected by the first tenant\'s auto-disable', async () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();

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
