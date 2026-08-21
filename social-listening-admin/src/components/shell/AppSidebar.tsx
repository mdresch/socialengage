'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { ReactElement, ReactNode } from 'react';
import type { ResolvedIdentity } from '@/lib/role-routing';

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  exact?: boolean;
}

export interface AppSidebarProps {
  identity?: ResolvedIdentity | null;
  shellType: 'tenant' | 'platform-admin';
}

function IconCompose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function IconPosts() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconAnalytics() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconConnectors() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function IconWatchlists() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconStatus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconInvite() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconConsole() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function IconCollapse() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

const TENANT_NAV_ITEMS: NavItem[] = [
  { label: 'Compose post', href: '/tenant/compose', icon: <IconCompose /> },
  { label: 'Posts', href: '/tenant/posts', icon: <IconPosts /> },
  { label: 'Analytics', href: '/tenant/analytics', icon: <IconAnalytics /> },
  { label: 'Connect platforms', href: '/tenant/connectors', icon: <IconConnectors /> },
  { label: 'Watchlists', href: '/tenant/watchlists', icon: <IconWatchlists /> },
  { label: 'Connector status', href: '/tenant/connectors/status', icon: <IconStatus /> },
  { label: 'Team & Access', href: '/tenant/users', icon: <IconUsers /> },
  { label: 'Invite assist', href: '/tenant/invite-assist', icon: <IconInvite /> },
  { label: 'Tenant settings', href: '/tenant/settings', icon: <IconSettings /> },
];

const PLATFORM_ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Console Overview', href: '/platform-admin', icon: <IconConsole /> },
];

/**
 * AppSidebar (Design Spec §4.3 & §4.4)
 * Left Navigation Sidebar (240px expanded / 64px collapsed, --color-surface-sidebar)
 */
export function AppSidebar({ identity, shellType }: AppSidebarProps): ReactElement {
  let pathname = '';
  try {
    pathname = usePathname() || '';
  } catch {
    pathname = '';
  }

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('se_sidebar_collapsed');
      if (saved !== null) {
        setCollapsed(saved === 'true');
      }
    } catch {
      // safe fallback if localStorage not available
    }
  }, []);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('se_sidebar_collapsed', String(next));
      } catch {
        // safe fallback
      }
      return next;
    });
  }

  const navItems = shellType === 'platform-admin' ? PLATFORM_ADMIN_NAV_ITEMS : TENANT_NAV_ITEMS;

  const isActive = (item: NavItem) => {
    if (!pathname) return false;
    if (item.exact || item.href === '/tenant' || item.href === '/platform-admin') {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <aside
      className={`app-sidebar${collapsed ? ' app-sidebar-collapsed' : ''}`}
      data-testid="app-sidebar"
      aria-label="Sidebar Navigation"
    >
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
                  title={collapsed ? item.label : undefined}
                >
                  {item.icon && <span className="nav-icon">{item.icon}</span>}
                  <span className="nav-label">{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="app-sidebar-footer">
        <button
          type="button"
          id="btn-toggle-sidebar"
          className="app-sidebar-toggle"
          onClick={toggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          data-testid="sidebar-toggle-btn"
        >
          <span className="nav-icon">
            {collapsed ? <IconExpand /> : <IconCollapse />}
          </span>
          <span className="nav-label sidebar-toggle-text">
            {collapsed ? 'Expand' : 'Collapse'}
          </span>
        </button>
      </div>
    </aside>
  );
}
