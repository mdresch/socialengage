import { getTenantShellActions } from '@/lib/role-routing';

export default function TenantShellPage() {
  const actions = getTenantShellActions({ role: 'tenant_admin' });

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
