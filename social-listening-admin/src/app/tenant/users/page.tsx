import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { listTenantUsers } from '@/lib/core-client';
import { InviteUserForm } from './InviteUserForm';
import { AccessControl } from './AccessControl';

/**
 * Story 6.8 — visible to both tenant_user and tenant_admin resolved
 * identities (Story 6.2's own 'tenant' shell gate, AC1's own "lists all
 * users" has no role restriction); the invite form and per-row access
 * controls are additionally gated on tenant_admin below (AC2), the same
 * UX-convenience-only framing Story 6.3 already established — the real
 * boundary stays Story 1.9's own 403.
 */
export default async function TenantUsersPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const isTenantAdmin = identity?.type === 'tenant_user' && identity.role === 'tenant_admin';

  let users: Awaited<ReturnType<typeof listTenantUsers>> = [];
  try {
    users = await listTenantUsers();
  } catch {
    users = [];
  }

  return (
    <main>
      <h1>Tenant users</h1>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Access ends</th>
            {isTenantAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr>
              <td colSpan={isTenantAdmin ? 5 : 4}>No users found.</td>
            </tr>
          ) : (
            users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.status}</td>
                <td>{user.accessEndsAt ?? 'active indefinitely'}</td>
                {isTenantAdmin && (
                  <td>
                    <AccessControl userId={user.id} currentValue={user.accessEndsAt} />
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {isTenantAdmin && (
        <section>
          <h2>Invite a user</h2>
          <InviteUserForm />
        </section>
      )}
    </main>
  );
}
