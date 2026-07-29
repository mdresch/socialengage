// Contract: Healing — ADR-0005's `retryable` field, missing since Story 3.2 shipped.
// See docs/adr/0005-ingestion-run-as-audit-anchor.md
//
// Intent: Healing — close a gap surfaced by a full ADR/story consistency audit
// (2026-07-29): ADR-0005's Decision text explicitly lists `retryable` as one of
// IngestionRun's fields ("...errorSummary, retryable)"), but migration
// 0005_create_ingestion_runs.sql deferred it with a comment claiming "Story 2.3
// will add this" — Story 2.3 shipped without it, using an in-code, non-persisted
// classification (ClassifiableError.kind) instead. social-post-lineage's SKILL.md
// still made that now-stale claim.
// Scope: migrations/0008_add_ingestion_runs_retryable_and_index.sql,
// src/ingestion/ingestionRunStore.ts (CompleteIngestionRunInput gains retryable),
// src/ingestion/runIngestionAttempt.ts (persists the last error's classification)
// Contract to encode: (1) a run that never encountered any error (succeeded on the
// first attempt) has retryable = null; (2) a run that failed after a retryable
// error was exhausted (e.g. network errors past maxRetries) has retryable = true;
// (3) a run that failed on a non-retryable error (malformed watchlist) has
// retryable = false; (4) a run that failed after a credential refresh itself
// failed has retryable = false (the underlying error, http_401/403, isn't
// retryable — a failed refresh doesn't change that).
// Explicitly out of scope: any change to retryable/non-retryable classification
// rules themselves (unchanged from Story 2.3); a dedicated ErrorKind for Key Vault
// throttling/outage (ADR-0014's Negative consequences names this as a softer,
// separately-deferred finding from this same audit, not part of this healing pass).

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { ClassifiableError } from '../../src/ingestion/errorClassification';
import { runIngestionAttempt } from '../../src/ingestion/runIngestionAttempt';

jest.setTimeout(20000);

afterAll(async () => {
  await closePool();
});

const connectorInfo = { platformId: 'example-poll', triggerType: 'poll' as const, connectorVersion: '1.0.0' };
const fastBackoff = () => 5;

async function retryableColumnFor(tenantId: string, runId: string): Promise<boolean | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query('SELECT retryable FROM ingestion_runs WHERE id = $1', [runId]);
    return rows[0].retryable;
  });
}

describe('Healing — ingestion_runs.retryable contract (ADR-0005)', () => {
  it('a run that succeeds on the first attempt has retryable = null', async () => {
    const tenantId = randomUUID();
    const result = await runIngestionAttempt({
      tenantId,
      connectorInfo,
      backoffMs: fastBackoff,
      attempt: async () => ({ postsIngested: 1, postsSkipped: 0 }),
    });
    expect(await retryableColumnFor(tenantId, result.runId)).toBeNull();
  });

  it('a run that fails after a retryable error is exhausted has retryable = true', async () => {
    const tenantId = randomUUID();
    const result = await runIngestionAttempt({
      tenantId,
      connectorInfo,
      backoffMs: fastBackoff,
      maxRetries: 1,
      attempt: async () => {
        throw new ClassifiableError('network', 'always fails');
      },
    });
    expect(result.status).toBe('failed');
    expect(await retryableColumnFor(tenantId, result.runId)).toBe(true);
  });

  it('a run that fails on a non-retryable error has retryable = false', async () => {
    const tenantId = randomUUID();
    const result = await runIngestionAttempt({
      tenantId,
      connectorInfo,
      backoffMs: fastBackoff,
      attempt: async () => {
        throw new ClassifiableError('malformed_watchlist', 'bad query');
      },
    });
    expect(result.status).toBe('failed');
    expect(await retryableColumnFor(tenantId, result.runId)).toBe(false);
  });

  it('a run that fails after a failed OAuth refresh has retryable = false', async () => {
    const tenantId = randomUUID();
    const result = await runIngestionAttempt({
      tenantId,
      connectorInfo,
      backoffMs: fastBackoff,
      attempt: async () => {
        throw new ClassifiableError('http_401', 'expired token');
      },
      refreshOAuthToken: async () => {
        throw new Error('refresh token itself is invalid');
      },
    });
    expect(result.status).toBe('failed');
    expect(await retryableColumnFor(tenantId, result.runId)).toBe(false);
  });
});
