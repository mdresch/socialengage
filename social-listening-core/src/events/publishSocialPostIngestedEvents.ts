import { Watchlist } from '../watchlists/watchlistStore';
import { AstNode, AstNodeType, parseBooleanQuery } from '../watchlists/ast';
import { matchesAst, MatchablePost } from '../watchlists/matcher';
import { insertPostWatchlistMatches } from '../watchlists/postWatchlistMatchStore';
import { publishEvent } from './serviceBusPublisher';
import { buildSocialPostIngestedEvent } from './socialPostIngestedEvent';

/**
 * ADR-0058 Decision §1 — a watchlist's own matcher input, built once per
 * watchlist regardless of matchType. A boolean watchlist parses its stored
 * booleanQuery via the existing parseBooleanQuery() (Story 3.6, ADR-0021),
 * unmodified. A keyword/hashtag/account watchlist has no booleanQuery at
 * all — it's represented here as an OR-chain of the same leaf node type
 * matchesAst() already evaluates for that kind of term (TERM/HASHTAG/
 * ACCOUNT), reusing the one AST matcher uniformly rather than adding a
 * second, parallel WatchlistTerms-based matching path for this one caller.
 * Returns null only defensively (validateWatchlistShape() already prevents
 * an empty-terms/no-booleanQuery watchlist from ever being created).
 */
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

export interface IngestedPostForEventPublishing {
  postId: string;
  text: string;
  authorExternalId?: string;
  sentiment?: string | null;
  publishedAt?: string | null;
  discoveringWatchlistId?: string;
}

/**
 * ADR-0058 Decision §1/§6 — call once per just-inserted post, after
 * insertSocialPost()'s own promise has already resolved (post-commit, per
 * Decision §6's own safeguard — never from inside the insert itself).
 * `watchlists` must already be loaded once per poll batch and filtered to
 * this connector's own platformId by the caller, never reloaded per post
 * (Decision §6's own named N+1 safeguard) — this function does no DB reads
 * of its own. Publishes one SocialPostIngestedEvent per matching watchlist;
 * best-effort, never throws (ADR-0038's "never blocks ingestion" precedent)
 * — a Service Bus failure here must not fail or roll back real ingestion.
 *
 * 2026-08-17 — deliberately always uses the fallback evaluator (matchesAst),
 * never resolveWatchlistAstDispatch()'s 'native' shortcut, unlike ADR-0058
 * Decision §1's own original text. Found live by this story's own AC3
 * contract: GNews already declares real native supportedQueryFeatures
 * (AND/OR/NOT/TERM, Story 2.7), so dispatch would resolve 'native' for any
 * TERM-based watchlist — but 'native' mode's contract assumes the
 * connector's own outbound fetch was actually parameterized by *that
 * specific watchlist's* translated query, which none of the three real
 * connectors do (each polls one fixed query/feed set, unrelated to any
 * individual watchlist). Trusting 'native' here would match every TERM
 * watchlist unconditionally, regardless of real post content — dispatch
 * is reserved for the "was this post actually pre-filtered by the platform
 * for this query" case, which doesn't exist in this pipeline yet. See
 * ADR-0058's own Amendment Log for the dated correction.
 */
export async function publishSocialPostIngestedEvents(
  tenantId: string,
  platformId: string,
  watchlists: Watchlist[],
  post: IngestedPostForEventPublishing
): Promise<void> {
  if (watchlists.length === 0) return;

  const matchablePost: MatchablePost = {
    id: post.postId,
    text: post.text,
    authorExternalId: post.authorExternalId,
  };

  const matchedWatchlistIds: string[] = [];

  for (const watchlist of watchlists) {
    const isDiscoveringWatchlist = Boolean(
      post.discoveringWatchlistId && watchlist.id === post.discoveringWatchlistId
    );
    const ast = watchlistToAst(watchlist);
    const matched = isDiscoveringWatchlist || (ast ? matchesAst(ast, matchablePost) : false);
    if (!matched) continue;

    matchedWatchlistIds.push(watchlist.id);

    const event = buildSocialPostIngestedEvent({
      tenantId,
      postId: post.postId,
      platformId,
      watchlistId: watchlist.id,
      sentiment: post.sentiment ?? null,
      publishedAt: post.publishedAt ?? null,
    });

    try {
      await publishEvent(tenantId, event);
    } catch (err) {
      // ADR-0058 Decision §4 — best-effort, matching enrichPost()'s own
      // never-throws precedent (ADR-0038). Real ingestion must never fail
      // or roll back because Service Bus was briefly unreachable.
      console.error(
        `[ingestion-events] Failed to publish SocialPostIngestedEvent (tenant=${tenantId} post=${post.postId} watchlist=${watchlist.id}):`,
        err
      );
    }
  }

  if (matchedWatchlistIds.length === 0) return;

  // Story 3.11 (ADR-0063 Decision §2) — persists the same matched-watchlist
  // set just computed above for event publishing, so GET /v1/posts?
  // watchlistId=<id> can filter server-side. Best-effort, same precedent as
  // publishEvent()'s own catch above: a store-layer failure must never fail
  // or roll back real ingestion. See
  // .claude/skills/post-watchlist-match-persistence/SKILL.md.
  try {
    await insertPostWatchlistMatches(
      tenantId,
      matchedWatchlistIds.map((watchlistId) => ({ postId: post.postId, watchlistId }))
    );
  } catch (err) {
    console.error(
      `[ingestion-events] Failed to persist post_watchlist_matches (tenant=${tenantId} post=${post.postId}):`,
      err
    );
  }
}
