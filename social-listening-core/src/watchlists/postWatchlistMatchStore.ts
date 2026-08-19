import { withTenant } from '../db/withTenant';

export interface PostWatchlistMatchPair {
  postId: string;
  watchlistId: string;
}

/**
 * Story 3.11 (ADR-0063 Decision §2) — persists the (post, watchlist) match
 * pairs publishSocialPostIngestedEvents() already computes at ingestion
 * time. A single batch INSERT with ON CONFLICT (post_id, watchlist_id) DO
 * NOTHING — idempotent on an ingestion retry, no upsert needed (the row is
 * immutable once written). See
 * .claude/skills/post-watchlist-match-persistence/SKILL.md.
 */
export async function insertPostWatchlistMatches(tenantId: string, pairs: PostWatchlistMatchPair[]): Promise<void> {
  if (pairs.length === 0) return;

  await withTenant(tenantId, async (client) => {
    const params: string[] = [tenantId];
    const valueRows = pairs.map((pair) => {
      params.push(pair.postId, pair.watchlistId);
      const postIdx = params.length - 1;
      const watchlistIdx = params.length;
      return `($${postIdx}, $${watchlistIdx}, $1)`;
    });

    await client.query(
      `INSERT INTO post_watchlist_matches (post_id, watchlist_id, tenant_id)
       VALUES ${valueRows.join(', ')}
       ON CONFLICT (post_id, watchlist_id) DO NOTHING`,
      params
    );
  });
}
