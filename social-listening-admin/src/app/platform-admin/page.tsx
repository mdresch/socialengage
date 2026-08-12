import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { listAdminTenants, queryAdminAuditLog, getCoreHealthStatus } from '@/lib/core-client';
import { ProvisionTenantForm } from './ProvisionTenantForm';
import { TenantAdminControls } from './TenantAdminControls';
import { BreakGlassPanel } from './BreakGlassPanel';

/**
 * Story 6.2 — this page's own AC2 enforcement point. Healed 2026-08-06: before this pass,
 * this route had no server-side gating at all — any session, including an unauthenticated
 * one that reached this far, could render it. See role-routing-shell/SKILL.md's own
 * Load-bearing constraints.
 *
 * Story 6.6 (reworked 2026-08-12) — Provision tenant, Update tenant, and Break-glass were
 * each a single descriptive <p> with zero interactivity despite createAdminTenant()/
 * updateAdminTenant()/requestBreakGlassReset()/executeBreakGlassRequest() already existing
 * as real, working functions in core-client.ts. Now mounts real forms/controls for all
 * three, plus a database health indicator (added 2026-08-12) reading Story 1.10's already-
 * real, unauthenticated GET /v1/health. Tenant registry and Audit log were already real and
 * needed no rework.
 */
export default async function PlatformAdminShellPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'platform-admin')) {
    redirect('/');
  }

  let tenants: Awaited<ReturnType<typeof listAdminTenants>> = [];
  let auditEntries: Awaited<ReturnType<typeof queryAdminAuditLog>>['entries'] = [];
  let dbHealth: 'ok' | 'unavailable' = 'unavailable';

  try {
    tenants = await listAdminTenants();
  } catch {
    tenants = [];
  }

  try {
    const page = await queryAdminAuditLog({ limit: 10 });
    auditEntries = page.entries;
  } catch {
    auditEntries = [];
  }

  dbHealth = await getCoreHealthStatus();

  return (
    <main>
      <h1>Platform Admin console</h1>
      <p>Platform-only operations across tenant provisioning, break-glass support, and audit review.</p>

      <section>
        <h2>Database health</h2>
        <p>
          Status: <strong>{dbHealth}</strong>
        </p>
      </section>

      <section>
        <h2>Tenant registry</h2>
        <p>No tenant-content data is exposed here; this console never shows users, watchlists, social posts, or credentials.</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Domain</th>
              <th>Status</th>
              <th>Seats</th>
              <th>Update</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={5}>No tenants available.</td>
              </tr>
            ) : (
              tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>{tenant.name}</td>
                  <td>{tenant.domain ?? 'n/a'}</td>
                  <td>{tenant.status}</td>
                  <td>
                    {tenant.activeSeatCount} / {tenant.licenseSeatCount}
                  </td>
                  <td>
                    <TenantAdminControls
                      tenantId={tenant.id}
                      currentName={tenant.name}
                      currentStatus={tenant.status}
                      currentLicenseSeatCount={tenant.licenseSeatCount}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Provision tenant</h2>
        <ProvisionTenantForm />
      </section>

      <section>
        <h2>Break-glass</h2>
        <p>
          Request reset and Execute request use the two-phase flow from Story 5.13. Request reset writes
          /v1/admin/tenants/:tenantId/break-glass/request and Execute request calls
          /v1/admin/tenants/:tenantId/break-glass/requests/:requestId/execute.
        </p>
        <BreakGlassPanel tenants={tenants.map((tenant) => ({ id: tenant.id, name: tenant.name }))} />
      </section>

      <section>
        <h2>Audit log</h2>
        {auditEntries.length === 0 ? (
          <p>No audit log entries found.</p>
        ) : (
          <ul>
            {auditEntries.map((entry) => (
              <li key={entry.id}>
                {entry.createdAt} — {entry.operation} — {entry.actorIdentity}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p>infrastructure metrics are out of scope for Story 6.6.</p>
    </main>
  );
}
