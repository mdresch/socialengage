import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { getRoleShell, getTenantShellActions, isResolvedIdentity } from '@/lib/role-routing';

/**
 * Story 6.1/6.2 — the first real page this project has shipped. Deliberately renders no
 * token value anywhere (ADR-0036 §1's "never a value browser-side JavaScript, or a
 * server-rendered HTML payload, can read" requirement) — only a boolean signed-in state.
 */
export default async function HomePage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;
  const shell = getRoleShell(identity);
  const tenantActions = getTenantShellActions(identity);

  return (
    <main>
      <h1>SocialEngage Admin</h1>
      {session ? (
        <>
          <p data-testid="signed-in-state">Signed in.</p>
          {shell === 'platform-admin' ? (
            <>
              <p>Platform Admin shell</p>
              <a href="/platform-admin">Open Platform Admin</a>
            </>
          ) : (
            <>
              <p>Tenant shell</p>
              <ul>
                {tenantActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
              <a href="/tenant">Open tenant shell</a>
            </>
          )}
          <a href="/api/auth/signout">Sign out</a>
        </>
      ) : (
        <p>Not signed in.</p>
      )}
    </main>
  );
}
