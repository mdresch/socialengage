import { PoolClient, QueryResultRow } from 'pg';
import { withTenant } from '../db/withTenant';
import { getTenantDeletionPool } from '../db/tenantDeletionPool';
import { getAdminPool } from '../db/adminPool';
import { logPlatformAdminAction } from '../admin/platformAdminAuditLog';
import { deleteArchiveBlob, downloadArchiveBlob } from '../archival/blobArchiveClient';

/**
 * Story 3.8 (ADR-0043, superseding ADR-0039 Decision §1 in full) —
 * self-service, tenant_admin-initiated tenant offboarding: request, export,
 * 30-day grace period, cancel, confirm. Every step runs under app_user's own
 * RLS-scoped connection (withTenant()) — platform_admin_role is never used
 * here, matching Story 5.7's own "zero access" boundary with no exception.
 *
 * 2026-08-12 (Story 1.5/ADR-0044 §5c ripple): `watchlists` gained a
 * per-user ownership RLS predicate, which this file's own whole-tenant
 * export/delete steps cannot satisfy — they legitimately need every
 * watchlist in the tenant, not one caller's own. exportTenantData()'s
 * watchlists read below is the one narrow exception to the paragraph
 * above: it uses getAdminPool() (the plain superuser connection this
 * project's own migration runner already uses — never platform_admin_role,
 * which still has zero grants on this table and stays untouched), with
 * `tenant_id` still enforced explicitly in the SQL rather than relied on
 * via RLS. batchDeleteByTenant('watchlists', ...) further down is
 * deliberately left unfixed the same way — it now deletes zero watchlist
 * rows directly (still RLS-blocked), but every watchlist is removed anyway
 * a few lines later via `ON DELETE CASCADE` on `watchlists.user_id` once
 * that batch reaches `users` (migration 0025) — this is what actually
 * closes the FK-violation hang this same investigation found, not a
 * workaround around it.
 */

export const GRACE_PERIOD_DAYS = 30;

interface SocialPostRow extends QueryResultRow {
  id: string;
  acquisition_id: string | null;
  raw_payload: { archived?: boolean; blobPath?: string } | Record<string, unknown>;
  [key: string]: unknown;
}

const BLOB_ARCHIVED = (payload: unknown): payload is { archived: true; blobPath: string } =>
  typeof payload === 'object' &&
  payload !== null &&
  (payload as { archived?: unknown }).archived === true &&
  typeof (payload as { blobPath?: unknown }).blobPath === 'string';

/** Resolves every social_posts row's rawPayload, downloading archived-tier content by its blobPath (ADR-0018). */
async function resolveSocialPostsForExport(client: PoolClient, tenantId: string): Promise<Record<string, unknown>[]> {
  const { rows } = await client.query<SocialPostRow>(`SELECT * FROM social_posts WHERE tenant_id = $1`, [tenantId]);
  return Promise.all(
    rows.map(async (row) => {
      if (BLOB_ARCHIVED(row.raw_payload)) {
        const content = await downloadArchiveBlob(row.raw_payload.blobPath);
        return { ...row, raw_payload: JSON.parse(content) };
      }
      return row;
    })
  );
}

/** Distinct, non-null acquisition_id values referenced by this tenant's own social_posts. */
async function referencedIngestionRunIds(client: PoolClient, tenantId: string): Promise<string[]> {
  const { rows } = await client.query<{ acquisition_id: string }>(
    `SELECT DISTINCT acquisition_id FROM social_posts WHERE tenant_id = $1 AND acquisition_id IS NOT NULL`,
    [tenantId]
  );
  return rows.map((r) => r.acquisition_id);
}

/**
 * Archived ingestion_runs (whole row already left Postgres, ADR-0018's
 * 2026-07-30 amendment) are only discoverable via a social_posts row's own
 * acquisition_id reference — a run with zero referencing posts (e.g. one
 * that ingested nothing) is not enumerable this way. Named honestly as a
 * real, accepted gap in .claude/skills/self-service-tenant-deletion/SKILL.md,
 * not silently glossed over.
 */
