// Contract: Story 2.4 (ADR-0020) — bounded rate-limit queues (TTL + depth
// ceiling) and per-request dead-lettering. The distributed-gate-state half of
// this story is deliberately not built here (see Explicitly out of scope).
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-24--bounded-rate-limit-queues-request-level-dead-lettering-and-distributed-gate-state
//
// Intent: Story 2.4 (queue-bound half only) — Bounded rate-limit queues and
// request-level dead-lettering (ADR-0020)
// Scope: src/connectors/requestGate.ts (QueueTtlExceededError,
// QueueDepthExceededError, per-key queue-depth tracking, TTL-bounded
// waiting), src/ingestion/errorClassification.ts (two new non-retryable
// ErrorKinds), src/ingestion/runIngestionAttempt.ts (dead-letter wording on
// the retries-exhausted branch, distinct from an immediate non-retryable
// failure)
// Contract to encode: (1) a gate wait that exceeds its TTL is abandoned —
// acquire() rejects with QueueTtlExceededError rather than waiting forever,
// and when a synthetic attempt() reclassifies that into a ClassifiableError
// (the same pattern a real connector's attempt() would use, per
// provider-connector-framework's SKILL.md), runIngestionAttempt() records it
// as a non-retryable failed IngestionRun with an errorSummary naming the
// abandonment; (2) a queue at its depth ceiling rejects a new request
// immediately with QueueDepthExceededError — never queues past the ceiling —
// while requests already under the ceiling still queue normally; (3) a
// request that exhausts its retries for a genuinely retryable error (not one
// that failed immediately for being non-retryable) gets a distinctly-worded
// "dead-lettered" errorSummary, and — proven directly, not just asserted —
// dead-lettering that one request does not by itself cross
// shouldAttemptIngestion()'s connector-level auto-disable threshold (Story
// 2.3/ADR-0010's flat 10-failures/hour rule), confirming the two mechanisms
// are independent as ADR-0020 requires.
// Explicitly out of scope: distributed (Redis-backed) RequestGate state
// across more than one social-listening-core process instance — ADR-0020's
// own 2026-07-29 Amendment Log entry and docs/implementation-plan.md's
// Phase 4 solo-project note both say this half is only load-bearing once a
// second concurrent instance actually runs, which isn't the case for this
// solo deployment; build it when that need is real, not speculatively. Also
// out of scope: wiring a real connector's attempt() to actually call
// acquireForProvider()/acquireForAiModel() (no real connector exists yet,
// per provider-connector-framework's own Known gaps) — this contract proves
// the mechanism via the same synthetic-attempt() pattern Stories 2.2/2.3 use.
//
// 2026-08-12 (dated note, ADR-0051/Story 1.11): shouldAttemptIngestion() now
// additionally requires an active connector_activations row for the scope
// being checked, alongside the health check AC3 exercises. AC3's own "true"
// assertion (dead-lettering one request alone must not cross the
// connector-level auto-disable threshold) now explicitly activates the
// connector first via setConnectorActivation() — held constant so this AC
// keeps proving what it always proved (dead-letter/auto-disable
// independence), not a weakening of this contract's own intent.

import { randomUUID } from 'crypto';
import {
  acquire,
  QueueTtlExceededError,
  QueueDepthExceededError,
  __resetGateForTests,
} from '../../src/connectors/requestGate';
import { ClassifiableError } from '../../src/ingestion/errorClassification';
import { runIngestionAttempt } from '../../src/ingestion/runIngestionAttempt';
import { withTenant } from '../../src/db/withTenant';
import { closePool } from '../../src/db/pool';
import { shouldAttemptIngestion } from '../../src/connectors/connectorHealth';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';

jest.setTimeout(20000);

afterEach(() => {
  __resetGateForTests();
});

afterAll(async () => {
  await closePool();
});

const connectorInfo = { platformId: 'example-poll', triggerType: 'poll' as const, connectorVersion: '1.0.0' };
const neverResolvingConfig = { requestsPerWindow: 0, windowSeconds: 3600 };

