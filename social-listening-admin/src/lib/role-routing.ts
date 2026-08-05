export type AdminRole = 'tenant_admin' | 'tenant_user' | 'platform_admin';

export type RoleShell = 'tenant' | 'platform-admin';

export function getRoleShell(identity: { role?: string | null }): RoleShell {
  switch (identity.role) {
    case 'platform_admin':
      return 'platform-admin';
    case 'tenant_admin':
    case 'tenant_user':
      return 'tenant';
    default:
      return 'tenant';
  }
}

export function getTenantShellActions(identity: { role?: string | null }): string[] {
  const actions = ['Connect a platform', 'Manage watchlists', 'View connector status'];
  if (identity.role === 'tenant_admin') {
    actions.push('Tenant-wide connect');
  }
  return actions;
}
