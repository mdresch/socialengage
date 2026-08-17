import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getPost } from '@/lib/core-client';
import { extractDisplayText, extractProviderBadge, extractEnrichmentSummary } from '../postDisplay';
import { RunEnrichmentButton } from '../RunEnrichmentButton';

/**
 * Story 6.11 — the REST-fetch-on-demand half of ADR-0012 (Story 5.1), given
 * its first frontend surface. A 404 (unknown id, or another tenant's — RLS
 * makes the two indistinguishable) renders a real "not found" state, not a
 * crash. authorId/acquisitionId are shown as-is — no REST endpoint exists
 * yet to resolve either into a friendlier name (see this component's own
 * SKILL.md "How to extend this safely").
 */
export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const { id } = await params;
  const post = await getPost(id);

  if (!post) {
    return (
      <main>
        <h1>Post not found</h1>
        <p>This post does not exist, or you do not have access to it.</p>
      </main>
    );
  }

  const { title, snippet } = extractDisplayText(post.rawPayload);
  const provider = extractProviderBadge(post.rawPayload);
  const enrichmentSummary = post.enrichment ? extractEnrichmentSummary(post.enrichment) : null;

  return (
    <main>
      <h1>{title}</h1>
      <p>Provider: {provider}</p>
      {post.bodyMarkdown ? <ReactMarkdown>{post.bodyMarkdown}</ReactMarkdown> : snippet && <p>{snippet}</p>}
      <time>{post.publishedAt ?? 'unknown'}</time>
      <dl>
        <dt>Author</dt>
        <dd>{post.authorId ?? 'No author recorded'}</dd>
        <dt>Ingestion run</dt>
        <dd>{post.acquisitionId}</dd>
      </dl>
      {enrichmentSummary && (
        <div>
          <h2>Enrichment</h2>
          {enrichmentSummary.sentiment && <p>Sentiment: {enrichmentSummary.sentiment}</p>}
          {enrichmentSummary.keyPhrases.length > 0 && <p>Key phrases: {enrichmentSummary.keyPhrases.join(', ')}</p>}
          {enrichmentSummary.entities.length > 0 && <p>Entities: {enrichmentSummary.entities.join(', ')}</p>}
          {enrichmentSummary.modelUsed && <p>Enriched by: {enrichmentSummary.modelUsed}</p>}
          {enrichmentSummary.language && <p>Language: {enrichmentSummary.language}</p>}
        </div>
      )}
      {!post.enrichment && <RunEnrichmentButton postId={post.id} />}
    </main>
  );
}