async function retryableColumnFor(tenantId: string, runId: string): Promise<boolean | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query('SELECT retryable FROM ingestion_runs WHERE id = $1', [runId]);
    return rows[0].retryable;
  });
}

describe('Story 2.4 — bounded queues and dead-lettering contract', () => {
  it('AC1: a gate wait exceeding its TTL is abandoned, and the abandonment is recorded as a non-retryable failed IngestionRun', async () => {
    const tenantId = randomUUID();
    const key = `${tenantId}:example-poll`;

    const result = await runIngestionAttempt({
      tenantId,
      connectorInfo,
      backoffMs: () => 5,
      attempt: async () => {
        try {
          await acquire(key, neverResolvingConfig, { queueTtlMs: 30 });
        } catch (err) {
          if (err instanceof QueueTtlExceededError) {
            throw new ClassifiableError('queue_ttl_exceeded', err.message);
          }
          throw err;
        }
        return { postsIngested: 0, postsSkipped: 0 };
      },
    });

    expect(result.status).toBe('failed');
    expect(result.errorSummary).toMatch(/ttl/i);
    expect(await retryableColumnFor(tenantId, result.runId)).toBe(false);
  });

  it('AC2: a queue at its depth ceiling rejects a new request immediately, without affecting requests already under the ceiling', async () => {
    const key = `${randomUUID()}:example-poll`;
    const maxQueueDepth = 3;

    // Fill the queue to its ceiling with requests that will never resolve on
    // their own (requestsPerWindow: 0) — each rejects on its own short TTL,
    // but not before the depth-ceiling assertion below runs synchronously.
    const filling = Array.from({ length: maxQueueDepth }, () =>
      acquire(key, neverResolvingConfig, { queueTtlMs: 50, maxQueueDepth }).catch((err) => err)
    );

    await expect(acquire(key, neverResolvingConfig, { queueTtlMs: 50, maxQueueDepth })).rejects.toThrow(
      QueueDepthExceededError
    );

    const settled = await Promise.all(filling);
    for (const outcome of settled) {
      expect(outcome).toBeInstanceOf(QueueTtlExceededError);
    }
  });

  it('AC3: exhausting retries for a retryable error dead-letters distinctly, independent of connector-level auto-disable', async () => {
    const tenantId = randomUUID();
    // 2026-08-12 (ADR-0051/Story 1.11): shouldAttemptIngestion() now also
    // requires activation — held constant (on) so this AC keeps proving
    // what it always proved, dead-letter/auto-disable independence.
    await setConnectorActivation(tenantId, connectorInfo.platformId, 'tenant', true);

    const result = await runIngestionAttempt({
      tenantId,
      connectorInfo,
      backoffMs: () => 1,
      maxRetries: 2, // 3 total attempts — ADR-0020's own "3 consecutive execution failures" default
      attempt: async () => {
        throw new ClassifiableError('network', 'platform unreachable');
      },
    });

    expect(result.status).toBe('failed');
    expect(result.errorSummary).toMatch(/dead-letter/i);
    expect(await retryableColumnFor(tenantId, result.runId)).toBe(true);

    // One dead-lettered request alone must not cross the connector-level
    // auto-disable threshold (Story 2.3/ADR-0010's flat 10-failures/hour
    // rule) — the two mechanisms are independent, per ADR-0020's Decision.
    expect(await shouldAttemptIngestion(tenantId, connectorInfo.platformId)).toBe(true);
  });

  it('AC3 (contrast): an immediate non-retryable failure is not dead-lettered — distinct wording, no retry exhaustion involved', async () => {
    const tenantId = randomUUID();

    const result = await runIngestionAttempt({
      tenantId,
      connectorInfo,
      backoffMs: () => 1,
      attempt: async () => {
        throw new ClassifiableError('malformed_watchlist', 'bad query');
      },
    });

    expect(result.status).toBe('failed');
    expect(result.errorSummary).not.toMatch(/dead-letter/i);
  });
});
