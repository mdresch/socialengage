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
import type { SocialPostSummary } from '@/lib/core-client';
import { computeAnalyticsSummary, type AnalyticsSummary, type DateRangeFilter } from './analyticsData';

const PAGE_LIMIT = 100;
/**
 * A defensive circuit breaker, not an approximation ceiling — normal tenant
 * volumes finish well under this (50,000 posts at the max page size). Exists
 * only to stop a corrupted/looping cursor chain from hanging a request
 * forever; ADR-0054's own named scale ceiling (Open Question 2) is about
 * round-trip cost, not this safety bound.
 */
const MAX_PAGES = 500;

export async function fetchAnalyticsSummary(range: DateRangeFilter): Promise<AnalyticsSummary> {
  const posts: SocialPostSummary[] = [];
  let cursor: string | undefined;
  let pages = 0;

  do {
    const page = await listPosts(cursor, PAGE_LIMIT);
    posts.push(...page.posts);
    cursor = page.nextCursor ?? undefined;
    pages += 1;
  } while (cursor && pages < MAX_PAGES);

  return computeAnalyticsSummary(posts, range);
}
