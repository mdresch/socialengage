import { withTenant } from '../db/withTenant';

/**
 * Database row shape for the watchlists table — matches migrations/0014_create_watchlists.sql.
 * See .claude/skills/watchlist-crud/SKILL.md.
 */
export interface WatchlistRow {
  id: string;
  tenant_id: string;
  name: string;
  match_type: string;
  terms: string[];
  boolean_query: string | null;
  platform_ids: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * REST shape for Watchlist — serialized/deserialized at the router boundary.
 * camelCase fields, ISO 8601 timestamps. See .claude/skills/watchlist-crud/SKILL.md.
 */
export interface Watchlist {
  id: string;
  name: string;
  matchType: string;
  terms: string[];
  booleanQuery?: string;
  platformIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a new watchlist. All fields optional except name and matchType
 * — defaults are applied for omitted fields.
 */
export interface CreateWatchlistInput {
  name: string;
  matchType: 'keyword' | 'hashtag' | 'account' | 'boolean';
  terms?: string[];
  booleanQuery?: string;
  platformIds?: string[];
  isActive?: boolean;
}

/**
 * Input for updating an existing watchlist. All fields optional — only provided
 * fields are updated (PATCH semantics).
 */
export interface UpdateWatchlistInput {
  name?: string;
  matchType?: 'keyword' | 'hashtag' | 'account' | 'boolean';
  terms?: string[];
  booleanQuery?: string;
  platformIds?: string[];
  isActive?: boolean;
}

/**
 * Options for listing watchlists — currently only supports matchType filtering.
 */
export interface ListWatchlistsOptions {
  matchType?: string;
}

/**
 * Result of listing watchlists.
 */
export interface WatchlistsPage {
  watchlists: Watchlist[];
}

/**
 * Map a database row to the REST shape. Converts snake_case to camelCase
 * and Date objects to ISO 8601 strings.
 */
function mapRowToWatchlist(row: WatchlistRow): Watchlist {
  return {
    id: row.id,
    name: row.name,
    matchType: row.match_type,
    terms: row.terms,
    booleanQuery: row.boolean_query ?? undefined,
    platformIds: row.platform_ids,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * The sanctioned way to create a Watchlist — see
 * .claude/skills/watchlist-crud/SKILL.md. Never write to watchlists
 * directly outside this function.
 */
export async function createWatchlist(
  tenantId: string,
  input: CreateWatchlistInput
): Promise<Watchlist> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<WatchlistRow>(
      `INSERT INTO watchlists (
        tenant_id, name, match_type, terms, boolean_query, platform_ids, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        tenantId,
        input.name,
        input.matchType,
        input.terms ?? [],
        input.booleanQuery ?? null,
        input.platformIds ?? [],
        input.isActive ?? true,
      ]
    );
    return mapRowToWatchlist(rows[0]);
  });
}

/**
 * List all watchlists for a tenant, optionally filtered by matchType.
 * Results are tenant-scoped via RLS (withTenant) — a tenant can only see
 * their own watchlists, never another tenant's (ADR-0015).
 */
export async function listWatchlists(
  tenantId: string,
  options: ListWatchlistsOptions = {}
): Promise<WatchlistsPage> {
  return withTenant(tenantId, async (client) => {
    let query = `SELECT * FROM watchlists`;
    const params: unknown[] = [];
    let paramIndex = 1;

    // Apply matchType filter if provided
    if (options.matchType) {
      query += ` WHERE match_type = $1`;
      params.push(options.matchType);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const { rows } = await client.query<WatchlistRow>(query, params);
    return {
      watchlists: rows.map(mapRowToWatchlist),
    };
  });
}

/**
 * Get a single watchlist by id for a tenant. Returns null if not found
 * or if the watchlist belongs to a different tenant (RLS).
 */
export async function getWatchlistById(
  tenantId: string,
  id: string
): Promise<Watchlist | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<WatchlistRow>(
      `SELECT * FROM watchlists WHERE id = $1`,
      [id]
    );
    return rows.length > 0 ? mapRowToWatchlist(rows[0]) : null;
  });
}

/**
 * Update a watchlist by id for a tenant. Only updates fields that are
 * provided in the input (PATCH semantics). Returns null if the watchlist
 * doesn't exist or belongs to a different tenant (RLS).
 */
export async function updateWatchlist(
  tenantId: string,
  id: string,
  input: UpdateWatchlistInput
): Promise<Watchlist | null> {
  return withTenant(tenantId, async (client) => {
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Build dynamic UPDATE statement based on provided fields
    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(input.name);
    }
    if (input.matchType !== undefined) {
      updates.push(`match_type = $${paramIndex++}`);
      params.push(input.matchType);
    }
    if (input.terms !== undefined) {
      updates.push(`terms = $${paramIndex++}`);
      params.push(input.terms);
    }
    if (input.booleanQuery !== undefined) {
      updates.push(`boolean_query = $${paramIndex++}`);
      params.push(input.booleanQuery);
    }
    if (input.platformIds !== undefined) {
      updates.push(`platform_ids = $${paramIndex++}`);
      params.push(input.platformIds);
    }
    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(input.isActive);
    }

    // Also update updated_at timestamp
    updates.push(`updated_at = now()`);

    if (updates.length === 0) {
      // No fields to update — this shouldn't happen with proper PATCH handling,
      // but guard against it to avoid invalid SQL.
      return null;
    }

    // Add id to params for WHERE clause
    params.push(id);

    const { rows } = await client.query<WatchlistRow>(
      `UPDATE watchlists SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return rows.length > 0 ? mapRowToWatchlist(rows[0]) : null;
  });
}

/**
 * Delete a watchlist by id for a tenant. Returns true if deleted,
 * false if not found or belongs to a different tenant (RLS).
 */
export async function deleteWatchlist(
  tenantId: string,
  id: string
): Promise<boolean> {
  return withTenant(tenantId, async (client) => {
    const result = await client.query(
      `DELETE FROM watchlists WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  });
}
