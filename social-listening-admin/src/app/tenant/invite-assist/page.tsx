import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity } from '@/lib/role-routing';
import { listDomainSignupAttempts } from '@/lib/core-client';

/**
 * Story 6.10 / ADR-0037 §8b — deliberately gated the whole screen, before
 * any data fetch, rather than Story 6.8's own in-page-only pattern. See
 * this component's own SKILL.md Load-bearing constraints.
 */
export default async function InviteAssistPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  const isTenantAdmin = identity?.type === 'tenant_user' && identity.role === 'tenant_admin';
  if (!isTenantAdmin) {
    redirect('/');
  }

  const domains = await listDomainSignupAttempts();

  return (
    <main>
      <h1>Same-Domain Invite Assist</h1>
      <p>Sign-up attempts from email domains that already match your tenant, not yet invited.</p>
      {domains.length === 0 ? (
        <p>No same-domain sign-up attempts.</p>
      ) : (
        <ul>
          {domains.map((item) => (
            <li key={item.domain}>
              <details>
                <summary>
                  {item.escalated && <strong>⚠ Escalated — repeated attempts: </strong>}
                  {item.domain} — {item.distinctEmailCount}{' '}
                  {item.distinctEmailCount === 1 ? 'distinct attempt' : 'distinct attempts'}
                </summary>
                <ul>
                  {item.emails.map((email) => (
                    <li key={email}>
                      {email}{' '}
                      <a href={`/tenant/users?inviteEmail=${encodeURIComponent(email)}`}>Invite this person</a>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
