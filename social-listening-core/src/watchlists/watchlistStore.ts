import { withTenant } from '../db/withTenant';

/**
 * Database row shape for the watchlists table — matches
 * migrations/0014_create_watchlists.sql + 0025_watchlists_ownership_and_versioning.sql.
 * See .claude/skills/watchlist-crud/SKILL.md.
 */
export interface WatchlistRow {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  match_type: string;
  terms: string[] | null;
  boolean_query: string | null;
  platform_ids: string[];
  is_active: boolean;
  version: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * REST shape for Watchlist — serialized/deserialized at the router boundary.
 * camelCase fields, ISO 8601 timestamps. `userId` is deliberately not
 * exposed here (ADR-0044 Appendix A's worked examples never surface it) —
 * ownership is enforced, not displayed. See .claude/skills/watchlist-crud/SKILL.md.
 */
export interface Watchlist {
  id: string;
  name: string;
  matchType: string;
  terms: string[] | null;
  booleanQuery?: string;
  platformIds: string[];
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a new watchlist. All fields optional except name and
 * matchType — defaults are applied for omitted fields. The router validates
 * the matchType <-> terms/booleanQuery invariant (ADR-0044 §5a) before
 * calling this — see validateWatchlistShape() below.
 */
export interface CreateWatchlistInput {
  name: string;
  matchType: 'keyword' | 'hashtag' | 'account' | 'boolean';
  terms?: string[] | null;
  booleanQuery?: string | null;
  platformIds?: string[];
  isActive?: boolean;
}

/**
 * A JSON Merge Patch (RFC 7396, ADR-0044 §1) against a watchlist. A key's
 * PRESENCE in this object (not merely a non-undefined value) is what the
 * router uses to distinguish "omitted — leave unchanged" from "present as
 * null — delete." Build this with `'key' in req.body` checks, never with a
 * plain object literal that would coerce an absent key to `undefined` and
 * make it indistinguishable from an explicit `null`.
 */
export interface WatchlistPatchInput {
  name?: string | null;
  matchType?: 'keyword' | 'hashtag' | 'account' | 'boolean' | null;
  terms?: string[] | null;
  booleanQuery?: string | null;
  platformIds?: string[] | null;
  isActive?: boolean | null;
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

export type UpdateWatchlistResult =
  | { outcome: 'updated'; watchlist: Watchlist }
  | { outcome: 'not_found' }
  | { outcome: 'version_conflict'; currentVersion: number }
  | { outcome: 'validation_failed'; details: string[] };

/**
 * ADR-0044 §5a's matchType <-> terms/booleanQuery invariant, shared between
 * create (called by the router before INSERT) and PATCH (called internally
 * by updateWatchlist() below, against the merged resulting state). Returns
 * an empty array when valid. Never mutates its inputs.
 */
export function validateWatchlistShape(
  matchType: string | null | undefined,
  terms: string[] | null | undefined,
  booleanQuery: string | null | undefined
): string[] {
  const details: string[] = [];
  if (matchType === 'boolean') {
    if (!booleanQuery) {
      details.push('booleanQuery is required when matchType is boolean.');
    }
    if (terms != null && terms.length > 0) {
      details.push('terms must be null when matchType is boolean.');
    }
  } else if (matchType === 'keyword' || matchType === 'hashtag' || matchType === 'account') {
    if (!terms || terms.length === 0) {
      details.push('terms is required and must be non-empty for this matchType.');
    }
    if (booleanQuery) {
      details.push('booleanQuery must be null when matchType is not boolean.');
    }
  }
  return details;
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
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * The sanctioned way to create a Watchlist — see
 * .claude/skills/watchlist-crud/SKILL.md. Never write to watchlists
 * directly outside this function. `userId` (ADR-0044 §5c) is always the
 * caller's own resolved identity — never accept one from request input.
 */
export async function createWatchlist(
  tenantId: string,
  userId: string,
  input: CreateWatchlistInput
): Promise<Watchlist> {
  return withTenant(
    tenantId,
    async (client) => {
      const { rows } = await client.query<WatchlistRow>(
        `INSERT INTO watchlists (
          tenant_id, user_id, name, match_type, terms, boolean_query, platform_ids, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          tenantId,
          userId,
          input.name,
          input.matchType,
          input.terms ?? null,
          input.booleanQuery ?? null,
          input.platformIds ?? [],
          input.isActive ?? true,
        ]
      );
      return mapRowToWatchlist(rows[0]);
    },
    undefined,
    userId
  );
}

/**
 * List all watchlists owned by the caller, optionally filtered by
 * matchType. Tenant- and owner-scoped via RLS (withTenant) — a caller can
 * only see their own watchlists, never another tenant's or another user's
 * within the same tenant (ADR-0015, ADR-0044 §5c).
 */
export async function listWatchlists(
  tenantId: string,
  userId: string,
  options: ListWatchlistsOptions = {}
): Promise<WatchlistsPage> {
  return withTenant(
    tenantId,
    async (client) => {
      let query = `SELECT * FROM watchlists`;
      const params: unknown[] = [];

      if (options.matchType) {
        query += ` WHERE match_type = $1`;
        params.push(options.matchType);
      }

      query += ` ORDER BY created_at DESC`;

      const { rows } = await client.query<WatchlistRow>(query, params);
      return {
        watchlists: rows.map(mapRowToWatchlist),
      };
    },
    undefined,
    userId
  );
}

/**
 * Get a single watchlist by id, scoped to the caller's own ownership.
 * Returns null if not found, if it belongs to a different tenant, or if it
 * belongs to a different user in the same tenant (RLS, ADR-0044 §5c) — all
 * three cases are indistinguishable here by design.
 */
export async function getWatchlistById(
  tenantId: string,
  userId: string,
  id: string
): Promise<Watchlist | null> {
  return withTenant(
    tenantId,
    async (client) => {
      const { rows } = await client.query<WatchlistRow>(`SELECT * FROM watchlists WHERE id = $1`, [id]);
      return rows.length > 0 ? mapRowToWatchlist(rows[0]) : null;
    },
    undefined,
    userId
  );
}

/**
 * Update a watchlist by id, scoped to the caller's own ownership, following
 * RFC 7396 JSON Merge Patch semantics (ADR-0044 §1) and version-based
 * optimistic locking (§3). `patch`'s own key presence (not value) drives
 * which columns are touched — see WatchlistPatchInput's own doc comment.
 *
 * The version check and the UPDATE itself run as a single atomic
 * `WHERE id = $ AND version = $` statement — never a separate read-then-
 * write — so a genuinely concurrent PATCH can't slip between a check and a
 * write and get silently lost. On zero rows affected, a follow-up read
 * (still inside the same RLS-scoped transaction) distinguishes "doesn't
 * exist/not owned" (404) from "exists, but the version moved" (409).
 */
export async function updateWatchlist(
  tenantId: string,
  userId: string,
  id: string,
  patch: WatchlistPatchInput,
  expectedVersion: number
): Promise<UpdateWatchlistResult> {
  return withTenant(
    tenantId,
    async (client) => {
      const touchesShape = 'matchType' in patch || 'terms' in patch || 'booleanQuery' in patch;
      if (touchesShape) {
        const { rows: existingRows } = await client.query<WatchlistRow>(`SELECT * FROM watchlists WHERE id = $1`, [
          id,
        ]);
        if (existingRows.length === 0) {
          return { outcome: 'not_found' };
        }
        const existing = existingRows[0];
        const resultingMatchType = 'matchType' in patch ? patch.matchType : existing.match_type;
        const resultingTerms = 'terms' in patch ? patch.terms : existing.terms;
        const resultingBooleanQuery = 'booleanQuery' in patch ? patch.booleanQuery : existing.boolean_query;
        const details = validateWatchlistShape(resultingMatchType, resultingTerms, resultingBooleanQuery);
        if (details.length > 0) {
          return { outcome: 'validation_failed', details };
        }
      }

      const updates: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;
      const setField = (column: string, value: unknown) => {
        updates.push(`${column} = $${paramIndex++}`);
        params.push(value);
      };

      if ('name' in patch) setField('name', patch.name);
      if ('matchType' in patch) setField('match_type', patch.matchType);
      if ('terms' in patch) setField('terms', patch.terms);
      if ('booleanQuery' in patch) setField('boolean_query', patch.booleanQuery);
      if ('platformIds' in patch) setField('platform_ids', patch.platformIds);
      if ('isActive' in patch) setField('is_active', patch.isActive);
      updates.push('version = version + 1');

      params.push(id, expectedVersion);
      const { rows } = await client.query<WatchlistRow>(
        `UPDATE watchlists SET ${updates.join(', ')} WHERE id = $${paramIndex} AND version = $${paramIndex + 1} RETURNING *`,
        params
      );

      if (rows.length > 0) {
        return { outcome: 'updated', watchlist: mapRowToWatchlist(rows[0]) };
      }

      const { rows: currentRows } = await client.query<{ version: number }>(
        `SELECT version FROM watchlists WHERE id = $1`,
        [id]
      );
      if (currentRows.length === 0) {
        return { outcome: 'not_found' };
      }
      return { outcome: 'version_conflict', currentVersion: currentRows[0].version };
    },
    undefined,
    userId
  );
}

/**
 * Delete a watchlist by id, scoped to the caller's own ownership. Returns
 * true if deleted, false if not found, belongs to a different tenant, or
 * belongs to a different user in the same tenant (RLS, ADR-0044 §5c).
 */
export async function deleteWatchlist(tenantId: string, userId: string, id: string): Promise<boolean> {
  return withTenant(
    tenantId,
    async (client) => {
      const result = await client.query(`DELETE FROM watchlists WHERE id = $1`, [id]);
      return (result.rowCount ?? 0) > 0;
    },
    undefined,
    userId
  );
}
