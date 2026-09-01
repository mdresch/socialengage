import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getProspectingList, listProspectingEntries } from '@/lib/core-client';
import { ProspectingListDetailView } from '../ProspectingListDetailView';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Story 10.2 (ADR-0086) — Prospecting list detail page with inline editing of entries.
 */
export default async function ProspectingListDetailPage({ params }: PageProps) {
  const { id: listId } = await params;

  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const userId = identity?.type === 'tenant_user' ? identity.userId : '';

  const [listResult, entriesResult] = await Promise.allSettled([
    getProspectingList(listId),
    listProspectingEntries(listId, { limit: 200 }),
  ]);

  if (listResult.status === 'rejected') {
    notFound();
  }

  const list = listResult.value;
  const entries = entriesResult.status === 'fulfilled' ? entriesResult.value.entries : [];

  return (
    <main>
      <ProspectingListDetailView
        listId={listId}
        userId={userId}
        initialList={list}
        initialEntries={entries}
      />
    </main>
  );
}
