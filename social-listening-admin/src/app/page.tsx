import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { getRoleShell, getTenantShellActions, isResolvedIdentity } from '@/lib/role-routing';

/**
 * Story 6.1/6.2 — the first real page this project has shipped. Deliberately renders no
 * token value anywhere (ADR-0036 §1's "never a value browser-side JavaScript, or a
 * server-rendered HTML payload, can read" requirement) — only a boolean signed-in state.
 *
 * Healed 2026-08-10 (Menno's explicit request) — a successful platform_admin sign-in
 * now forwards straight to /platform-admin rather than landing here and requiring a
 * manual click. Narrowly scoped: a tenant identity's own root-page experience
 * (the action list + manual "Open tenant shell" link) is deliberately unchanged.
 *
 * Healed 2026-08-12 — a real session (a real Entra sign-in) whose identity never
 * resolved (no matching users/platform_admins row anywhere) used to fall through to
 * this same branch as a real tenant_user/tenant_admin, rendering "Tenant shell" content
 * for a caller getRoleShell() itself now treats as having no shell at all
 * (see src/lib/role-routing.ts). Sent to /sign-in instead — Menno's explicit sign-off,
 * see docs/implementation-log.md.
 */
export default async function HomePage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;
  const shell = getRoleShell(identity);

  if (session && shell === 'platform-admin') {
    redirect('/platform-admin');
  }

  if (session && shell === null) {
    redirect('/sign-in');
  }

  const tenantActions = getTenantShellActions(identity);

  return (
    <main>
      <h1>SocialEngage Admin</h1>
      {session ? (
        <>
          <p data-testid="signed-in-state">Signed in.</p>
          <p>Tenant shell</p>
          <ul>
            {tenantActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
          <a href="/tenant">Open tenant shell</a>
          <a href="/api/auth/signout">Sign out</a>
        </>
      ) : (
        <p>Not signed in.</p>
      )}
    </main>
  );
}
