import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { TenantDeletionPanel } from './TenantDeletionPanel';

/**
 * Story 6.13 (ADR-0043) — self-service tenant deletion/offboarding. Gated
 * on the 'tenant' shell (Story 6.2) AND tenant_admin specifically — unlike
 * Story 6.9's own settings screen, a tenant_user session must never reach
 * this screen at all (AC1's own "never see an entry point"), so the
 * redirect below checks role directly rather than only hiding a link on
 * the settings page.
 */
export default async function TenantDeletionPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const isTenantAdmin = identity?.type === 'tenant_user' && identity.role === 'tenant_admin';
  if (!isTenantAdmin) {
    redirect('/tenant/settings');
  }

  return (
    <main>
      <h1>Delete this tenant</h1>
      <p>
        Request permanent deletion of this tenant. You will have a 30-day grace period to export your data and
        change your mind before anything is actually deleted.
      </p>
      <TenantDeletionPanel />
    </main>
  );
}
