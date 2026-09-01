import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { listWebhookSubscriptions } from '@/lib/core-client';
import { WebhookSubscriptionsView } from '@/components/webhooks/WebhookSubscriptionsView';

/**
 * Story 10.12 (ADR-0092) — Webhook Subscriptions Management Page.
 */
export default async function TenantWebhooksPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const { subscriptions } = await listWebhookSubscriptions().catch(() => ({ subscriptions: [] }));

  return (
    <main>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <a href="/tenant/settings" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textDecoration: 'none' }}>
          ← Back to Settings
        </a>
      </div>
      <WebhookSubscriptionsView initialSubscriptions={subscriptions} />
    </main>
  );
}
