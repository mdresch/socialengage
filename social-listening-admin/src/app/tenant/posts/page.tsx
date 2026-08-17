import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { listPosts, listWatchlists } from '@/lib/core-client';
import type { SocialPostSummary } from '@/lib/core-client';
import { PostsFeedClient } from './PostsFeedClient';

const PAGE_LIMIT = 100;
/**
 * A defensive circuit breaker, not an approximation ceiling — the same
 * MAX_PAGES precedent fetchAnalyticsSummary.ts (Story 8.1) already
 * established, reused here rather than re-derived (Story 6.18).
 */
const MAX_PAGES = 500;

async function fetchAllPosts(): Promise<SocialPostSummary[]> {
  const posts: SocialPostSummary[] = [];
  let cursor: string | undefined;
  let pages = 0;

  do {
    const page = await listPosts(cursor, PAGE_LIMIT);
    posts.push(...page.posts);
    cursor = page.nextCursor ?? undefined;
    pages += 1;
  } while (cursor && pages < MAX_PAGES);

  return posts;
}

/**
 * Story 6.11 — Post Feed page. Story 6.18: fetches the tenant's entire real
 * post set upfront (the same paginated-loop shape Story 8.1's
 * fetchAnalyticsSummary.ts already established) rather than a single
 * default-sized page, so PostsFeedClient's search/filter can operate over
 * everything, not just the first 20 — this route no longer takes a URL
 * query prop of any kind, and there's no more server-round-trip "next page"
 * link (PostsFeedClient's own client-side "Show more" control takes over
 * from here).
 */
export default async function PostFeedPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  // Fetch posts and watchlists in parallel; watchlists failing is non-fatal.
  const [posts, watchlists] = await Promise.all([
    fetchAllPosts(),
    listWatchlists().catch(() => []),
  ]);

  return (
    <main>
      <PostsFeedClient posts={posts} watchlists={watchlists} />
    </main>
  );
}
