import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
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

  return (
    <main>
      <h1>Monitor your own domain&apos;s content feed</h1>
      <p>
        Configure your own company blog or newsroom feed. You&apos;ll need to prove you control the domain by publishing a
        DNS TXT record before SocialEngage begins monitoring it.
      </p>
      <TenantOwnedFeedSetup initialActivationId={initialActivationId} />
    </main>
  );
}
