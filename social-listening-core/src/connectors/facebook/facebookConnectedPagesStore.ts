import { withTenant } from '../../db/withTenant';

/**
 * Story 6.27 (ADR-0060 Decision §1) — the real, queryable child table
 * behind Facebook's own multi-Page-per-user cardinality. Carries exactly
 * the non-secret fields (`pageId`/`pageName`/`status`) a list screen needs
 * without decrypting anything — the actual secret lives in
 * `platform_credentials`, referenced here only by `credentialId`. See
 * .claude/skills/facebook-connector/SKILL.md.
 */
export type FacebookConnectedPageStatus = 'connected' | 'removed' | 'orphaned';

export interface FacebookConnectedPage {
  id: string;
  tenantId: string;
  userId: string;
  pageId: string;
  pageName: string;
  /** Null once the row's own credential has been destroyed (a soft-removed row, ON DELETE SET NULL) — the row itself survives as history regardless. */
  credentialId: string | null;
  status: FacebookConnectedPageStatus;
  createdAt: string;
  updatedAt: string;
}

interface RawRow {
  id: string;
  tenant_id: string;
  user_id: string;
  page_id: string;
  page_name: string;
  credential_id: string | null;
  status: FacebookConnectedPageStatus;
  created_at: Date;
  updated_at: Date;
}

function toPage(row: RawRow): FacebookConnectedPage {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    pageId: row.page_id,
    pageName: row.page_name,
    credentialId: row.credential_id,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const ROW_COLUMNS = 'id, tenant_id, user_id, page_id, page_name, credential_id, status, created_at, updated_at';

/** Every row for this user, any status — the real list screen's own read (Decision §5/§6): connected, removed, and orphaned all render, each distinctly. */
export async function listPagesForUser(tenantId: string, userId: string): Promise<FacebookConnectedPage[]> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawRow>(
      `SELECT ${ROW_COLUMNS} FROM facebook_connected_pages
       WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
      [tenantId, userId]
    );
    return rows.map(toPage);
  });
}

/** Only `status = 'connected'` rows — the per-Page poll fan-out's own enumeration (Decision §3), never `removed`/`orphaned`. */
export async function listConnectedPages(tenantId: string, userId: string): Promise<FacebookConnectedPage[]> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawRow>(
      `SELECT ${ROW_COLUMNS} FROM facebook_connected_pages
       WHERE tenant_id = $1 AND user_id = $2 AND status = 'connected' ORDER BY created_at ASC`,
      [tenantId, userId]
    );
    return rows.map(toPage);
  });
}

/**
 * Re-selecting an already-connected `pageId` upserts (refreshes
 * `credentialId`/`pageName`, leaves `status = 'connected'`) rather than
 * violating the table's own `UNIQUE (tenant_id, user_id, page_id)`
 * constraint or creating a duplicate row (Decision §1).
 */
export async function upsertConnectedPage(
  tenantId: string,
  userId: string,
  input: { pageId: string; pageName: string; credentialId: string }
): Promise<FacebookConnectedPage> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawRow>(
      `INSERT INTO facebook_connected_pages (tenant_id, user_id, page_id, page_name, credential_id, status)
       VALUES ($1, $2, $3, $4, $5, 'connected')
       ON CONFLICT (tenant_id, user_id, page_id)
       DO UPDATE SET credential_id = EXCLUDED.credential_id, page_name = EXCLUDED.page_name, status = 'connected'
       RETURNING ${ROW_COLUMNS}`,
      [tenantId, userId, input.pageId, input.pageName, input.credentialId]
    );
    return toPage(rows[0]);
  });
}

/**
 * Added at ADR-0060 review — a real re-consent `/exchange` call whose
 * returned Page list (`currentPageIds`) no longer includes a previously
 * `status = 'connected'` `page_id` auto-transitions that row to `orphaned`,
 * never left silently stale. An empty `currentPageIds` array correctly
 * orphans every currently-connected row (Postgres's own `= ANY('{}')`
 * evaluates false for every row, so `page_id <> ALL($3)` is true for all —
 * no special-casing needed).
 */
export async function markMissingPagesOrphaned(tenantId: string, userId: string, currentPageIds: string[]): Promise<void> {
  await withTenant(tenantId, async (client) => {
    await client.query(
      `UPDATE facebook_connected_pages
       SET status = 'orphaned'
       WHERE tenant_id = $1 AND user_id = $2 AND status = 'connected' AND page_id <> ALL($3::text[])`,
      [tenantId, userId, currentPageIds]
    );
  });
}

/**
 * Soft-remove (Decision §1/§5) — `status = 'removed'`, never a hard
 * `DELETE`, preserving the audit trail of which Pages were ever connected.
 * Scoped to the caller's own `userId` in the WHERE clause itself, so a
 * cross-user id naturally returns `null` (404, never 403 — ADR-0044 §5c's
 * own established convention for a personal resource) rather than needing
 * a separate ownership check.
 */
export async function removeConnectedPage(tenantId: string, userId: string, id: string): Promise<FacebookConnectedPage | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawRow>(
      `UPDATE facebook_connected_pages
       SET status = 'removed'
       WHERE tenant_id = $1 AND user_id = $2 AND id = $3
       RETURNING ${ROW_COLUMNS}`,
      [tenantId, userId, id]
    );
    return rows.length > 0 ? toPage(rows[0]) : null;
  });
}
