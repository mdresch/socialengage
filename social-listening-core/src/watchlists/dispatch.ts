import { SocialConnector } from '../connectors/types';
import { MatchablePost, matchesWatchlist } from './matcher';
import { WatchlistTerms } from './types';

export interface WatchlistDispatchResult {
  mode: 'native' | 'fallback';
  nativeQueryParams?: Record<string, string>;
}

/**
 * Decides native connector-side filtering vs. post-fetch fallback for a given
 * connector + Watchlist (ADR-0006). See
 * .claude/skills/watchlist-matching/SKILL.md.
 */
export function resolveWatchlistDispatch(
  connector: SocialConnector,
  terms: WatchlistTerms
): WatchlistDispatchResult {
  const translation = connector.translateWatchlistQuery?.(terms);
  if (translation?.supported) {
    return { mode: 'native', nativeQueryParams: translation.queryParams };
  }
  return { mode: 'fallback' };
}

/**
 * In native mode, the platform already applied the translated filter
 * server-side — every post handed in is presumed to already match, nothing
 * left to do. In fallback mode, the core evaluates every post itself.
 */
export function matchPostsForWatchlist(
  dispatch: WatchlistDispatchResult,
  terms: WatchlistTerms,
  posts: MatchablePost[]
): MatchablePost[] {
  if (dispatch.mode === 'native') {
    return posts;
  }
  return posts.filter((post) => matchesWatchlist(terms, post));
}
