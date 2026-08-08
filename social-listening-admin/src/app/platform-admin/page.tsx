import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { listAdminTenants, queryAdminAuditLog } from '@/lib/core-client';

/**
 * Story 6.2 — this page's own AC2 enforcement point. Healed 2026-08-06: before this pass,
 * this route had no server-side gating at all — any session, including an unauthenticated
 * one that reached this far, could render it. See role-routing-shell/SKILL.md's own
 * Load-bearing constraints.
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

  return (
    <main>
      <h1>Platform Admin console</h1>
      <p>Platform-only operations across tenant provisioning, break-glass support, and audit review.</p>

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
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={4}>No tenants available.</td>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Provision tenant</h2>
        <p>Create a tenant through /v1/admin/tenants (Story 5.12).</p>
      </section>

      <section>
        <h2>Update tenant</h2>
        <p>Update status, license seats, and domain through /v1/admin/tenants/:id (Story 5.12).</p>
      </section>

      <section>
        <h2>Break-glass</h2>
        <p>
          Request reset and Execute request use the two-phase flow from Story 5.13.
          Request reset writes /v1/admin/tenants/:tenantId/break-glass/request and Execute request calls
          /v1/admin/tenants/:tenantId/break-glass/requests/:requestId/execute.
        </p>
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
