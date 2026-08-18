import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getConnectorStatus, listTenantOwnedFeedActivations } from '@/lib/core-client';
import { TenantOwnedFeedSetup } from './TenantOwnedFeedSetup';

/**
 * Story 6.12 (ADR-0050) — dedicated setup screen for the tenant-owned-feed
 * connector, gated on the ordinary 'tenant' shell (Story 6.2) — the backend
 * route itself now requires `tenant_admin` for every mutating action
 * (Story 6.20), but reading the screen and its feed list stays open to any
 * resolved tenant identity, the same as Story 6.9's own no-extra-gate
 * precedent.
 *
 * Story 6.17 (ADR-0051) — also reads real tenant-wide activation state
 * (`isActive`, Story 1.12) so `TenantOwnedFeedSetup` can render the same
 * `ActivateDeactivateButton` (Story 6.15) every other connector already
 * gets. A failed status call degrades to `isActive: false`, mirroring
 * `tenant/connectors/page.tsx`'s own `loadConnectorState()` precedent.
 *
 * Story 6.20 (ADR-0057) — replaces the old single-activation URL-param
 * persistence trick with a real, always-fresh list fetched here
 * server-side (`listTenantOwnedFeedActivations()`), the same "Server
 * Component fetches, Client Component only mutates" pattern `/tenant/users`
 * already established. A failed list call degrades to an empty array, not
 * a crash — the same honest-degradation precedent every list screen in
 * this app follows. This route now takes no props of its own at all.
 */
export default async function TenantOwnedFeedPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const isTenantAdmin = identity?.type === 'tenant_user' && identity.role === 'tenant_admin';
  const isActive = await getConnectorStatus('tenant-owned-feed')
    .then((status) => status.isActive)
    .catch(() => false);
  const activations = await listTenantOwnedFeedActivations().catch(() => []);

  return (
    <main>
      <h1>Monitor your own domain&apos;s content feed</h1>
      <p>
        Configure your own company blog or newsroom feed. You&apos;ll need to prove you control the domain by publishing a
        DNS TXT record before SocialEngage begins monitoring it.
      </p>
      <TenantOwnedFeedSetup activations={activations} isActive={isActive} isTenantAdmin={isTenantAdmin} />
    </main>
  );
}
