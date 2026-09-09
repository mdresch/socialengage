import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { AdHocQueryBuilder } from '@/components/analytics/AdHocQueryBuilder';

/**
 * Story 10.5 (ADR-0088) — Ad-Hoc Analytics Query Builder Page.
 */
export default async function AdHocAnalyticsPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  return (
    <main>
      <AdHocQueryBuilder />
    </main>
  );
}
