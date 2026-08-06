import { getTenantShellActions } from '@/lib/role-routing';

const connectors = [
  { id: 'gnews', name: 'GNews', connected: false, ownerType: 'user' },
  { id: 'newswire', name: 'Newswire', connected: true, ownerType: 'tenant' },
];

export default function ConnectorsPage() {
  // Fixture identity, unchanged behavior — see role-routing-shell/SKILL.md's 2026-08-06
  // Load-bearing constraint on ResolvedIdentity's real (discriminated, no bare `role`) shape.
  const actions = getTenantShellActions({ type: 'tenant_user', tenantId: 'fixture-tenant', userId: 'fixture-user', role: 'tenant_admin' });

  return (
    <main>
      <h1>Connect a platform</h1>
      <p>
        Before you submit a credential, please confirm that you are creating your own account or API key directly with the provider under that provider&apos;s own terms. This is not a SocialEngage-managed signup and SocialEngage is not the billing intermediary for the provider terms.
      </p>
      <ul>
        {actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
      <section>
        <h2>Available connectors</h2>
        <ul>
          {connectors.map((connector) => (
            <li key={connector.id}>
              <strong>{connector.name}</strong>
              {' '}
              {connector.connected ? 'Connected' : 'Not connected'}
              {' '}({connector.ownerType === 'tenant' ? 'tenant-wide' : 'personal'})
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
