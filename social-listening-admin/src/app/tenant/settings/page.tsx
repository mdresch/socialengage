import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getMyTenant } from '@/lib/core-client';

/**
 * Story 6.9 (read-only metadata) + Story 6.40 (ADR-0074 — styled workspace
 * profile, export actions, and offboarding link). Visible to both
 * tenant_admin and tenant_user resolved identities (the ordinary 'tenant'
 * shell gate, Story 6.2). The offboarding/decommission section and the
 * workspace export button are role-gated affordances inside the page
 * (tenant_admin only), not a role gate on the page itself.
 */
export default async function TenantSettingsPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const tenant = await getMyTenant();
  const isAdmin = identity && 'role' in identity && identity.role === 'tenant_admin';
  const createdAt = new Date(tenant.createdAt);

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Tenant settings</h1>

      {/* Workspace Configuration card (AC1) */}
      <section
        aria-label="Workspace Configuration"
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '1.5rem',
          marginBottom: '1.5rem',
          background: '#fff',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Workspace Configuration</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '0.75rem 1.5rem', margin: 0 }}>
          <dt style={{ fontWeight: 600, color: '#374151' }}>Name</dt>
          <dd style={{ margin: 0 }}>{tenant.name}</dd>

          <dt style={{ fontWeight: 600, color: '#374151' }}>Status</dt>
          <dd style={{ margin: 0 }}>{tenant.status}</dd>

          <dt style={{ fontWeight: 600, color: '#374151' }}>Domain</dt>
          <dd style={{ margin: 0 }}>{tenant.domain ?? '—'}</dd>

          <dt style={{ fontWeight: 600, color: '#374151' }}>Seats</dt>
          <dd style={{ margin: 0 }}>
            {tenant.activeSeatCount} of {tenant.licenseSeatCount} active
          </dd>

          <dt style={{ fontWeight: 600, color: '#374151' }}>Created</dt>
          <dd style={{ margin: 0 }}>{createdAt.toLocaleDateString()}</dd>
        </dl>
      </section>

      {/* Export actions card (AC3/AC4) */}
      <section
        aria-label="Data Export"
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '1.5rem',
          marginBottom: '1.5rem',
          background: '#fff',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Data Export</h2>
        <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Download your tenant data on demand. Exports are generated server-side from real
          social-listening-core data.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Workspace export — tenant_admin only (BRU-001). Disabled, not hidden, for tenant_user. */}
          <a
            href="/api/tenants/export/workspace"
            aria-disabled={!isAdmin}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: isAdmin ? '#111827' : '#9ca3af',
              background: isAdmin ? '#fff' : '#f9fafb',
              pointerEvents: isAdmin ? 'auto' : 'none',
              cursor: isAdmin ? 'pointer' : 'not-allowed',
            }}
          >
            Export Full Workspace (JSON)
          </a>
          {!isAdmin && (
            <span style={{ alignSelf: 'center', color: '#9ca3af', fontSize: '0.75rem' }}>
              Requires Tenant-Admin role
            </span>
          )}

          {/* CSV export — both roles (BRU-002) */}
          <a
            href="/api/posts/export.csv"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#111827',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Export Matched Posts (CSV)
          </a>
        </div>
      </section>

      {/* CRM Connector Settings Card */}
      <section
        aria-label="CRM Connectors"
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '1.5rem',
          marginBottom: '1.5rem',
          background: '#fff',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>CRM Connectors</h2>
        <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Configure the credentials used when escalating social items to Dynamics 365, HubSpot, or Salesforce.
        </p>
        <a
          href="/tenant/settings/crm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '0.5rem 1rem',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#111827',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          <span>⚙️</span>
          <span>Manage CRM Connectors</span>
        </a>
      </section>

      {/* Notifications & Daily Digest Card */}
      <section
        aria-label="Notification Preferences"
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '1.5rem',
          marginBottom: '1.5rem',
          background: '#fff',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Notification Preferences</h2>
        <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Configure your morning daily digest email subscription, delivery timezone, and content preferences.
        </p>
        <a
          href="/tenant/settings/digest"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '0.5rem 1rem',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#111827',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          <span>✉️</span>
          <span>Manage Daily Digest Email</span>
        </a>
      </section>

      {/* Offboarding/decommission section — tenant_admin only (AC2) */}
      {isAdmin && (
        <section
          aria-label="Offboarding and Decommission"
          style={{
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '1.5rem',
            marginBottom: '1.5rem',
            background: '#fef2f2',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#991b1b' }}>
            Offboarding and Decommission
          </h2>
          <p style={{ color: '#7f1d1d', marginBottom: '1rem', fontSize: '0.875rem' }}>
            Initiate a self-service tenant deletion request. This starts a 30-day grace period
            during which you can cancel. Your data will be exported before deletion.
          </p>
          <a
            href="/tenant/settings/delete"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.5rem 1rem',
              border: '1px solid #dc2626',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#dc2626',
              background: '#fff',
            }}
          >
            Request Tenant Deletion
          </a>
        </section>
      )}
    </main>
  );
}