async function resolveArchivedIngestionRuns(
  tenantId: string,
  referencedRunIds: string[],
  liveRunIds: Set<string>
): Promise<Record<string, unknown>[]> {
  const archived: Record<string, unknown>[] = [];
  for (const runId of referencedRunIds) {
    if (liveRunIds.has(runId)) continue;
    try {
      const content = await downloadArchiveBlob(`ingestion-runs/${runId}.json`);
      const parsed = JSON.parse(content) as { tenant_id: string };
      if (parsed.tenant_id === tenantId) archived.push(parsed);
    } catch {
      // Not archived either (e.g. a stale/invalid reference) — skip, don't fail the whole export.
    }
  }
  return archived;
}

export interface TenantExport {
  tenantId: string;
  exportedAt: string;
  socialPosts: Record<string, unknown>[];
  authors: Record<string, unknown>[];
  watchlists: Record<string, unknown>[];
  ingestionRuns: Record<string, unknown>[];
}

/**
 * ADR-0043 §4 — structured export of the caller's own tenant data, resolving
 * archived tiers (social_posts.raw_payload's blob pointer, whole archived
 * ingestion_runs rows). Re-triggerable — safe to call any number of times
 * during the grace period. Ingestion has already halted by the time this is
 * ever meaningfully called (deletion_requested_at is set — enforced at
 * runIngestionAttempt(), not here), so the data does not shift under a
 * tenant exporting more than once.
 */
export async function exportTenantData(tenantId: string): Promise<TenantExport> {
  return withTenant(tenantId, async (client) => {
    const socialPosts = await resolveSocialPostsForExport(client, tenantId);
    const authorsResult = await client.query(`SELECT * FROM authors WHERE tenant_id = $1`, [tenantId]);
    // See this file's own 2026-08-12 header note — watchlists is
    // ownership-RLS-scoped now, so a whole-tenant export needs the admin
    // pool here, with tenant_id still explicitly enforced in the query.
    const watchlistsResult = await getAdminPool().query(`SELECT * FROM watchlists WHERE tenant_id = $1`, [tenantId]);
    const liveRunsResult = await client.query<{ id: string }>(`SELECT * FROM ingestion_runs WHERE tenant_id = $1`, [
      tenantId,
    ]);
    const referencedRunIds = await referencedIngestionRunIds(client, tenantId);

    const liveRunIds = new Set(liveRunsResult.rows.map((r) => r.id));
    const archivedRuns = await resolveArchivedIngestionRuns(tenantId, referencedRunIds, liveRunIds);

    return {
      tenantId,
      exportedAt: new Date().toISOString(),
      socialPosts,
      authors: authorsResult.rows,
      watchlists: watchlistsResult.rows,
      ingestionRuns: [...liveRunsResult.rows, ...archivedRuns],
    };
  });
}

const DELETE_BATCH_SIZE = 500;

/**
 * Bounded, not a single unbounded statement — deletes at most
 * DELETE_BATCH_SIZE rows per round trip, looping until none remain, each
 * batch its own short withTenant() transaction (matching the original,
 * already-proven "many small round trips, not one giant transaction"
 * shape). `table` is never caller/user-controlled — only the six hardcoded
 * literals below ever reach this function, so string interpolation here is
 * safe (no SQL injection surface); Postgres has no parameterized-identifier
 * syntax for table names.
 */
async function batchDeleteByTenant(table: string, tenantId: string): Promise<number> {
  let total = 0;
  for (;;) {
    const rowCount = await withTenant(
      tenantId,
      async (client) => {
        const result = await client.query(
          `DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} WHERE tenant_id = $1 LIMIT $2)`,
          [tenantId, DELETE_BATCH_SIZE]
        );
        return result.rowCount ?? 0;
      },
      getTenantDeletionPool()
    );
    total += rowCount;
    if (rowCount < DELETE_BATCH_SIZE) break;
  }
  return total;
}

