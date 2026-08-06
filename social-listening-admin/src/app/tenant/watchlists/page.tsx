import { getTenantShellActions } from '@/lib/role-routing';

const watchlists = [
  { id: 'w1', name: 'Breaking news', matchType: 'keyword', isActive: true, platforms: ['GNews'] },
  { id: 'w2', name: 'PR mentions', matchType: 'boolean', isActive: false, platforms: ['Newswire'] },
];

export default function WatchlistsPage() {
  // Fixture identity, unchanged behavior — see role-routing-shell/SKILL.md's 2026-08-06
  // Load-bearing constraint on ResolvedIdentity's real (discriminated, no bare `role`) shape.
  const actions = getTenantShellActions({ type: 'tenant_user', tenantId: 'fixture-tenant', userId: 'fixture-user', role: 'tenant_user' });

  return (
    <main>
      <h1>Watchlists</h1>
      <p>Create, edit, and remove watchlists for this tenant.</p>
      <ul>
        {actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
      <section>
        <h2>Current watchlists</h2>
        <ul>
          {watchlists.map((watchlist) => (
            <li key={watchlist.id}>
              <strong>{watchlist.name}</strong> — {watchlist.matchType} ({watchlist.isActive ? 'active' : 'inactive'})
              <div>Platforms: {watchlist.platforms.join(', ')}</div>
              <p>confirm before deleting this watchlist.</p>
              <button type="button">Confirm delete</button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Create or edit a watchlist</h2>
        <form>
          <label>
            Name
            <input name="name" defaultValue="" />
          </label>
          <label>
            Match type
            <select name="matchType" defaultValue="keyword">
              <option value="keyword">keyword</option>
              <option value="hashtag">hashtag</option>
              <option value="account">account</option>
              <option value="boolean">boolean</option>
            </select>
          </label>
          <label>
            Boolean query
            <textarea name="booleanQuery" defaultValue="" />
          </label>
          <button type="submit">Save</button>
        </form>
      </section>
    </main>
  );
}
