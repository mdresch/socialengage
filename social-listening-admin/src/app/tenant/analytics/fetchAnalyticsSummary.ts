/**
 * Story 8.1 (ADR-0054 Decision §3) — the real fetch-and-aggregate loop: pages
 * through every post `GET /v1/posts` returns for the current tenant (no
 * server-side date filter exists, ADR-0054 Context — `SocialPostSummary`
 * rows are paged in full, then filtered client-side by `analyticsData.ts`'s
 * pure `computeAnalyticsSummary()`). Server-only (imports `listPosts()`,
 * which reads the session cookie via next/headers) — called both from
 * page.tsx's initial render and from the `/api/analytics/summary` proxy
 * route that the date-range picker re-fetches from.
 */

import { listPosts } from '@/lib/core-client';
import type { SocialPostSummary, Watchlist } from '@/lib/core-client';
import {
  computeAnalyticsSummary,
  filterPostsByDateRange,
  type AnalyticsSummary,
  type DateRangeFilter,
  type WatchlistCoverageEntry,
} from './analyticsData';

const PAGE_LIMIT = 100;
/**
 * A defensive circuit breaker, not an approximation ceiling — normal tenant
 * volumes finish well under this (50,000 posts at the max page size). Exists
 * only to stop a corrupted/looping cursor chain from hanging a request
 * forever; ADR-0054's own named scale ceiling (Open Question 2) is about
 * round-trip cost, not this safety bound.
 */
const MAX_PAGES = 500;

async function fetchAllPosts(watchlistId?: string): Promise<SocialPostSummary[]> {
  const posts: SocialPostSummary[] = [];
  let cursor: string | undefined;
  let pages = 0;

  do {
    const page = await listPosts(cursor, PAGE_LIMIT, watchlistId);
    posts.push(...page.posts);
    cursor = page.nextCursor ?? undefined;
    pages += 1;
  } while (cursor && pages < MAX_PAGES);

  return posts;
}

export async function fetchAnalyticsSummary(range: DateRangeFilter, watchlistId?: string): Promise<AnalyticsSummary> {
  const posts = await fetchAllPosts(watchlistId);
  return computeAnalyticsSummary(posts, range);
}

export interface AnalyticsComparison {
  current: AnalyticsSummary;
  previous: AnalyticsSummary | null;
}

/**
 * Story 8.4 — fetches the full post set exactly once, then computes two
 * real AnalyticsSummary aggregates from it (current range + an equal-length
 * prior range, when requested). Never a second GET /v1/posts paging loop —
 * doubling the network cost just to support comparison would double exactly
 * the round-trip cost ADR-0054 Open Question 2 already names as a real
 * scale concern. previousRange: null means comparison is genuinely off —
 * `previous` is null, never silently computed anyway.
 *
 * Story 8.9 (ADR-0063) — forwards optional watchlistId filter to fetchAllPosts().
 */
export async function fetchAnalyticsComparison(
  range: DateRangeFilter,
  previousRange: DateRangeFilter | null,
  watchlistId?: string
): Promise<AnalyticsComparison> {
  const posts = await fetchAllPosts(watchlistId);
  return {
    current: computeAnalyticsSummary(posts, range),
    previous: previousRange ? computeAnalyticsSummary(posts, previousRange) : null,
  };
}

/**
 * Story 8.9 (ADR-0063) — fetches real post counts per active watchlist within the given date range.
 * Zero-count active watchlists return an honest 0 count.
 */
export async function fetchWatchlistCoverage(
  range: DateRangeFilter,
  watchlists: Watchlist[]
): Promise<WatchlistCoverageEntry[]> {
  const activeWatchlists = watchlists.filter((w) => w.isActive);
  const coverage = await Promise.all(
    activeWatchlists.map(async (w) => {
      const posts = await fetchAllPosts(w.id);
      const inRange = filterPostsByDateRange(posts, range);
      return {
        id: w.id,
        name: w.name,
        matchType: w.matchType,
        count: inRange.length,
      };
    })
  );
  return coverage;
}
