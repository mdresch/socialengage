import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { listTenantUsers } from '@/lib/core-client';
import { StatusBadge, EmptyState } from '@/components/ui';
import { InviteUserForm } from './InviteUserForm';
import { AccessControl } from './AccessControl';
import { AccessHistoryButton } from './AccessHistoryButton';

/**
 * Story 6.8 — visible to both tenant_user and tenant_admin resolved
 * identities (Story 6.2's own 'tenant' shell gate, AC1's own "lists all
 * users" has no role restriction); the invite form and per-row access
 * controls are additionally gated on tenant_admin below (AC2), the same
 * UX-convenience-only framing Story 6.3 already established — the real
 * boundary stays Story 1.9's own 403.
 *
 * Story 6.10 — also reads an optional `?inviteEmail=` search param (set by
 * the Same-Domain Invite Assist screen's own "invite this person" link) and
 * passes it down as InviteUserForm's initialEmail — a read-only pre-fill,
 * never an auto-submit. See .claude/skills/same-domain-invite-assist/SKILL.md.
 *
 * Visual redesign, 2026-08-17 — real styling against this project's own
 * hand-rolled design system (globals.css, `tu-*` classes), plus a real
 * seat-utilization meter sourced from the tenant's own real
 * licenseSeatCount/activeSeatCount (social-listening-core@556bb65's own
 * enhancement to this same GET response) — never a fabricated number.
 */
export default async function TenantUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const inviteEmailParam = params.inviteEmail;
  const initialEmail = typeof inviteEmailParam === 'string' ? inviteEmailParam : '';

  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const isTenantAdmin = identity?.type === 'tenant_user' && identity.role === 'tenant_admin';

  let users: Awaited<ReturnType<typeof listTenantUsers>>['users'] = [];
  let seats: Awaited<ReturnType<typeof listTenantUsers>>['seats'] = { licenseSeatCount: 0, activeSeatCount: 0 };
  try {
    const result = await listTenantUsers();
    users = result.users;
    seats = result.seats;
  } catch {
    users = [];
  }

  // Story 6.14 — resolves an access-history entry's actorUserId to a real
  // email without a new endpoint; an actor no longer in this tenant falls
  // back to the raw id (AccessHistoryButton's own honest default).
  const actorLookup = Object.fromEntries(users.map((user) => [user.id, user.email]));

  const seatPct = seats.licenseSeatCount > 0 ? Math.min(100, Math.round((seats.activeSeatCount / seats.licenseSeatCount) * 100)) : 0;

  return (
    <main className="tu-page">
      <div className="tu-header">
        <div>
          <h1 className="page-title">Team &amp; access</h1>
          <p className="page-subtitle">Manage who can sign in to this tenant, their role, and time-bounded access windows.</p>
        </div>
        {isTenantAdmin && <InviteUserForm initialEmail={initialEmail} />}
      </div>

      <div className="tu-seat-card">
        <div>
          <span className="tu-seat-label">License seat allocation</span>
          <div className="tu-seat-count">
            {seats.activeSeatCount} active of {seats.licenseSeatCount} licensed seats
          </div>
        </div>
        <div className="tu-seat-meter">
          <div className="tu-seat-meter-track">
            <div className="tu-seat-meter-fill" style={{ width: `${seatPct}%` }} />
          </div>
          <span className="tu-seat-meter-pct">{seatPct}%</span>
        </div>
      </div>

      {users.length === 0 ? (
        <EmptyState heading="No users yet" body="Invite a team member to get started." />
      ) : (
        <div className="tu-table-card">
          <table className="tu-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Access expiry</th>
                {isTenantAdmin && <th className="tu-table-actions-header">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="tu-user-cell">
                      <span className="tu-avatar" aria-hidden="true">
                        {user.email.charAt(0).toUpperCase()}
                      </span>
                      <span className="tu-user-email">{user.email}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`tu-role-pill ${user.role === 'tenant_admin' ? 'tu-role-pill-admin' : ''}`}>
                      {user.role === 'tenant_admin' ? 'Tenant Admin' : 'Tenant User'}
                    </span>
                  </td>
                  <td>
                    <StatusBadge variant={user.status === 'active' ? 'active' : 'pending'} label={user.status === 'active' ? 'Active' : 'Invited'} />
                  </td>
                  <td>
                    {user.accessEndsAt ? (
                      <span className="tu-expiry-pill">Expires {new Date(user.accessEndsAt).toLocaleDateString()}</span>
                    ) : (
                      <span className="tu-expiry-indefinite">active indefinitely</span>
                    )}
                  </td>
                  {isTenantAdmin && (
                    <td className="tu-table-actions">
                      <AccessControl userId={user.id} currentValue={user.accessEndsAt} />
                      <AccessHistoryButton userId={user.id} userEmail={user.email} actorLookup={actorLookup} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
