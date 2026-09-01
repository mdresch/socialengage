import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { listProspectingLists } from '@/lib/core-client';
import { ProspectingListsView } from './ProspectingListsView';

/**
 * Story 10.2 (ADR-0086) — Prospecting Lists index page.
 * Server component that fetches the initial list and delegates interactivity to the client.
 */
export default async function ProspectingListsPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const userId = identity?.type === 'tenant_user' ? identity.userId : '';

  const initialData = await listProspectingLists().catch(() => ({ lists: [] }));

  return (
    <main>
      <ProspectingListsView userId={userId} initialLists={initialData.lists} />
    </main>
  );
}
