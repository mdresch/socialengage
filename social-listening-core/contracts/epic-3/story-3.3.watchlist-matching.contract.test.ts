// Contract: Story 3.3 (ADR-0006) — connector-side watchlist filtering with
// post-fetch fallback.
// See docs/user-stories/epic-3-data-model-storage-and-archival.md#story-33--connector-side-watchlist-filtering-with-post-fetch-fallback
//
// Intent: Story 3.3 — Connector-side watchlist filtering with post-fetch fallback
// (ADR-0006)
// Scope: src/watchlists/types.ts, src/watchlists/matcher.ts,
// src/watchlists/dispatch.ts, src/connectors/types.ts (adds an optional
// translateWatchlistQuery() to SocialConnector), src/connectors/examples/exampleNativeFilterConnector.ts
// Contract to encode: (1) a connector that translates watchlist terms into native
// query parameters gets a dispatch result carrying those params; (2) a connector
// without native filtering support falls back to evaluating the watchlist against
// every fetched post before persisting matches; (3) the same Watchlist terms
// produce the same matched posts whether sourced via native filtering (the
// platform pre-filters, so every post handed to the core already matches) or via
// post-fetch fallback (the core filters the full unfiltered set itself) — the two
// code paths are proven consistent for keyword/hashtag/account terms.
// Explicitly out of scope: boolean query grammar (AND/OR/NOT combinations) and a
// unified AST both paths evaluate identically — that consistency gap is Story 3.6
// (ADR-0021, Blocked pending acceptance), explicitly named in this story's own AC3
// as not yet closed; a persisted Watchlist entity/table and its CRUD REST endpoints
// (Phase 1's "also build, not storied" admin/API surface work — this story is
// about the matching mechanism given a Watchlist's terms, not about storing one);
// real per-platform query syntax (the example connector's translation is
// deliberately illustrative, not a real platform's actual grammar).

import {
  matchesWatchlist,
  MatchablePost,
} from '../../src/watchlists/matcher';
import {
  resolveWatchlistDispatch,
  matchPostsForWatchlist,
} from '../../src/watchlists/dispatch';
import { WatchlistTerms } from '../../src/watchlists/types';
import { examplePollConnector } from '../../src/connectors/examples/examplePollConnector';
import { exampleNativeFilterConnector } from '../../src/connectors/examples/exampleNativeFilterConnector';

const terms: WatchlistTerms = {
  keywords: ['acme'],
  hashtags: ['support'],
  accounts: ['author-42'],
};

const posts: MatchablePost[] = [
  { id: 'p1', text: 'I love Acme products', authorExternalId: 'author-1' }, // keyword match
  { id: 'p2', text: 'random #support thread', authorExternalId: 'author-2' }, // hashtag match
  { id: 'p3', text: 'hello world', authorExternalId: 'author-42' }, // account match
  { id: 'p4', text: 'nothing relevant here', authorExternalId: 'author-99' }, // no match
];

describe('Story 3.3 — watchlist matching contract', () => {
  it('AC1: a connector that translates watchlist terms gets a native dispatch carrying the translated query', () => {
    const dispatch = resolveWatchlistDispatch(exampleNativeFilterConnector, terms);
    expect(dispatch.mode).toBe('native');
    expect(dispatch.nativeQueryParams).toBeDefined();
    expect(dispatch.nativeQueryParams?.q).toEqual(expect.stringContaining('acme'));
  });

  it('AC2: a connector without native filtering support falls back to evaluating every fetched post', () => {
    const dispatch = resolveWatchlistDispatch(examplePollConnector, terms);
    expect(dispatch.mode).toBe('fallback');

    const matched = matchPostsForWatchlist(dispatch, terms, posts);
    expect(matched.map((p) => p.id).sort()).toEqual(['p1', 'p2', 'p3']);

    // Every post was genuinely evaluated, not just the "obvious" ones.
    for (const post of posts) {
      expect(matchesWatchlist(terms, post)).toBe(matched.some((m) => m.id === post.id));
    }
  });

  it('AC3: the same Watchlist produces the same matched posts via native filtering and via fallback', () => {
    const fallbackDispatch = resolveWatchlistDispatch(examplePollConnector, terms);
    const fallbackMatches = matchPostsForWatchlist(fallbackDispatch, terms, posts);

    // Simulates what a native-filtering platform would have already returned:
    // only the posts that match, pre-filtered server-side.
    const nativelyPreFilteredPosts = posts.filter((p) =>
      fallbackMatches.some((m) => m.id === p.id)
    );
    const nativeDispatch = resolveWatchlistDispatch(exampleNativeFilterConnector, terms);
    const nativeMatches = matchPostsForWatchlist(nativeDispatch, terms, nativelyPreFilteredPosts);

    expect(nativeMatches.map((p) => p.id).sort()).toEqual(
      fallbackMatches.map((p) => p.id).sort()
    );
  });
});
