import { withTenant } from '../db/withTenant';
import { isConnectorActive, ConnectorActivationOwnerType } from './connectorActivationStore';
import {
  startIngestionRun,
  completeIngestionRun,
  updateIngestionRunTriggerType,
  TriggerType,
} from '../ingestion/ingestionRunStore';
import { ClassifiableError, isCredentialError, isRetryable } from '../ingestion/errorClassification';
import { RunIngestionAttemptResult } from '../ingestion/runIngestionAttempt';
import { getSocialConnector } from './registry';

/**
 * Story 2.15 (ADR-0059 Decision §4) added 'reconnect_required' — a
 * credential-class failure (password change, admin removal, grant
 * revocation — anything Meta returns as a 401/403 for) on the most recent
 * run. Story 13.1 (ADR-0109) added 'disabled' for any non-retryable,
 * non-credential failure on the most recent run, and made both
 * 'reconnect_required' and 'disabled' blocked states.
 */
export type ConnectorHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'failing'
  | 'disconnected'
  | 'reconnect_required'
  | 'disabled'
  | 'stalled';
export type CredentialStatus = 'valid' | 'expiring_soon' | 'expired' | 'revoked';

export interface ConnectorHealth {
  status: ConnectorHealthStatus;
  lastSuccessfulFetchAt: string | null;
  lastAttemptAt: string | null;
  consecutiveFailures: number;
  /** Story 13.1 (ADR-0109) — consecutive successes since the last failure or health-check reset, used for degraded->healthy auto-recovery. */
  consecutiveSuccesses: number;
  credentialStatus: CredentialStatus | null;
  lastSuccessfulPostsIngested?: number | null;
}

export interface DeriveConnectorHealthOptions {
  effectiveCadenceMs?: number;
  isConnectorActive?: boolean;
  now?: number;
}

export const DEFAULT_EFFECTIVE_CADENCE_MS = 15 * 60 * 1000;
export const STALL_CADENCE_MULTIPLIER = 3;
export const MIN_STALL_CADENCE_MS = 45 * 60 * 1000;
export const MAX_INGESTION_SILENCE_MS = 24 * 60 * 60 * 1000;

/**
 * Story 13.1 (ADR-0109) — auto-disable threshold reduced to 5 consecutive
 * failed `ingestion_runs` of any kind (retryable or not), superseding
 * ADR-0023's 20-consecutive ceiling. The rate-relative rule and the
 * half-open probe are removed; `degraded` auto-recovery uses 3 consecutive
 * successes.
 */
const CONSECUTIVE_FAILURE_THRESHOLD = 5;
const CONSECUTIVE_SUCCESS_RECOVERY = 3;
const RECENT_WINDOW_MS = 60 * 60 * 1000;

interface IngestionRunRow {
  status: 'running' | 'succeeded' | 'failed';
  started_at: Date;
  completed_at: Date | null;
  error_summary: string | null;
  retryable: boolean | null;
  is_credential_failure: boolean | null;
  posts_ingested: number;
  trigger_type: TriggerType;
}

/**
 * ConnectorHealth has no backing table of its own (ADR-0009) — every field is
 * derived by querying ingestion_runs (and platform_credentials for
 * credentialStatus) at read time. See
 * .claude/skills/connector-health-and-error-handling/SKILL.md.
 *
 * `pageId` (ADR-0060 Decision §4, Story 6.27) — omitted, behavior is
 * byte-for-byte unchanged for every existing caller and every existing
 * connector (the query stays `WHERE platform_id = $1`, exactly as before
 * this story). Supplied, the `ingestion_runs` query additionally filters to
 * that Page's own rows only (populated by Facebook's own per-Page poll
 * fan-out, `pollFacebook.ts`) — a real, independent health signal per
 * connected Page, distinct from the platform-level rollup every other
 * caller still gets.
 *
 * `userId` (ADR-0061 Decision §2/§3, Story 1.15) scopes BOTH sub-queries —
 * ingestion_runs and platform_credentials — to that one user's own rows, so
 * a Tier-3 user's health/credentialStatus is never blended with the
 * tenant-wide (or another user's) rows on the same (tenantId, platformId).
 * `platform_credentials` has no `page_id` column, so `pageId` never filters
 * the credentialStatus sub-query — only `userId` does, unchanged from
 * Story 1.15.
 *
 * Story 13.1 (ADR-0109) — `trigger_type='health_check'` is a reset boundary.
 * When a run with this trigger type is encountered while scanning, only that
 * run and any newer runs are considered for consecutive-failure / -success
 * counting. This lets a failed re-enable attempt reset the counter to 1 and
 * a successful re-enable attempt immediately return `healthy`.
 */
