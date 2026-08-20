import { withTenant } from '../db/withTenant';
import { isConnectorActive, ConnectorActivationOwnerType } from './connectorActivationStore';

/**
 * Story 2.15 (ADR-0059 Decision §4) added 'reconnect_required' — a
 * credential-class failure (password change, admin removal, grant
 * revocation — anything Meta returns as a 401/403 for) on the most recent
 * run. Distinct from 'failing': a rate-limit/network blip is something the
 * connector will recover from on its own; a revoked OAuth grant will not,
 * no matter how many times it's retried, and needs the connecting
 * individual to actually reconnect (ADR-0059 Decision §4's own named silent-
 * failure problem this status exists to surface honestly).
 */
export type ConnectorHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'failing'
  | 'disconnected'
  | 'reconnect_required'
  | 'stalled';
export type CredentialStatus = 'valid' | 'expiring_soon' | 'expired' | 'revoked';

export interface ConnectorHealth {
  status: ConnectorHealthStatus;
  lastSuccessfulFetchAt: string | null;
  lastAttemptAt: string | null;
  consecutiveFailures: number;
  credentialStatus: CredentialStatus | null;
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
 * `failing` derivation (Story 2.5, ADR-0023) — supersedes the original flat
 * "≥10 failures/hour" placeholder (ADR-0009/ADR-0010's own text, see each
 * ADR's "Supersession update" note). `degraded`/`disconnected`/`healthy`
 * are unaffected — ADR-0023 changes only this one rule. See
 * .claude/skills/connector-health-and-error-handling/SKILL.md.
 */
const RATE_FAILURE_THRESHOLD = 0.5;
const RATE_ATTEMPT_FLOOR = 5;
const CONSECUTIVE_FAILURE_CEILING = 20;
const RECENT_WINDOW_MS = 60 * 60 * 1000;

/**
 * ADR-0023 Clarification (2026-08-17) — the rate rule already self-heals as
 * its 1-hour window ages; the absolute ceiling had no equivalent, since it
 * scans unboundedly backward for an unbroken failure streak with no time
 * dimension to decay through. Once `failing`, shouldAttemptIngestion() now
 * allows exactly one probe attempt through once the last attempt is older
 * than this cooldown — a standard circuit-breaker "half-open" allowance,
 * not a change to the 50%/5-attempt-floor/20-consecutive numbers
 * themselves. See connector-health-and-error-handling/SKILL.md.
 */
const PROBE_COOLDOWN_MS = 15 * 60 * 1000;

interface IngestionRunRow {
  status: 'running' | 'succeeded' | 'failed';
  started_at: Date;
  completed_at: Date | null;
  error_summary: string | null;
  retryable: boolean | null;
  is_credential_failure: boolean | null;
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
 * Story 1.16 (ADR-0070 §2) — derives 'stalled' status with strict precedence:
 * disconnected -> reconnect_required -> failing -> stalled -> degraded -> healthy.
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
      `SELECT status, started_at, completed_at, error_summary, retryable, is_credential_failure FROM ingestion_runs
       WHERE ${runConditions.join(' AND ')} ORDER BY started_at DESC`,
      runParams
    );

    const { rows: credentialRows } = userId
      ? await client.query<{ status: CredentialStatus }>(
          `SELECT status FROM platform_credentials
           WHERE platform_id = $1 AND owner_type = 'user' AND user_id = $2 ORDER BY created_at DESC LIMIT 1`,
          [platformId, userId]
        )
      : await client.query<{ status: CredentialStatus }>(
          `SELECT status FROM platform_credentials WHERE platform_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [platformId]
        );
    const credentialStatus = credentialRows.length > 0 ? credentialRows[0].status : null;

    if (runs.length === 0) {
      return {
        status: 'disconnected',
        lastSuccessfulFetchAt: null,
        lastAttemptAt: null,
        consecutiveFailures: 0,
        credentialStatus,
      };
    }

    const cutoff = Date.now() - RECENT_WINDOW_MS;
    let recentFailures = 0;
    let recentSuccesses = 0;
    let lastSuccessfulFetchAt: string | null = null;
    let consecutiveFailures = 0;
    let sawSuccess = false;

    for (const run of runs) {
      // Story 2.12 (ADR-0010/ADR-0023 Clarification, 2026-08-12): a
      // retryable failure (rate-limit/network/5xx) never counts toward
      // this derivation, on its own — treated as fully invisible here,
      // the same way runIngestionAttempt() already retries it
      // automatically rather than surfacing it as a connector-level
      // problem. A NULL retryable value (an unclassified failure, e.g.
      // a fixture row) is treated conservatively, as non-retryable.
      const isNonRetryableFailure = run.status === 'failed' && run.retryable !== true;
      const withinWindow = run.started_at.getTime() >= cutoff;
      if (isNonRetryableFailure && withinWindow) recentFailures += 1;
      if (run.status === 'succeeded' && withinWindow) recentSuccesses += 1;
      if (run.status === 'succeeded' && lastSuccessfulFetchAt === null) {
        lastSuccessfulFetchAt = run.completed_at ? run.completed_at.toISOString() : null;
      }
      if (!sawSuccess) {
        if (isNonRetryableFailure) consecutiveFailures += 1;
        else if (run.status === 'succeeded') sawSuccess = true;
      }
    }

    const recentAttempts = recentFailures + recentSuccesses;
    const rateFailing =
      recentAttempts >= RATE_ATTEMPT_FLOOR && recentFailures / recentAttempts >= RATE_FAILURE_THRESHOLD;
    const ceilingFailing = consecutiveFailures >= CONSECUTIVE_FAILURE_CEILING;

    // Strict precedence order (ADR-0070 §2):
    // 1. reconnect_required (credential failure on runs[0] OR revoked/expired credentialStatus)
    const isCredentialRevoked = credentialStatus === 'expired' || credentialStatus === 'revoked';
    const isLatestRunCredentialFailure = runs[0].status === 'failed' && runs[0].is_credential_failure === true;
    const isReconnectRequired = isLatestRunCredentialFailure || isCredentialRevoked;

    // 2. failing (rate or ceiling)
    const isFailing = rateFailing || ceilingFailing;

    // 3. stalled (active connector, valid credentials, not failing or reconnect_required, and cadence or silence breached)
    let isStalled = false;
    if (!isReconnectRequired && !isFailing) {
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

      const hasValidCredentials = credentialStatus === null || credentialStatus === 'valid' || credentialStatus === 'expiring_soon';

      if (isConnectorActiveState && hasValidCredentials) {
        const now = options?.now ?? Date.now();
        const effectiveCadenceMs = options?.effectiveCadenceMs ?? DEFAULT_EFFECTIVE_CADENCE_MS;
        const stallCadenceThreshold = Math.max(MIN_STALL_CADENCE_MS, STALL_CADENCE_MULTIPLIER * effectiveCadenceMs);
        const lastAttemptMs = runs[0].started_at.getTime();
        const lastSuccessMs = lastSuccessfulFetchAt ? new Date(lastSuccessfulFetchAt).getTime() : -Infinity;

        const isCadenceBreached = (now - lastAttemptMs) >= stallCadenceThreshold;
        const isSilenceBreached = (now - lastSuccessMs) >= MAX_INGESTION_SILENCE_MS;
        if (isCadenceBreached || isSilenceBreached) {
          isStalled = true;
        }
      }
    }

    const status: ConnectorHealthStatus = isReconnectRequired
      ? 'reconnect_required'
      : isFailing
        ? 'failing'
        : isStalled
          ? 'stalled'
          : recentFailures > 0 && recentSuccesses > 0
            ? 'degraded'
            : 'healthy';

    return {
      status,
      lastSuccessfulFetchAt,
      lastAttemptAt: runs[0].started_at.toISOString(),
      consecutiveFailures,
      credentialStatus,
    };
  });
}

/**
 * Auto-disable is *behavior*, not stored state (ADR-0009's whole point): the
 * scheduler consults the same derived health this module already computes,
 * rather than a separate "disabled" flag anyone could write independently.
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
  // Story 1.15: forward ownerType/userId into deriveConnectorHealth() so a
  // Tier-3 user's eligibility check reads that user's own health, not the
  // tenant-wide (or another user's) health — a real, previously-silent
  // Story 1.11 bug (this call used to ignore both arguments entirely).
  const health = await deriveConnectorHealth(
    tenantId,
    platformId,
    undefined,
    ownerType === 'user' ? userId : undefined
  );
  if (health.status === 'failing') {
    const withinProbeCooldown =
      health.lastAttemptAt !== null && Date.now() - new Date(health.lastAttemptAt).getTime() < PROBE_COOLDOWN_MS;
    if (withinProbeCooldown) return false;
    // Cooldown elapsed: fall through to the normal activation check below,
    // allowing exactly one probe attempt. A success clears the streak via
    // deriveConnectorHealth()'s own existing scan-until-a-success logic,
    // unmodified; a failure just restarts the cooldown (lastAttemptAt
    // updates either way).
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
