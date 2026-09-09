import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getAdminTenantPlan } from '@/lib/core-client';
import { TenantPlanForm } from './TenantPlanForm';

/**
 * Story 13.6 (ADR-0112) — Platform-Admin plan and seat management page.
 * Reads GET /v1/admin/tenants/:tenantId/plan and mounts an editable form.
 */
export default async function AdminTenantPlanPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'platform-admin')) {
    redirect('/');
  }

  let initialPlan;
  try {
    initialPlan = await getAdminTenantPlan(tenantId);
  } catch {
    notFound();
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Plan &amp; seats</h1>
      <TenantPlanForm tenantId={tenantId} initialPlan={initialPlan} />
    </main>
  );
}
