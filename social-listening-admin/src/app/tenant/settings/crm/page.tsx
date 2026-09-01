import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getCRMCredential } from '@/lib/core-client';
import { CRM_CONNECTOR_UI } from './connectorConfig';

export default async function CRMConnectorsListPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const connectorStatuses = await Promise.all(
    Object.values(CRM_CONNECTOR_UI).map(async (connector) => {
      const credential = await getCRMCredential(connector.id).catch(() => ({
        crmConnectorId: connector.id,
        configured: false,
        config: null,
      }));
      return { ...connector, configured: credential.configured };
    })
  );

  return (
    <main className="p-6">
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>CRM Connectors</h1>

        <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          Choose a CRM provider to configure the credentials used when escalating social items to CRM.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {connectorStatuses.map((connector) => (
            <a
              key={connector.id}
              href={`/tenant/settings/crm/${connector.id}`}
              style={{
                display: 'block',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '1.25rem',
                background: '#fff',
                textDecoration: 'none',
                color: '#111827',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <h2 style={{ fontSize: '1.125rem', fontWeight: 500 }}>{connector.title}</h2>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    padding: '0.25rem 0.5rem',
                    borderRadius: 999,
                    background: connector.configured ? '#dcfce7' : '#f3f4f6',
                    color: connector.configured ? '#166534' : '#6b7280',
                  }}
                >
                  {connector.configured ? 'Configured' : 'Not configured'}
                </span>
              </div>
              <p
                style={{
                  color: '#6b7280',
                  marginTop: '0.5rem',
                  fontSize: '0.875rem',
                }}
              >
                {connector.description}
              </p>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
