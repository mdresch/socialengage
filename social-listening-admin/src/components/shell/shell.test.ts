import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { AppHeader, AppSidebar, AppShell } from './index';
import type { ResolvedIdentity } from '@/lib/role-routing';

const TENANT_ADMIN: ResolvedIdentity = {
  type: 'tenant_user',
  tenantId: 'tenant-123',
  userId: 'user-1',
  role: 'tenant_admin',
};

const TENANT_USER: ResolvedIdentity = {
  type: 'tenant_user',
  tenantId: 'tenant-123',
  userId: 'user-2',
  role: 'tenant_user',
};

const PLATFORM_ADMIN: ResolvedIdentity = {
  type: 'platform_admin',
  adminId: 'admin-1',
};

describe('App Shell Layout Components (Design Spec §4)', () => {
  describe('AppHeader (§4.2)', () => {
    it('renders brand logo and wordmark pointing to /tenant for tenant session', () => {
      const html = renderToStaticMarkup(
        React.createElement(AppHeader, { shellType: 'tenant', identity: TENANT_ADMIN })
      );
      expect(html).toContain('SocialEngage');
      expect(html).toContain('href="/tenant"');
      expect(html).toContain('Tenant Admin');
      expect(html).toContain('Tenant: tenant-123');
      expect(html).toContain('href="/api/auth/signout"');
    });

    it('renders brand logo pointing to /platform-admin for platform admin session', () => {
      const html = renderToStaticMarkup(
        React.createElement(AppHeader, { shellType: 'platform-admin', identity: PLATFORM_ADMIN })
      );
      expect(html).toContain('href="/platform-admin"');
      expect(html).toContain('Platform Admin');
      expect(html).not.toContain('Tenant:');
    });
  });

  describe('AppSidebar (§4.3 & §4.4)', () => {
    it('renders all tenant nav items with icons and collapse toggle for tenant shell', () => {
      const html = renderToStaticMarkup(
        React.createElement(AppSidebar, { shellType: 'tenant', identity: TENANT_ADMIN })
      );
      expect(html).toContain('href="/tenant/posts"');
      expect(html).toContain('href="/tenant/connectors"');
      expect(html).toContain('href="/tenant/watchlists"');
      expect(html).toContain('href="/tenant/connectors/status"');
      expect(html).toContain('href="/tenant/users"');
      expect(html).toContain('href="/tenant/invite-assist"');
      expect(html).toContain('href="/tenant/settings"');
      expect(html).toContain('nav-icon');
      expect(html).toContain('id="btn-toggle-sidebar"');
      expect(html).toContain('sidebar-toggle-btn');
    });

    it('renders platform admin console link with icon and toggle for platform-admin shell', () => {
      const html = renderToStaticMarkup(
        React.createElement(AppSidebar, { shellType: 'platform-admin', identity: PLATFORM_ADMIN })
      );
      expect(html).toContain('href="/platform-admin"');
      expect(html).toContain('Console Overview');
      expect(html).toContain('nav-icon');
      expect(html).toContain('id="btn-toggle-sidebar"');
      expect(html).not.toContain('href="/tenant/watchlists"');
    });
  });

  describe('AppShell (§4.1)', () => {
    it('wraps header, sidebar, and page content inside structural shell', () => {
      const html = renderToStaticMarkup(
        React.createElement(AppShell, {
          shellType: 'tenant',
          identity: TENANT_USER,
          children: React.createElement('h1', null, 'Posts Feed'),
        })
      );
      expect(html).toContain('app-layout');
      expect(html).toContain('app-topbar');
      expect(html).toContain('app-sidebar');
      expect(html).toContain('app-main-content');
      expect(html).toContain('Posts Feed');
    });
  });
});