export async function deriveConnectorHealth(
  tenantId: string,
  platformId: string,
  pageId?: string,
  userId?: string,
  options?: DeriveConnectorHealthOptions
): Promise<ConnectorHealth> {
  return withTenant(tenantId, async (client) => {
    const runConditions = ['platform_id = $1'];
    const runParams: unknown[] = [platformId];
    if (pageId) {
      runParams.push(pageId);
      runConditions.push(`page_id = $${runParams.length}`);
    }
    if (userId) {
      runParams.push(userId);
      runConditions.push(`user_id = $${runParams.length}`);
    }
    const { rows: runs } = await client.query<IngestionRunRow>(
      `SELECT status, started_at, completed_at, error_summary, retryable, is_credential_failure, posts_ingested, trigger_type
       FROM ingestion_runs
       WHERE ${runConditions.join(' AND ')} ORDER BY started_at DESC`,
      runParams
    );

    const { rows: credentialRows } = userId
      ? await client.query<{ status: CredentialStatus; created_at: Date }>(
          `SELECT status, created_at FROM platform_credentials
           WHERE platform_id = $1 AND owner_type = 'user' AND user_id = $2 ORDER BY created_at DESC LIMIT 1`,
          [platformId, userId]
        )
      : await client.query<{ status: CredentialStatus; created_at: Date }>(
          `SELECT status, created_at FROM platform_credentials WHERE platform_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [platformId]
        );
    const credentialStatus = credentialRows.length > 0 ? credentialRows[0].status : null;
    const credentialCreatedAt = credentialRows.length > 0 ? credentialRows[0].created_at : null;

    if (runs.length === 0) {
      return {
        status: 'disconnected',
        lastSuccessfulFetchAt: null,
        lastAttemptAt: null,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        credentialStatus,
        lastSuccessfulPostsIngested: null,
      };
    }

    // Build a relevant slice: start at the most recent run and stop at (and
    // include) the first health_check run encountered when scanning backward.
    const relevantRuns: IngestionRunRow[] = [];
    for (const run of runs) {
      relevantRuns.push(run);
      if (run.trigger_type === 'health_check') {
        break;
      }
    }

    const cutoff = Date.now() - RECENT_WINDOW_MS;
    let recentFailures = 0;
    let recentSuccesses = 0;
    let lastSuccessfulFetchAt: string | null = null;
    let lastSuccessfulPostsIngested: number | null = null;
    let consecutiveFailures = 0;
    let consecutiveSuccesses = 0;
    let stopped = false;

    const leadingStatus = relevantRuns[0].status;

    for (const run of relevantRuns) {
      if (stopped) break;

      const isBeforeCurrentCredential = credentialCreatedAt ? run.started_at < credentialCreatedAt : false;
      if (isBeforeCurrentCredential) {
        // The current credential was created after this run; older runs must
        // not count against the new credential. Stop scanning.
        stopped = true;
        break;
      }

      const withinWindow = run.started_at.getTime() >= cutoff;
      if (run.status === 'failed' && withinWindow) {
        recentFailures += 1;
      }
      if (run.status === 'succeeded' && withinWindow) {
        recentSuccesses += 1;
      }
      if (run.status === 'succeeded' && lastSuccessfulFetchAt === null) {
        lastSuccessfulFetchAt = run.completed_at ? run.completed_at.toISOString() : null;
        lastSuccessfulPostsIngested = run.posts_ingested ?? 0;
      }

      if (leadingStatus === 'failed') {
        if (run.status === 'failed') {
          consecutiveFailures += 1;
        } else {
          stopped = true;
        }
      } else {
        // leadingStatus === 'succeeded' or 'running'
        if (run.status === 'succeeded') {
          consecutiveSuccesses += 1;
        } else if (run.status === 'running') {
          // A running row in the middle does not break or advance a success
          // streak, but it also does not count as a success.
          continue;
        } else {
          stopped = true;
        }
      }
    }

    const latestRun = relevantRuns[0];
    const latestIsBeforeCredential = credentialCreatedAt ? latestRun.started_at < credentialCreatedAt : false;

    // 1. reconnect_required (credential failure on the latest run occurring
    //    AFTER current credential issuance).
    const isReconnectRequired =
      latestRun.status === 'failed' &&
      latestRun.is_credential_failure === true &&
      !latestIsBeforeCredential;

    // 2. disabled (explicitly non-retryable, non-credential failure on the
    //    latest run). Only `retryable = false` disables; `null` is treated as
    //    unclassified/legacy and does not immediately disable, but it still
    //    counts toward the consecutive-failure threshold.
    const isDisabled =
      latestRun.status === 'failed' &&
      latestRun.retryable === false &&
      latestRun.is_credential_failure !== true &&
      !latestIsBeforeCredential;

    // 3. failing — either the threshold of 5 consecutive failures, or a
    //    failed health-check run (which always returns the connector to
    //    `failing` with the counter reset to 1).
    const isFailing =
      latestRun.status === 'failed' &&
      !isReconnectRequired &&
      !isDisabled &&
      (latestRun.trigger_type === 'health_check' || consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD);

    // 4. stalled — active connector, valid credentials, not failing/disabled/
    //    reconnect_required, and cadence or silence breached.
    let isStalled = false;
    if (!isReconnectRequired && !isDisabled && !isFailing) {
      let isConnectorActiveState = options?.isConnectorActive;
      if (isConnectorActiveState === undefined) {
        if (userId) {
          const { rows: actRows } = await client.query<{ is_active: boolean }>(
            `SELECT is_active FROM connector_user_activations
             WHERE tenant_id = $1 AND platform_id = $2 AND user_id = $3`,
            [tenantId, platformId, userId]
          );
          isConnectorActiveState = actRows.length > 0 ? actRows[0].is_active : false;
        } else {
          const { rows: actRows } = await client.query<{ is_active: boolean }>(
            `SELECT is_active FROM connector_activations
             WHERE tenant_id = $1 AND platform_id = $2`,
            [tenantId, platformId]
          );
          isConnectorActiveState = actRows.length > 0 ? actRows[0].is_active : false;
        }
      }

      const hasValidCredentials =
        credentialStatus === null || credentialStatus === 'valid' || credentialStatus === 'expiring_soon';

      if (isConnectorActiveState && hasValidCredentials) {
        const now = options?.now ?? Date.now();
        const effectiveCadenceMs = options?.effectiveCadenceMs ?? DEFAULT_EFFECTIVE_CADENCE_MS;
        const stallCadenceThreshold = Math.max(MIN_STALL_CADENCE_MS, STALL_CADENCE_MULTIPLIER * effectiveCadenceMs);
        const lastAttemptMs = latestRun.started_at.getTime();
        const lastSuccessMs = lastSuccessfulFetchAt ? new Date(lastSuccessfulFetchAt).getTime() : -Infinity;

        const isCadenceBreached = now - lastAttemptMs >= stallCadenceThreshold;
        const isSilenceBreached = now - lastSuccessMs >= MAX_INGESTION_SILENCE_MS;
        if (isCadenceBreached || isSilenceBreached) {
          isStalled = true;
        }
      }
    }

    let status: ConnectorHealthStatus;
    if (isReconnectRequired) {
      status = 'reconnect_required';
    } else if (isDisabled) {
      status = 'disabled';
    } else if (isFailing) {
      status = 'failing';
    } else if (isStalled) {
      status = 'stalled';
    } else if (recentFailures > 0 && recentSuccesses > 0 && consecutiveSuccesses < CONSECUTIVE_SUCCESS_RECOVERY) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      lastSuccessfulFetchAt,
      lastAttemptAt: latestRun.started_at.toISOString(),
      consecutiveFailures,
      consecutiveSuccesses,
      credentialStatus,
      lastSuccessfulPostsIngested,
    };
  });
}

/**
 * Auto-disable is *behavior*, not stored state (ADR-0009's whole point): the
 * scheduler consults the same derived health this module already computes,
 * rather than a separate "disabled" flag anyone could write independently.
 *
 * Story 13.1 (ADR-0109) — `failing`, `disabled`, and `reconnect_required` are
 * all blocked states: the scheduler stops polling them. The half-open probe
 * for `failing` is removed; manual re-enable (`POST .../enable`) is the only
 * recovery path.
 *
 * Story 1.11 (ADR-0051) extends this with a second, independent
 * requirement: the matching-scope activation row (`connector_activations`
 * for `ownerType: 'tenant'`, `connector_user_activations` for
 * `ownerType: 'user'`) must also have `is_active = true`. `ownerType`
 * defaults to `'tenant'`, backward-compatible with every pre-existing call
 * site (Stories 2.3/2.4, which only ever checked the tenant-wide scope) --
 * see .claude/skills/connector-activation/SKILL.md.
 */
export async function shouldAttemptIngestion(
  tenantId: string,
  platformId: string,
  ownerType: ConnectorActivationOwnerType = 'tenant',
  userId?: string
): Promise<boolean> {
  const health = await deriveConnectorHealth(
    tenantId,
    platformId,
    undefined,
    ownerType === 'user' ? userId : undefined
  );
  if (health.status === 'failing' || health.status === 'disabled' || health.status === 'reconnect_required') {
    return false;
  }
  return isConnectorActive(tenantId, platformId, ownerType, userId);
}

/** The reason shown to the tenant when auto-disabled — the most recent failure's errorSummary. */
export async function getAutoDisableReason(
  tenantId: string,
  platformId: string
): Promise<string | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ error_summary: string | null }>(
      `SELECT error_summary FROM ingestion_runs
       WHERE platform_id = $1 AND status = 'failed'
       ORDER BY started_at DESC LIMIT 1`,
      [platformId]
    );
    return rows.length > 0 ? rows[0].error_summary : null;
  });
}

export interface RunConnectorHealthCheckInput {
  tenantId: string;
  platformId: string;
  /** Tier-3 (user-bound) scope — omitted for tenant-wide connectors. */
  userId?: string;
  pageId?: string;
}

/**
 * Story 13.1 (ADR-0109) — the manual re-enable health check.
 *
 * If the connector exposes `healthCheck()`, it is invoked directly and is
 * expected to call `runIngestionAttempt()` with `trigger_type='health_check'`.
 * If the connector omits `healthCheck()` (all existing connectors as of this
 * story), the check falls back to a single `connector.poll()` or
 * `connector.pollUser()` call and the resulting run's `trigger_type` is
 * rewritten to `health_check` so `deriveConnectorHealth()` treats it as a
 * reset boundary.
 */
export async function runConnectorHealthCheck(
  input: RunConnectorHealthCheckInput
): Promise<RunIngestionAttemptResult> {
  const connector = getSocialConnector(input.platformId);
  if (!connector) {
    throw new Error(`Connector not registered for platform: ${input.platformId}`);
  }

  if (connector.healthCheck) {
    return connector.healthCheck(input.tenantId, input.userId);
  }

  if (input.userId && connector.pollUser) {
    const result = await connector.pollUser(input.tenantId, input.userId);
    await updateIngestionRunTriggerType(input.tenantId, result.runId, 'health_check');
    return result;
  }

  if (connector.poll) {
    const result = await connector.poll(input.tenantId);
    await updateIngestionRunTriggerType(input.tenantId, result.runId, 'health_check');
    return result;
  }

  // Connector has no poll, pollUser, or healthCheck — perform a minimal
  // connectivity-style attempt and record it as a health_check run. This is
  // the no-poll fallback (e.g. a push-only connector); it fails the health
  // check so the connector returns to `failing` / `disabled` as appropriate.
  const run = await startIngestionRun(input.tenantId, {
    platformId: input.platformId,
    triggerType: 'health_check',
    connectorVersion: '1.0.0',
    userId: input.userId,
    pageId: input.pageId,
  });
  const errorSummary = 'Connector has no poll or healthCheck implementation';
  await completeIngestionRun(input.tenantId, run.id, {
    status: 'failed',
    postsIngested: 0,
    postsSkipped: 0,
    errorSummary,
    retryable: false,
    isCredentialFailure: false,
  });
  return { runId: run.id, status: 'failed', errorSummary };
}
