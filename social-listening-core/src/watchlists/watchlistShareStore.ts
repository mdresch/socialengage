/**
 * Watchlist Sharing Store — Story 12.13 (ADR-0107).
 * Manages per-watchlist sharing with 'read' and 'edit' permissions.
 */

import { withTenant } from '../db/withTenant';
import { getPool } from '../db/pool';
import { PoolClient } from 'pg';

export interface WatchlistShare {
  id: string;
  tenant_id: string;
  watchlist_id: string;
  shared_with_user_id: string;
  permission: 'read' | 'edit';
  shared_by_user_id: string;
  shared_at: string;
  created_at: string;
  updated_at: string;
}

export interface ShareWatchlistInput {
  watchlistId: string;
  sharedWithUserId: string;
  permission?: 'read' | 'edit';
}

export async function shareWatchlist(
  tenantId: string,
  sharedByUserId: string,
  input: ShareWatchlistInput
): Promise<WatchlistShare> {
  return withTenant<WatchlistShare>(
    tenantId,
    async (client: PoolClient) => {
      const permission = input.permission || 'read';
      const { rows } = await client.query(
        `INSERT INTO watchlist_shares (
           tenant_id, watchlist_id, shared_with_user_id, permission, shared_by_user_id, shared_at, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, now(), now(), now())
         ON CONFLICT (watchlist_id, shared_with_user_id)
         DO UPDATE SET permission = $4, updated_at = now()
         RETURNING *`,
        [tenantId, input.watchlistId, input.sharedWithUserId, permission, sharedByUserId]
      );
      return rows[0] as WatchlistShare;
    },
    getPool(),
    sharedByUserId
  );
}

export async function listWatchlistShares(
  tenantId: string,
  watchlistId: string,
  userId?: string
): Promise<WatchlistShare[]> {
  return withTenant<WatchlistShare[]>(
    tenantId,
    async (client: PoolClient) => {
      const { rows } = await client.query(
        `SELECT * FROM watchlist_shares WHERE tenant_id = $1 AND watchlist_id = $2 ORDER BY created_at ASC`,
        [tenantId, watchlistId]
      );
      return rows as WatchlistShare[];
    },
    getPool(),
    userId
  );
}

export async function removeWatchlistShare(
  tenantId: string,
  watchlistId: string,
  sharedWithUserId: string,
  userId?: string
): Promise<boolean> {
  return withTenant<boolean>(
    tenantId,
    async (client: PoolClient) => {
      const { rowCount } = await client.query(
        `DELETE FROM watchlist_shares WHERE tenant_id = $1 AND watchlist_id = $2 AND shared_with_user_id = $3`,
        [tenantId, watchlistId, sharedWithUserId]
      );
      return (rowCount ?? 0) > 0;
    },
    getPool(),
    userId
  );
}

export async function getSharedWatchlistsForUser(
  tenantId: string,
  userId: string
): Promise<Array<WatchlistShare & { watchlist_name?: string }>> {
  return withTenant(
    tenantId,
    async (client: PoolClient) => {
      const { rows } = await client.query(
        `SELECT ws.*, w.name as watchlist_name
         FROM watchlist_shares ws
         LEFT JOIN watchlists w ON w.id = ws.watchlist_id
         WHERE ws.tenant_id = $1 AND ws.shared_with_user_id = $2
         ORDER BY ws.created_at DESC`,
        [tenantId, userId]
      );
      return rows;
    },
    getPool(),
    userId
  );
}
