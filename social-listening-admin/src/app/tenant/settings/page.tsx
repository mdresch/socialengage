import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getMyTenant } from '@/lib/core-client';

/**
 * Story 6.9 — read-only. Visible to both tenant_admin and tenant_user
 * resolved identities (the ordinary 'tenant' shell gate, Story 6.2) — no
 * further role gate, unlike Story 6.8's own invite/access-control affordances.
 */
export default async function TenantSettingsPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const tenant = await getMyTenant();

  return (
    <main>
      <h1>Tenant settings</h1>
      <dl>
        <dt>Name</dt>
        <dd>{tenant.name}</dd>

        <dt>Status</dt>
        <dd>{tenant.status}</dd>

        <dt>Domain</dt>
        <dd>{tenant.domain ?? 'n/a'}</dd>

        <dt>Seats</dt>
        <dd>
          {tenant.activeSeatCount} of {tenant.licenseSeatCount} seats used
        </dd>

        <dt>Created</dt>
        <dd>{tenant.createdAt}</dd>
      </dl>
    </main>
  );
}
