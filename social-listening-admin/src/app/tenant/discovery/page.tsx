import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { listWatchlists, getRAGStatus } from '@/lib/core-client';
import { RAGDiscoveryClient } from './RAGDiscoveryClient';

/**
 * Story 9.11 (ADR-0085) — RAG Semantic Search & Generative Q&A Discovery Page.
 */
export default async function RAGDiscoveryPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const [watchlists, status] = await Promise.all([
    listWatchlists().catch(() => []),
    getRAGStatus().catch(() => ({
      status: 'degraded' as const,
      totalIndexedChunks: 0,
      syncStatus: { synced: 0, pending: 0, failed: 0 },
      lagMinutes: 0,
    })),
  ]);

  return (
    <main className="page-content">
      <RAGDiscoveryClient watchlists={watchlists} initialStatus={status} />
    </main>
  );
}
