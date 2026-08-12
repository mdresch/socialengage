import { Pool } from 'pg';

/**
 * Story 1.10 (ADR-0016) — Postgres connectivity probing, used both to gate
 * server boot and to answer GET /v1/health. See
 * .claude/skills/postgres-tenant-db/SKILL.md.
 */

const DEFAULT_RETRIES = 5;
const DEFAULT_BACKOFF_MS = 500;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 3000;

export interface WaitForPostgresReadyOptions {
  retries?: number;
  backoffMs?: number;
  attemptTimeoutMs?: number;
}

/**
 * A single, bounded-timeout connectivity probe (`SELECT 1`) against the
 * given pool. Never throws — resolves `false` on any failure (refused
 * connection, auth failure, timeout, ...). Used directly, per-request, by
 * `GET /v1/health` — deliberately no retrying here, since a liveness probe
 * should reflect current state quickly, not mask a real outage behind a
 * multi-second retry loop.
 */
export async function checkPostgresConnectivity(
  pool: Pool,
  attemptTimeoutMs: number = DEFAULT_ATTEMPT_TIMEOUT_MS
): Promise<boolean> {
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('Postgres connectivity check timed out')), attemptTimeoutMs)
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Boot-time readiness gate — retries `checkPostgresConnectivity()` with a
 * fixed backoff, so a Postgres instance merely slow to accept connections
 * at container cold-start isn't treated identically to one that's
 * genuinely unreachable. Resolves silently on success; throws a clear,
 * actionable Error after exhausting `retries` attempts. Called once, by
 * `server.ts`, before `.listen()` — never per-request.
 */
export async function waitForPostgresReady(pool: Pool, options: WaitForPostgresReadyOptions = {}): Promise<void> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const attemptTimeoutMs = options.attemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS;

  for (let attempt = 1; attempt <= retries; attempt++) {
    if (await checkPostgresConnectivity(pool, attemptTimeoutMs)) {
      return;
    }
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw new Error(
    `Postgres is not reachable after ${retries} attempts (${backoffMs}ms backoff each) — refusing to start. ` +
      'Check PGHOST/PGPORT/PGDATABASE/APP_PGUSER/APP_PGPASSWORD.'
  );
}
