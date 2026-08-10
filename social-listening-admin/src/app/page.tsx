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