/**
 * ADR-0043 §6 (reusing ADR-0039 §3/§4's own per-table treatment and
 * asynchronous, bounded execution) — the actual, irreversible hard-delete,
 * run asynchronously (never awaited by the request handler that confirms
 * deletion) after tenants.status has already been set to 'deleting'. Order
 * matters: social_posts before ingestion_runs (social_posts.acquisition_id
 * REFERENCES ingestion_runs(id), no ON DELETE clause — deleting a
 * referenced run first would violate that FK); tenants itself last, since
 * platform_admin_audit_log/domain_signup_attempts rows referencing it must
 * remain queryable throughout, and its removal is what "deletion is now
 * truly complete" actually means (ADR-0039 §3's own tombstone framing).
 *
 * A previously-valid platform_credentials row's plaintext becomes
 * permanently unrecoverable once its own row (wrapped_dek + ciphertext) is
 * gone — Key Vault only ever held the one shared wrapping key across every
 * tenant, never a per-tenant or per-credential secret object, so there is
 * nothing further to "revoke" from Key Vault itself. See this component's
 * own SKILL.md Load-bearing constraints for the full account.
 */
export async function executeTenantDeletion(tenantId: string, actorIdentity: string): Promise<void> {
  const deletionPool = getTenantDeletionPool();

  // First action, deliberately: the transient marker for the bounded
  // window between confirmation and the tenants row itself actually being
  // removed. Runs under tenant_deletion_role's own narrow, column-scoped
  // UPDATE(status) grant — never app_user's (status stays locked to a
  // privileged role, ADR-0030 §2/ADR-0031 §3; ADR-0043 §2 deliberately
  // leaves it untouched by the request/export/cancel steps).
  await withTenant(tenantId, (client) => client.query(`UPDATE tenants SET status = 'deleting' WHERE id = $1`, [tenantId]), deletionPool);

  const referencedRunIds = await withTenant(
    tenantId,
    (client) => referencedIngestionRunIds(client, tenantId),
    deletionPool
  );
  const rawPayloadBlobPaths = await withTenant(
    tenantId,
    async (client) => {
      const { rows } = await client.query<{ raw_payload: { blobPath?: string } }>(
        `SELECT raw_payload FROM social_posts WHERE tenant_id = $1 AND raw_payload ->> 'archived' = 'true'`,
        [tenantId]
      );
      return rows.map((r) => r.raw_payload.blobPath).filter((p): p is string => typeof p === 'string');
    },
    deletionPool
  );

  const socialPosts = await batchDeleteByTenant('social_posts', tenantId);
  for (const blobPath of rawPayloadBlobPaths) {
    await deleteArchiveBlob(blobPath);
  }

  const authors = await batchDeleteByTenant('authors', tenantId);

  const liveRunIds = await withTenant(
    tenantId,
    async (client) => {
      const { rows } = await client.query<{ id: string }>(`SELECT id FROM ingestion_runs WHERE tenant_id = $1`, [
        tenantId,
      ]);
      return new Set(rows.map((r) => r.id));
    },
    deletionPool
  );
  const ingestionRuns = await batchDeleteByTenant('ingestion_runs', tenantId);

  let archivedIngestionRunBlobsDeleted = 0;
  for (const runId of referencedRunIds) {
    if (liveRunIds.has(runId)) continue;
    const deleted = await deleteArchiveBlob(`ingestion-runs/${runId}.json`);
    if (deleted) archivedIngestionRunBlobsDeleted += 1;
  }

  const watchlistShares = await batchDeleteByTenant('watchlist_shares', tenantId);
  const watchlists = await batchDeleteByTenant('watchlists', tenantId);
  const platformCredentials = await batchDeleteByTenant('platform_credentials', tenantId);
  const users = await batchDeleteByTenant('users', tenantId);

  // Last: the tenants row itself. platform_admin_audit_log.target_tenant_id
  // and domain_signup_attempts.tenant_id both survive this as unenforced
  // tombstone references — neither has (or, per migrations/0023, any longer
  // has) an FK that would block this. Logged in the same withTenant() call
  // that performs the delete so the audit write runs under the identical
  // app_user connection, never platform_admin_role's.
  await withTenant(
    tenantId,
    async (client) => {
      await client.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
      await logPlatformAdminAction(
        {
          actorIdentity,
          operation: 'tenant_deletion_completed',
          targetTenantId: tenantId,
          detail: {
            socialPosts,
            authors,
            watchlistShares,
            watchlists,
            platformCredentials,
            users,
            ingestionRuns,
            archivedIngestionRunBlobsDeleted,
            rawPayloadBlobsDeleted: rawPayloadBlobPaths.length,
          },
        },
        client
      );
    },
    deletionPool
  );
}
