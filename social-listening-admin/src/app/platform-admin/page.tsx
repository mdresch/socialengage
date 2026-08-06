import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';

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

  return (
    <main>
      <h1>Platform Admin shell</h1>
      <p>Platform-only operations</p>
    </main>
  );
}
