import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Rss,
  Plug,
  ListFilter,
  Activity,
  Users,
  UserPlus,
  Settings,
  ShieldAlert,
  LayoutDashboard,
  Radio,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed = false, onToggle }) => {
  const { session, activeRoute, navigateTo, inviteCandidates, connectors } = useApp();

  const isPlatformAdmin = session.role === 'platform_admin';
  const isTenantAdmin = session.role === 'tenant_admin';

  // Count degraded or failing connectors
  const degradedConnectorsCount = connectors.filter(
    (c) => c.isActive && (c.status === 'degraded' || c.status === 'failing')
  ).length;

  // Count pending same-domain invite candidates
  const pendingInvitesCount = inviteCandidates.filter((c) => c.status === 'pending').length;

  if (isPlatformAdmin) {
    return (
      <aside
        id="app-sidebar-platform-admin"
        className={`${
          collapsed ? 'w-16' : 'w-60'
        } bg-[#1E293B] border-r border-slate-800 flex flex-col shrink-0 select-none transition-all duration-300`}
      >
        <div className="px-4 py-4 border-b border-slate-800/80 flex items-center justify-between">
          {!collapsed ? (
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Platform Operator Scope
            </span>
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mx-auto" />
          )}
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors ml-1 cursor-pointer"
              title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>
        <nav className="p-3 space-y-1 flex-1">
          <button
            type="button"
            onClick={() => navigateTo('/admin')}
            title="Platform Overview"
            className={`w-full flex items-center ${
              collapsed ? 'justify-center px-1 py-2.5' : 'gap-3 px-3 py-2'
            } text-xs font-medium rounded-md transition-all cursor-pointer ${
              activeRoute === '/admin' || activeRoute === '/platform-admin'
                ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-3 border-blue-500 shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0" />
            {!collapsed && <span className="truncate">Platform Overview</span>}
          </button>
          <button
            type="button"
            onClick={() => navigateTo('/admin/tenants')}
            title="Tenants Directory"
            className={`w-full flex items-center ${
              collapsed ? 'justify-center px-1 py-2.5' : 'gap-3 px-3 py-2'
            } text-xs font-medium rounded-md transition-all cursor-pointer ${
              activeRoute.startsWith('/admin/tenants') || activeRoute.startsWith('/platform-admin/tenants')
                ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-3 border-blue-500 shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 text-blue-400 shrink-0" />
            {!collapsed && <span className="truncate">Tenants Directory</span>}
          </button>
          <button
            type="button"
            onClick={() => navigateTo('/admin/connectors')}
            title="Connector Matrix"
            className={`w-full flex items-center ${
              collapsed ? 'justify-center px-1 py-2.5' : 'gap-3 px-3 py-2'
            } text-xs font-medium rounded-md transition-all cursor-pointer ${
              activeRoute.startsWith('/admin/connectors') || activeRoute.startsWith('/platform-admin/connectors')
                ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-3 border-blue-500 shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Plug className="w-4 h-4 text-blue-400 shrink-0" />
            {!collapsed && <span className="truncate">Connector Matrix</span>}
          </button>
        </nav>

        {collapsed ? (
          <div 
            className="p-4 border-t border-slate-800/80 bg-slate-900/40 flex justify-center" 
            title="Zero Tenant Content Boundary Active (Protected under ADR-0030 §2 & ADR-0041)"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        ) : (
          <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Zero Tenant Content Boundary</span>
            </div>
            <p className="text-slate-500 leading-tight">
              Protected under ADR-0030 §2 & ADR-0041. Tenant posts & credentials isolated.
            </p>
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside
      id="app-sidebar-tenant"
      className={`${
        collapsed ? 'w-16' : 'w-60'
      } bg-[#1E293B] border-r border-slate-800 flex flex-col shrink-0 select-none transition-all duration-300`}
    >
      <div className="px-4 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
        {!collapsed ? (
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
            Workspace Navigation
          </span>
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mx-auto" />
        )}
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors ml-1 cursor-pointer"
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        {/* Workspace Overview */}
        <button
          type="button"
          onClick={() => navigateTo('/tenant')}
          title="Workspace Overview"
          className={`w-full flex items-center ${
            collapsed ? 'justify-center px-1 py-2.5' : 'gap-3 px-3 py-2'
          } text-xs font-medium rounded-md transition-all cursor-pointer ${
            activeRoute === '/tenant'
              ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-3 border-blue-500'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 text-slate-400 shrink-0" />
          {!collapsed && <span>Overview</span>}
        </button>

        {/* Analytics Dashboard (MSE Style Post Dashboard) */}
        <button
          type="button"
          onClick={() => navigateTo('/tenant/analytics')}
          title="Post Analytics"
          className={`w-full flex items-center ${
            collapsed ? 'justify-center px-1 py-2.5' : 'justify-between px-3 py-2'
          } text-xs font-medium rounded-md transition-all cursor-pointer ${
            activeRoute.startsWith('/tenant/analytics') || activeRoute.startsWith('/analytics') || activeRoute.startsWith('/tenant/post-dashboard')
              ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-3 border-blue-500'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="w-4 h-4 text-blue-400 shrink-0" />
            {!collapsed && <span>Post Analytics</span>}
          </div>
          {!collapsed && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              MSE
            </span>
          )}
        </button>

        {/* Posts Feed */}
        <button
          type="button"
          onClick={() => navigateTo('/tenant/posts')}
          title="Posts Feed"
          className={`w-full flex items-center ${
            collapsed ? 'justify-center px-1 py-2.5' : 'justify-between px-3 py-2'
          } text-xs font-medium rounded-md transition-all cursor-pointer ${
            activeRoute.startsWith('/tenant/posts')
              ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-3 border-blue-500'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <Rss className="w-4 h-4 text-slate-400 shrink-0" />
            {!collapsed && <span>Posts</span>}
          </div>
        </button>

        {/* Connect platforms (Tenant Admin only) */}
        {isTenantAdmin && (
          <button
            type="button"
            onClick={() => navigateTo('/tenant/connectors')}
            title="Connect platforms"
            className={`w-full flex items-center ${
              collapsed ? 'justify-center px-1 py-2.5' : 'gap-3 px-3 py-2'
            } text-xs font-medium rounded-md transition-all cursor-pointer ${
              activeRoute === '/tenant/connectors' ||
              activeRoute === '/tenant/connectors/tenant-owned-feed'
                ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-3 border-blue-500'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Plug className="w-4 h-4 text-slate-400 shrink-0" />
            {!collapsed && <span>Connect platforms</span>}
          </button>
        )}

        {/* Watchlists */}
        <button
          type="button"
          onClick={() => navigateTo('/tenant/watchlists')}
          title="Watchlists"
          className={`w-full flex items-center ${
            collapsed ? 'justify-center px-1 py-2.5' : 'gap-3 px-3 py-2'
          } text-xs font-medium rounded-md transition-all cursor-pointer ${
            activeRoute.startsWith('/tenant/watchlists')
              ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-3 border-blue-500'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <ListFilter className="w-4 h-4 text-slate-400 shrink-0" />
          {!collapsed && <span>Watchlists</span>}
        </button>

        {/* Connector status */}
        <button
          type="button"
          onClick={() => navigateTo('/tenant/connectors/status')}
          title="Connector status"
          className={`w-full flex items-center ${
            collapsed ? 'justify-center px-1 py-2.5' : 'justify-between px-3 py-2'
          } text-xs font-medium rounded-md transition-all cursor-pointer relative ${
            activeRoute.startsWith('/tenant/connectors/status')
              ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-3 border-blue-500'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-slate-400 shrink-0" />
            {!collapsed && <span>Connector status</span>}
          </div>
          {degradedConnectorsCount > 0 && (
            collapsed ? (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-400 border border-slate-900" title="Degraded connector alert" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Degraded connector alert" />
            )
          )}
        </button>

        {/* Team & Access (Tenant Admin only) */}
        {isTenantAdmin && (
          <button
            type="button"
            onClick={() => navigateTo('/tenant/users')}
            title="Team & Access"
            className={`w-full flex items-center ${
              collapsed ? 'justify-center px-1 py-2.5' : 'gap-3 px-3 py-2'
            } text-xs font-medium rounded-md transition-all cursor-pointer ${
              activeRoute.startsWith('/tenant/users')
                ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-3 border-blue-500'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 text-slate-400 shrink-0" />
            {!collapsed && <span>Team & Access</span>}
          </button>
        )}

        {/* Invite assist (Tenant Admin only) */}
        {isTenantAdmin && (
          <button
            type="button"
            onClick={() => navigateTo('/tenant/invite-assist')}
            title="Invite assist"
            className={`w-full flex items-center ${
              collapsed ? 'justify-center px-1 py-2.5' : 'justify-between px-3 py-2'
            } text-xs font-medium rounded-md transition-all cursor-pointer relative ${
              activeRoute.startsWith('/tenant/invite-assist')
                ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-3 border-blue-500'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <UserPlus className="w-4 h-4 text-slate-400 shrink-0" />
              {!collapsed && <span>Invite assist</span>}
            </div>
            {pendingInvitesCount > 0 && (
              collapsed ? (
                <span className="absolute top-1 right-2 px-1 text-[8px] font-extrabold bg-blue-500 text-white rounded-full">
                  {pendingInvitesCount}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-500 text-white rounded-full">
                  {pendingInvitesCount}
                </span>
              )
            )}
          </button>
        )}

        {/* Tenant settings */}
        <button
          type="button"
          onClick={() => navigateTo('/tenant/settings')}
          title="Tenant settings"
          className={`w-full flex items-center ${
            collapsed ? 'justify-center px-1 py-2.5' : 'gap-3 px-3 py-2'
          } text-xs font-medium rounded-md transition-all cursor-pointer ${
            activeRoute.startsWith('/tenant/settings')
              ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-3 border-blue-500'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4 text-slate-400 shrink-0" />
          {!collapsed && <span>Tenant settings</span>}
        </button>
      </nav>

      {/* Footer status summary */}
      {collapsed ? (
        <div 
          className="p-3.5 border-t border-slate-800/80 bg-slate-900/30 flex justify-center" 
          title="Live Ingestion Active (azure-cosmos-pg-prod)"
        >
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        </div>
      ) : (
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-900/30 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="font-medium text-slate-300">Live Ingestion Active</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            Endpoint: azure-cosmos-pg-prod
          </div>
        </div>
      )}
    </aside>
  );
};
