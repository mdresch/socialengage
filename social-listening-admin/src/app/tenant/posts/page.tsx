import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { listPosts } from '@/lib/core-client';
import { extractDisplayText, extractProviderBadge, extractEnrichmentSummary } from './postDisplay';

/**
 * Story 6.11 — the first frontend surface for GET /v1/posts anywhere in
 * this project. Pagination is the real, opaque nextCursor via a "next
 * page" link (?cursor=<exact value>, next/navigation's own searchParams
 * handling) — never a page-number control, never a client-constructed
 * cursor. See this component's own SKILL.md.
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
  const page = await listPosts(cursor);

  return (
    <main>
      <h1>Posts</h1>
      <ul>
        {page.posts.map((post) => {
          const { title, snippet } = extractDisplayText(post.rawPayload);
          const provider = extractProviderBadge(post.rawPayload);
          const enrichmentSummary = post.enrichment ? extractEnrichmentSummary(post.enrichment) : null;

          return (
            <li key={post.id}>
              <span>{provider}</span>{' '}
              <a href={`/tenant/posts/${post.id}`}>{title}</a>
              {snippet && <p>{snippet}</p>}
              <time>{post.publishedAt ?? 'unknown'}</time>
              {enrichmentSummary && (
                <div>
                  {enrichmentSummary.sentiment && <p>Sentiment: {enrichmentSummary.sentiment}</p>}
                  {enrichmentSummary.keyPhrases.length > 0 && (
                    <p>Key phrases: {enrichmentSummary.keyPhrases.join(', ')}</p>
                  )}
                  {enrichmentSummary.entities.length > 0 && <p>Entities: {enrichmentSummary.entities.join(', ')}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {page.nextCursor && <a href={`/tenant/posts?cursor=${encodeURIComponent(page.nextCursor)}`}>Next page</a>}
    </main>
  );
}
