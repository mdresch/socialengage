import { WatchlistTerms } from './types';

export interface MatchablePost {
  id: string;
  text: string;
  authorExternalId?: string;
}

/**
 * The post-fetch fallback matcher (ADR-0006) — evaluated against every
 * fetched post for a platform with no native filtering support. A post
 * matches if any keyword/hashtag/account term matches (OR semantics; see
 * types.ts for why this isn't full boolean-query evaluation yet).
 */
export function matchesWatchlist(terms: WatchlistTerms, post: MatchablePost): boolean {
  const text = post.text.toLowerCase();

  const keywordMatch = (terms.keywords ?? []).some((keyword) => text.includes(keyword.toLowerCase()));
  const hashtagMatch = (terms.hashtags ?? []).some((hashtag) =>
    text.includes(`#${hashtag.toLowerCase().replace(/^#/, '')}`)
  );
  const accountMatch = (terms.accounts ?? []).some((account) => post.authorExternalId === account);

  return keywordMatch || hashtagMatch || accountMatch;
}
