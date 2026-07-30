import { startIngestionRun, completeIngestionRun, StartIngestionRunInput } from './ingestionRunStore';
import { ClassifiableError, isCredentialError, isRetryable } from './errorClassification';

export interface IngestionAttemptResult {
  postsIngested: number;
  postsSkipped: number;
}

export interface RunIngestionAttemptOptions {
  tenantId: string;
  connectorInfo: StartIngestionRunInput;
  attempt: () => Promise<IngestionAttemptResult>;
  /** OAuth connectors only — attempted once before a credential error surfaces (ADR-0010). */
  refreshOAuthToken?: () => Promise<void>;
  maxRetries?: number;
  backoffMs?: (attemptNumber: number) => number;
}

export interface RunIngestionAttemptResult {
  runId: string;
  status: 'succeeded' | 'failed';
  errorSummary?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const defaultBackoffMs = (attemptNumber: number) => Math.min(1000 * 2 ** attemptNumber, 5000);

/**
 * Runs one ingestion attempt end to end: opens an IngestionRun, retries
 * retryable errors with backoff, refreshes an OAuth token once before
 * surfacing a credential failure, and fails immediately (no blind retry) on a
 * non-retryable, non-credential error — closing the run either way (ADR-0005,
 * ADR-0010). See .claude/skills/connector-health-and-error-handling/SKILL.md.
 */
export async function runIngestionAttempt(
  options: RunIngestionAttemptOptions
): Promise<RunIngestionAttemptResult> {
  const run = await startIngestionRun(options.tenantId, options.connectorInfo);
  const maxRetries = options.maxRetries ?? 3;
  const backoffMs = options.backoffMs ?? defaultBackoffMs;

  let attemptsMade = 0;
  let refreshedOnce = false;

  for (;;) {
    attemptsMade += 1;
    try {
      const result = await options.attempt();
      await completeIngestionRun(options.tenantId, run.id, {
        status: 'succeeded',
        postsIngested: result.postsIngested,
        postsSkipped: result.postsSkipped,
      });
      return { runId: run.id, status: 'succeeded' };
    } catch (err) {
      if (!(err instanceof ClassifiableError)) {
        throw err; // a programming error, not a classified ingestion outcome
      }

      if (isCredentialError(err.kind) && options.refreshOAuthToken && !refreshedOnce) {
        refreshedOnce = true;
        try {
          await options.refreshOAuthToken();
          continue; // retry immediately with the refreshed token
        } catch {
          const errorSummary = `OAuth refresh failed after ${err.kind}: ${err.message}`;
          await completeIngestionRun(options.tenantId, run.id, {
            status: 'failed',
            postsIngested: 0,
            postsSkipped: 0,
            errorSummary,
            retryable: isRetryable(err.kind),
          });
          return { runId: run.id, status: 'failed', errorSummary };
        }
      }

      if (!isRetryable(err.kind) || attemptsMade > maxRetries) {
        // Retries genuinely exhausted for a retryable error (not an
        // immediate non-retryable failure) is ADR-0020's dead-letter case —
        // a single poisoned request, distinctly marked, independent of
        // connector-level auto-disable (Story 2.3/2.5's aggregate
        // threshold). See .claude/skills/connector-health-and-error-handling/SKILL.md.
        const deadLettered = isRetryable(err.kind) && attemptsMade > maxRetries;
        const errorSummary = deadLettered
          ? `Dead-lettered after ${attemptsMade} consecutive execution failures: ${err.message}`
          : err.message;
        await completeIngestionRun(options.tenantId, run.id, {
          status: 'failed',
          postsIngested: 0,
          postsSkipped: 0,
          errorSummary,
          retryable: isRetryable(err.kind),
        });
        return { runId: run.id, status: 'failed', errorSummary };
      }

      await sleep(backoffMs(attemptsMade));
    }
  }
}
