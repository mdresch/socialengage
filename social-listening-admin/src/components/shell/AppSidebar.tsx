'use client';

import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';
import type { ResolvedIdentity } from '@/lib/role-routing';

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  exact?: boolean;
}

export interface AppSidebarProps {
  identity?: ResolvedIdentity | null;
  shellType: 'tenant' | 'platform-admin';
}

const TENANT_NAV_ITEMS: NavItem[] = [
  { label: 'Posts', href: '/tenant/posts' },
  { label: 'Analytics', href: '/tenant/analytics' },
  { label: 'Connect platforms', href: '/tenant/connectors' },
  { label: 'Watchlists', href: '/tenant/watchlists' },
  { label: 'Connector status', href: '/tenant/connectors/status' },
  { label: 'Team & Access', href: '/tenant/users' },
  { label: 'Invite assist', href: '/tenant/invite-assist' },
  { label: 'Tenant settings', href: '/tenant/settings' },
];

const PLATFORM_ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Console Overview', href: '/platform-admin' },
];

/**
 * AppSidebar (Design Spec §4.3 & §4.4)
 * Left Navigation Sidebar (240px, --color-surface-sidebar)
 */
export function AppSidebar({ identity, shellType }: AppSidebarProps): ReactElement {
  let pathname = '';
  try {
    pathname = usePathname() || '';
  } catch {
    pathname = '';
  }

  const isTenantAdmin = identity?.type === 'tenant_user' && identity.role === 'tenant_admin';
  const navItems = shellType === 'platform-admin' ? PLATFORM_ADMIN_NAV_ITEMS : TENANT_NAV_ITEMS;

  const isActive = (item: NavItem) => {
    if (!pathname) return false;
    if (item.exact || item.href === '/tenant' || item.href === '/platform-admin') {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <aside className="app-sidebar" data-testid="app-sidebar">
      <nav aria-label="Main Navigation">
        <ul className="app-sidebar-nav">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  className={`nav-link ${active ? 'active' : ''}`.trim()}
                  aria-current={active ? 'page' : undefined}
                  data-testid={`nav-link-${item.href.replace(/\//g, '-')}`}
                >
                  <span>{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
