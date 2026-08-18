import type { ReactElement } from 'react';
import type { ResolvedIdentity } from '@/lib/role-routing';

export interface AppHeaderProps {
  identity?: ResolvedIdentity | null;
  shellType: 'tenant' | 'platform-admin';
}

/**
 * AppHeader (Design Spec §4.2)
 * Top Bar (64px, --color-surface-bar) containing brand, tenant context, and user menu.
 */
export function AppHeader({ identity, shellType }: AppHeaderProps): ReactElement {
  const homeHref = shellType === 'platform-admin' ? '/platform-admin' : '/tenant';

  let roleLabel = 'User';
  let contextName: string | null = null;

  if (identity) {
    if (identity.type === 'platform_admin') {
      roleLabel = 'Platform Admin';
    } else if (identity.type === 'tenant_user') {
      roleLabel = identity.role === 'tenant_admin' ? 'Tenant Admin' : 'Tenant User';
      contextName = `Tenant: ${identity.tenantId}`;
    }
  }

  return (
    <header className="app-topbar" data-testid="app-topbar">
      <div className="topbar-brand">
        <a href={homeHref} className="topbar-brand-link" data-testid="topbar-brand-link">
          <span className="topbar-brand-logo">SE</span>
          <span>SocialEngage</span>
        </a>
      </div>

      <div className="topbar-center">
        {contextName && (
          <span className="topbar-tenant-badge" data-testid="topbar-tenant-context">
            {contextName}
          </span>
        )}
      </div>

      <div className="topbar-right">
        <div className="topbar-user">
          <span className="topbar-role-tag" data-testid="topbar-role-tag">
            {roleLabel}
          </span>
        </div>
        <a href="/api/auth/signout" className="topbar-signout" data-testid="topbar-signout">
          Sign out
        </a>
      </div>
    </header>
  );
}
