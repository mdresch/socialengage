import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getPlatformDashboard } from '@/lib/core-client';
import { PlatformOperationsDashboard } from '@/components/operations/PlatformOperationsDashboard';

/**
 * Story 10.7 (ADR-0089) — Platform Operations Telemetry Page.
 */
export default async function PlatformOperationsPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'platform-admin')) {
    redirect('/');
  }

  const initialData = await getPlatformDashboard().catch(() => null);

  return (
    <main>
      <PlatformOperationsDashboard initialData={initialData} />
    </main>
  );
}
