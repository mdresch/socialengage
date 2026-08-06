import { getTenantShellActions } from '@/lib/role-routing';

const connectors = [
  {
    id: 'gnews',
    name: 'GNews',
    status: 'healthy',
    lastSuccessfulPoll: '2026-08-05T10:15:00Z',
    unsupportedFeatures: ['OR'],
  },
  {
    id: 'newswire',
    name: 'Newswire',
    status: 'degraded',
    lastSuccessfulPoll: '2026-08-05T09:55:00Z',
    unsupportedFeatures: [],
  },
  {
    id: 'reddit',
    name: 'Reddit',
    status: 'failing',
    lastSuccessfulPoll: '2026-08-05T08:20:00Z',
    unsupportedFeatures: ['NOT'],
  },
];

const watchlists = [
  { id: 'w1', name: 'Breaking news', query: 'keyword AND OR' },
  { id: 'w2', name: 'PR mentions', query: 'NOT keyword' },
];

export default function ConnectorStatusPage() {
  // Fixture identity, unchanged behavior — see role-routing-shell/SKILL.md's 2026-08-06
  // Load-bearing constraint on ResolvedIdentity's real (discriminated, no bare `role`) shape.
  const actions = getTenantShellActions({ type: 'tenant_user', tenantId: 'fixture-tenant', userId: 'fixture-user', role: 'tenant_admin' });

  return (
    <main>
      <h1>Connector status</h1>
      <p>Health only</p>
      <ul>
        {actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
      <section>
        <h2>Connected platforms</h2>
        <ul>
          {connectors.map((connector) => (
            <li key={connector.id}>
              <strong>{connector.name}</strong> — {connector.status}
              <div>Last successful poll: {connector.lastSuccessfulPoll}</div>
              {connector.unsupportedFeatures.length > 0 ? (
                <div>unsupported features: {connector.unsupportedFeatures.join(', ')}</div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Watchlist warnings</h2>
        <ul>
          {watchlists.map((watchlist) => (
            <li key={watchlist.id}>
              <strong>{watchlist.name}</strong>: {watchlist.query}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
