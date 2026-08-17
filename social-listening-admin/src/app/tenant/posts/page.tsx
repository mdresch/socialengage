import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { listPosts, listWatchlists } from '@/lib/core-client';
import { PostsFeedClient } from './PostsFeedClient';

/**
 * Story 6.11 — Post Feed page (upgraded design, Story 6.11+).
 * Pagination uses real opaque nextCursor via ?cursor= param (ADR-0011).
 * Interactive filter/search/slideover is delegated to PostsFeedClient.
 */
export default async function PostFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const { cursor } = await searchParams;

  // Fetch posts and watchlists in parallel; watchlists failing is non-fatal.
  const [page, watchlists] = await Promise.all([
    listPosts(cursor),
    listWatchlists().catch(() => []),
  ]);

  return (
    <main>
      <PostsFeedClient
        posts={page.posts}
        nextCursor={page.nextCursor}
        watchlists={watchlists}
      />
    </main>
  );
}
