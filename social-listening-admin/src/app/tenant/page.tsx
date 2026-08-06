import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { getTenantShellActions, isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';

/**
 * Story 6.2 — this page's own AC2 enforcement point. Healed 2026-08-06: before this pass,
 * this route had no server-side gating at all (any session could render it, and the
 * actions list was a hardcoded `tenant_admin` fixture regardless of who was actually
 * signed in) — see role-routing-shell/SKILL.md's own Load-bearing constraints.
 */
export default async function TenantShellPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const actions = getTenantShellActions(identity);

  return (
    <main>
      <h1>Tenant admin shell</h1>
      <ul>
        {actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
    </main>
  );
}
