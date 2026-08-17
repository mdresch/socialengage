/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { SignInView } from './views/SignInView';
import { SignUpView } from './views/SignUpView';
import { SignedOutView } from './views/SignedOutView';
import { TenantDashboardView } from './views/TenantDashboardView';
import { PostsFeedView } from './views/PostsFeedView';
import { ConnectorsView } from './views/ConnectorsView';
import { ConnectorStatusView } from './views/ConnectorStatusView';
import { TenantOwnedFeedView } from './views/TenantOwnedFeedView';
import { WatchlistsView } from './views/WatchlistsView';
import { TeamAccessView } from './views/TeamAccessView';
import { InviteAssistView } from './views/InviteAssistView';
import { TenantSettingsView } from './views/TenantSettingsView';
import { TenantDeleteView } from './views/TenantDeleteView';
import { AnalyticsDashboardView } from './views/AnalyticsDashboardView';
import { AdminOverviewView } from './views/AdminOverviewView';
import { AdminTenantsView } from './views/AdminTenantsView';
import { AdminConnectorsView } from './views/AdminConnectorsView';
import { SocialConnectorDetailsView } from './views/SocialConnectorDetailsView';

const AppRouter: React.FC = () => {
  const { session, activeRoute } = useApp();
  
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch (err) {}
      return next;
    });
  };

  // Robust check for authentication status
  const isAuth = Boolean(
    session.isAuthenticated ?? (session.role !== 'unauthenticated' && !!session.id)
  );

  // If not authenticated, render auth views
  if (!isAuth) {
    if (activeRoute === '/signup' || activeRoute === '/sign-up') {
      return <SignUpView />;
    }
    if (activeRoute === '/signed-out') {
      return <SignedOutView />;
    }
    return <SignInView />;
  }

  // Active authenticated workspace views
  const renderActiveView = () => {
    switch (activeRoute) {
      // Platform Admin Routes
      case '/admin':
      case '/platform-admin':
        return <AdminOverviewView />;
      case '/admin/tenants':
      case '/platform-admin/tenants':
        return <AdminTenantsView />;
      case '/admin/connectors':
      case '/platform-admin/connectors':
        return <AdminConnectorsView />;

      // Tenant Routes
      case '/tenant':
        return <TenantDashboardView />;
      case '/tenant/analytics':
      case '/tenant/post-dashboard':
      case '/analytics':
        return <AnalyticsDashboardView />;
      case '/tenant/posts':
        return <PostsFeedView />;
      case '/tenant/connectors':
        return <ConnectorsView />;
      case '/tenant/connectors/linkedin':
        return <SocialConnectorDetailsView platformId="linkedin" />;
      case '/tenant/connectors/x':
        return <SocialConnectorDetailsView platformId="x" />;
      case '/tenant/connectors/facebook':
        return <SocialConnectorDetailsView platformId="facebook" />;
      case '/tenant/connectors/instagram':
        return <SocialConnectorDetailsView platformId="instagram" />;
      case '/tenant/connectors/youtube':
        return <SocialConnectorDetailsView platformId="youtube" />;
      case '/tenant/connectors/status':
        return <ConnectorStatusView />;
      case '/tenant/connectors/tenant-owned-feed':
        return <TenantOwnedFeedView />;
      case '/tenant/watchlists':
        return <WatchlistsView />;
      case '/tenant/users':
        return <TeamAccessView />;
      case '/tenant/invite-assist':
        return <InviteAssistView />;
      case '/tenant/settings':
        return <TenantSettingsView />;
      case '/tenant/settings/delete':
        return <TenantDeleteView />;

      default:
        if (session.role === 'platform_admin') {
          return <AdminOverviewView />;
        }
        return <TenantDashboardView />;
    }
  };

  const isAnalytics = activeRoute.includes('analytics') || activeRoute.includes('post-dashboard') || activeRoute === '/analytics';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 outline-none"
        >
          <div className="w-full max-w-full px-1">
            {renderActiveView()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
