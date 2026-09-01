import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getMyPlan } from '@/lib/core-client';
import { SeatUsageCard } from '@/components/plan/SeatUsageCard';
import { FeatureToggleList } from '@/components/plan/FeatureToggleList';

/**
 * Story 13.6 (ADR-0112) — tenant-facing /tenant/plan page.
 * Shows the caller's own plan, seat usage (used/max), license seat count,
 * effective feature gates, and upgrade messaging when a seat or feature
 * limit is hit.
 */
export default async function TenantPlanPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const plan = await getMyPlan();

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Plan &amp; seats</h1>

      <section aria-label="Current plan" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Plan: {plan.plan}</h2>
        <SeatUsageCard usedSeats={plan.usedSeats} maxSeats={plan.maxSeats} />
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>
          License seats: {plan.licenseSeatCount}
        </p>
      </section>

      {plan.usedSeats >= plan.maxSeats && (
        <p role="alert" style={{ color: '#dc2626', marginBottom: '1.5rem' }}>
          You have reached your seat limit. Contact your Platform Admin to upgrade.
        </p>
      )}

      <section aria-label="Available features" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Available features</h2>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          Gated features are shown as disabled; contact your Platform Admin to upgrade and enable them.
        </p>
        <FeatureToggleList featureGates={plan.featureGates} readOnly />
        {Object.entries(plan.featureGates)
          .filter(([key, value]) => key !== 'max_seats' && value === false)
          .map(([key]) => (
            <p key={key} role="status" style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              {key.replace(/_/g, ' ')} is not available on your current plan. Upgrade to enable it.
            </p>
          ))}
      </section>
    </main>
  );
}
