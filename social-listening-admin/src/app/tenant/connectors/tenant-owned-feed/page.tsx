import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getConnectorStatus } from '@/lib/core-client';
import { TenantOwnedFeedSetup } from './TenantOwnedFeedSetup';

/**
 * Story 6.12 (ADR-0050) — dedicated setup screen for the tenant-owned-feed
 * connector, gated on the ordinary 'tenant' shell (Story 6.2) — the backend
 * route (tenantOwnedFeedRouter.ts) itself only requires requireTenantUser(),
 * no additional role restriction, so this screen is visible to both
 * tenant_admin and tenant_user resolved identities, the same as Story 6.9's
 * own no-extra-gate precedent.
 *
 * Reads an optional `?activationId=` search param (see this component's own
 * SKILL.md AC4) so a tenant returning after publishing a TXT record can
 * re-click "Verify now" without restarting the whole connect flow.
 *
 * Story 6.17 (ADR-0051) — also reads real tenant-wide activation state
 * (`isActive`, Story 1.12) so `TenantOwnedFeedSetup` can render the same
 * `ActivateDeactivateButton` (Story 6.15) every other connector already
 * gets, closing the gap where nothing ever set `connector_activations` for
 * this platform. A failed status call degrades to `isActive: false`,
 * mirroring `tenant/connectors/page.tsx`'s own `loadConnectorState()`
 * precedent — a transient core-side issue here must not crash this screen.
 */
export default async function TenantOwnedFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const activationIdParam = params.activationId;
  const initialActivationId = typeof activationIdParam === 'string' ? activationIdParam : null;

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

  return (
    <main>
      <h1>Monitor your own domain&apos;s content feed</h1>
      <p>
        Configure your own company blog or newsroom feed. You&apos;ll need to prove you control the domain by publishing a
        DNS TXT record before SocialEngage begins monitoring it.
      </p>
      <TenantOwnedFeedSetup initialActivationId={initialActivationId} isActive={isActive} isTenantAdmin={isTenantAdmin} />
    </main>
  );
}
