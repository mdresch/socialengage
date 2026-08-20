import { withTenant } from '../db/withTenant';
import { getPool } from '../db/pool';
import { listActiveWatchlistsForTenant, Watchlist } from './watchlistStore';
import { AstNode, AstNodeType, parseBooleanQuery } from './ast';
import { matchesAst, MatchablePost } from './matcher';

export interface PostWatchlistMatchPair {
  postId: string;
  watchlistId: string;
}

function watchlistToAst(watchlist: Watchlist): AstNode | null {
  if (watchlist.matchType === 'boolean') {
    return watchlist.booleanQuery ? parseBooleanQuery(watchlist.booleanQuery) : null;
  }
  const terms = watchlist.terms ?? [];
  if (terms.length === 0) return null;
  const nodeType: AstNodeType =
    watchlist.matchType === 'hashtag' ? 'HASHTAG' : watchlist.matchType === 'account' ? 'ACCOUNT' : 'TERM';
  const leaves: AstNode[] = terms.map((value) => ({ type: nodeType, value }) as AstNode);
  return leaves.reduce((left, right) => ({ type: 'OR', left, right }));
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

/**
 * Story 3.12 (ADR-0063 2026-08-20 Amendment Log) — Retroactively backfills
 * match pairs for historical posts ingested before Story 3.11 or unlinked.
 * Scans social_posts, evaluates each against active tenant watchlists using
 * matchesAst(), and writes post_watchlist_matches idempotently.
 */
export async function backfillPostWatchlistMatches(tenantId?: string): Promise<number> {
  const tenants: string[] = tenantId
    ? [tenantId]
    : (await getPool().query<{ tenant_id: string }>('SELECT DISTINCT tenant_id FROM social_posts')).rows.map((r) => r.tenant_id);

  let totalMatched = 0;

  for (const tid of tenants) {
    const watchlists = await listActiveWatchlistsForTenant(tid);
    if (watchlists.length === 0) continue;

    const posts = await withTenant(tid, async (client) => {
      const { rows } = await client.query<{
        id: string;
        raw_payload: any;
        body_markdown: string | null;
        author_external_id: string | null;
      }>(
        `SELECT sp.id, sp.raw_payload, sp.body_markdown, a.external_author_id as author_external_id
         FROM social_posts sp
         LEFT JOIN authors a ON a.id = sp.author_id
         WHERE sp.tenant_id = $1`,
        [tid]
      );
      return rows;
    });

    const pairs: PostWatchlistMatchPair[] = [];

    for (const post of posts) {
      const raw = (post.raw_payload && typeof post.raw_payload === 'object') ? post.raw_payload : {};
      const title = typeof raw.title === 'string' ? raw.title : '';
      const description = typeof raw.description === 'string' ? raw.description : '';
      const message = typeof raw.message === 'string' ? raw.message : '';
      const story = typeof raw.story === 'string' ? raw.story : '';
      const textProp = typeof raw.text === 'string' ? raw.text : '';
      const bodyMarkdown = post.body_markdown ?? '';

      const text = [title, description, message, story, textProp, bodyMarkdown].filter(Boolean).join('. ');
      const authorExternalId = post.author_external_id ?? raw.authorExternalId ?? raw.author_id;

      const matchablePost: MatchablePost = {
        id: post.id,
        text,
        authorExternalId,
      };

      const discoveringWatchlistId = raw.discoveringWatchlistId;

      for (const watchlist of watchlists) {
        const isDiscoveringWatchlist = Boolean(
          discoveringWatchlistId && watchlist.id === discoveringWatchlistId
        );
        const ast = watchlistToAst(watchlist);
        const matched = isDiscoveringWatchlist || (ast ? matchesAst(ast, matchablePost) : false);
        if (matched) {
          pairs.push({ postId: post.id, watchlistId: watchlist.id });
        }
      }
    }

    if (pairs.length > 0) {
      await insertPostWatchlistMatches(tid, pairs);
      totalMatched += pairs.length;
    }
  }

  return totalMatched;
}

