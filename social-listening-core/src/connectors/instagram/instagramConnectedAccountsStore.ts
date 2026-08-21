import { withTenant } from '../../db/withTenant';

/**
 * Story 2.24 (ADR-0068 Decision §2) — Multi-account queryable child table
 * behind Instagram's own multi-account-per-user cardinality.
 * Holds non-secret account metadata (`igUserId`, `username`, `pageId`, `pageName`, `status`)
 * while the actual secret lives encrypted in `platform_credentials`.
 * See .claude/skills/instagram-connector/SKILL.md.
 */
export type InstagramConnectedAccountStatus = 'connected' | 'removed' | 'orphaned' | 'reconnect_required';

export interface InstagramConnectedAccount {
  id: string;
  tenantId: string;
  userId: string;
  igUserId: string;
  username: string;
  pageId: string;
  pageName: string;
  /** Null once the row's own credential has been destroyed (soft-removed row, ON DELETE SET NULL). */
  credentialId: string | null;
  status: InstagramConnectedAccountStatus;
  createdAt: string;
  updatedAt: string;
}

interface RawRow {
  id: string;
  tenant_id: string;
  user_id: string;
  ig_user_id: string;
  username: string;
  page_id: string;
  page_name: string;
  credential_id: string | null;
  status: InstagramConnectedAccountStatus;
  created_at: Date;
  updated_at: Date;
}

function toAccount(row: RawRow): InstagramConnectedAccount {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    igUserId: row.ig_user_id,
    username: row.username,
    pageId: row.page_id,
    pageName: row.page_name,
    credentialId: row.credential_id,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const ROW_COLUMNS = 'id, tenant_id, user_id, ig_user_id, username, page_id, page_name, credential_id, status, created_at, updated_at';

/** Returns all accounts for this user regardless of status (for list/management UI). */
export async function listAccountsForUser(tenantId: string, userId: string): Promise<InstagramConnectedAccount[]> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawRow>(
      `SELECT ${ROW_COLUMNS} FROM instagram_connected_accounts
       WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
      [tenantId, userId]
    );
    return rows.map(toAccount);
  });
}

/** Returns only `status = 'connected'` rows for the poller loop. */
export async function listConnectedAccounts(tenantId: string, userId: string): Promise<InstagramConnectedAccount[]> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawRow>(
      `SELECT ${ROW_COLUMNS} FROM instagram_connected_accounts
       WHERE tenant_id = $1 AND user_id = $2 AND status = 'connected' ORDER BY created_at ASC`,
      [tenantId, userId]
    );
    return rows.map(toAccount);
  });
}

/**
 * Upserts an Instagram account connection (refreshes credentialId, username, pageId, pageName, and sets status = 'connected').
 */
export async function upsertConnectedAccount(
  tenantId: string,
  userId: string,
  input: { igUserId: string; username: string; pageId: string; pageName: string; credentialId: string }
): Promise<InstagramConnectedAccount> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawRow>(
      `INSERT INTO instagram_connected_accounts (tenant_id, user_id, ig_user_id, username, page_id, page_name, credential_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'connected')
       ON CONFLICT (tenant_id, user_id, ig_user_id)
       DO UPDATE SET credential_id = EXCLUDED.credential_id, username = EXCLUDED.username, page_id = EXCLUDED.page_id, page_name = EXCLUDED.page_name, status = 'connected'
       RETURNING ${ROW_COLUMNS}`,
      [tenantId, userId, input.igUserId, input.username, input.pageId, input.pageName, input.credentialId]
    );
    return toAccount(rows[0]);
  });
}

/**
 * Updates the status of an Instagram account (e.g. transitioning to 'reconnect_required', 'removed', or 'orphaned').
 */
export async function updateAccountStatus(
  tenantId: string,
  userId: string,
  igUserId: string,
  status: InstagramConnectedAccountStatus
): Promise<InstagramConnectedAccount | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawRow>(
      `UPDATE instagram_connected_accounts
       SET status = $1
       WHERE tenant_id = $2 AND user_id = $3 AND ig_user_id = $4
       RETURNING ${ROW_COLUMNS}`,
      [status, tenantId, userId, igUserId]
    );
    return rows.length > 0 ? toAccount(rows[0]) : null;
  });
}

/**
 * Retrieves a single connected account by igUserId.
 */
export async function getConnectedAccountByIgUserId(
  tenantId: string,
  userId: string,
  igUserId: string
): Promise<InstagramConnectedAccount | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawRow>(
      `SELECT ${ROW_COLUMNS} FROM instagram_connected_accounts
       WHERE tenant_id = $1 AND user_id = $2 AND ig_user_id = $3`,
      [tenantId, userId, igUserId]
    );
    return rows.length > 0 ? toAccount(rows[0]) : null;
  });
}

/**
 * Added per ADR-0068 — a real re-consent `/exchange` call whose returned account list
 * no longer includes a previously `status = 'connected'` `ig_user_id` auto-transitions that row to `orphaned`.
 */
export async function markMissingAccountsOrphaned(tenantId: string, userId: string, currentIgUserIds: string[]): Promise<void> {
  await withTenant(tenantId, async (client) => {
    await client.query(
      `UPDATE instagram_connected_accounts
       SET status = 'orphaned'
       WHERE tenant_id = $1 AND user_id = $2 AND status = 'connected' AND ig_user_id <> ALL($3::text[])`,
      [tenantId, userId, currentIgUserIds]
    );
  });
}

/**
 * Soft-removes an account (status = 'removed', credential_id = NULL) preserving the historical row.
 */
export async function removeConnectedAccount(tenantId: string, userId: string, id: string): Promise<InstagramConnectedAccount | null> {
  return withTenant(tenantId, async (client) => {
    const { rows: existing } = await client.query<{ credential_id: string | null }>(
      `SELECT credential_id FROM instagram_connected_accounts WHERE tenant_id = $1 AND user_id = $2 AND id = $3`,
      [tenantId, userId, id]
    );
    if (existing.length === 0) return null;
    const oldCredentialId = existing[0].credential_id;

    const { rows } = await client.query<RawRow>(
      `UPDATE instagram_connected_accounts
       SET status = 'removed', credential_id = NULL
       WHERE tenant_id = $1 AND user_id = $2 AND id = $3
       RETURNING ${ROW_COLUMNS}`,
      [tenantId, userId, id]
    );
    if (rows.length === 0) return null;
    const res = toAccount(rows[0]);
    res.credentialId = oldCredentialId;
    return res;
  });
}

