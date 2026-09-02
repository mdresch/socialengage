import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getProspectingList, listProspectingEntries, getMyPlan } from '@/lib/core-client';
import { ProspectingListDetailView } from '../ProspectingListDetailView';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Story 10.2 (ADR-0086) / Story 13.14 (ADR-0117) — Prospecting list detail page
 * with inline editing, bounded CSV export, and CRM push. The page loads the
 * caller's plan so the view can respect the `exports` and `prospecting_crm`
 * feature gates.
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

  const [listResult, entriesResult, planResult] = await Promise.allSettled([
    getProspectingList(listId),
    listProspectingEntries(listId, { limit: 200 }),
    getMyPlan(),
  ]);

  if (listResult.status === 'rejected') {
    notFound();
  }

  const list = listResult.value;
  const entries = entriesResult.status === 'fulfilled' ? entriesResult.value.entries : [];
  const featureGates =
    planResult.status === 'fulfilled' ? planResult.value.featureGates : ({} as Record<string, any>);

  return (
    <main>
      <ProspectingListDetailView
        listId={listId}
        userId={userId}
        initialList={list}
        initialEntries={entries}
        featureGates={featureGates}
      />
    </main>
  );
}
