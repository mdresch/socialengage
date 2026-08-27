import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { listAlertRules, listTenantAlerts } from '@/lib/core-client';
import { AlertsInboxView } from '@/components/alerts/AlertsInboxView';
import { AlertRulesView } from '@/components/alerts/AlertRulesView';

/**
 * Story 10.10 (ADR-0091) — Real-Time Alerts & Rules Management Page.
 */
export default async function TenantAlertsPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const [rulesRes, alertsRes] = await Promise.allSettled([
    listAlertRules(),
    listTenantAlerts({ limit: 100 }),
  ]);

  const initialRules = rulesRes.status === 'fulfilled' ? rulesRes.value.rules : [];
  const initialAlerts = alertsRes.status === 'fulfilled' ? alertsRes.value.alerts : [];

  return (
    <main>
      <div
        className="page-header"
        style={{
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 'var(--space-4)',
          marginBottom: 'var(--space-5)',
        }}
      >
        <div>
          <h1 className="page-title">Real-Time Alerts & Notifications</h1>
          <p className="page-subtitle">Triage live crisis alerts and configure automated spike thresholds</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-3)' }}>Alerts Inbox</h2>
          <AlertsInboxView initialAlerts={initialAlerts} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-3)' }}>Configured Rules</h2>
          <AlertRulesView initialRules={initialRules} />
        </div>
      </div>
    </main>
  );
}
