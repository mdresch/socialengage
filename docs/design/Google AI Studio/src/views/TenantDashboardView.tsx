import React from 'react';
import { useApp } from '../context/AppContext';
import {
  ListFilter,
  Activity,
  Rss,
  Users,
  AlertTriangle,
  ArrowRight,
  Plus,
  Plug,
  ExternalLink,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { RelativeTime } from '../components/RelativeTime';

export const TenantDashboardView: React.FC = () => {
  const {
    activeTenant,
    session,
    watchlists,
    connectors,
    posts,
    tenantUsers,
    navigateTo,
  } = useApp();

  const isTenantAdmin = session.role === 'tenant_admin';

  const activeWatchlistsCount = watchlists.filter((w) => w.isActive).length;
  const activeConnectorsCount = connectors.filter((c) => c.isActive).length;
  const degradedConnectors = connectors.filter(
    (c) => c.isActive && (c.status === 'degraded' || c.status === 'failing')
  );

  const seatPercent = activeTenant
    ? Math.round((activeTenant.activeSeats / activeTenant.licenseSeats) * 100)
    : 0;

  return (
    <div className="space-y-6" id="tenant-overview-page">
      {/* Top Banner / Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Workspace Overview
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Active monitoring operations for <span className="font-semibold text-slate-700">{activeTenant?.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => navigateTo('/tenant/analytics')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 rounded-md hover:bg-slate-900 active:bg-slate-950 transition-colors shadow-xs"
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            <span>Post Analytics</span>
          </button>

          {isTenantAdmin && (
            <>
              <button
                type="button"
                onClick={() => navigateTo('/tenant/watchlists')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Watchlist</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('/tenant/connectors')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
              >
                <Plug className="w-3.5 h-3.5 text-slate-500" />
                <span>Connect Platform</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* State Transparency Alert Banner (if connectors degraded) */}
      {degradedConnectors.length > 0 && (
        <div
          role="alert"
          className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Connector Attention Required ({degradedConnectors.length})
              </h3>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                {degradedConnectors.map((c) => c.name).join(', ')} is currently reporting degraded responses or consecutive retry attempts. Ingestion may experience delays.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('/tenant/connectors/status')}
            className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline underline-offset-2 whitespace-nowrap"
          >
            Review Status →
          </button>
        </div>
      )}

      {/* 4 Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Watchlists */}
        <div
          onClick={() => navigateTo('/tenant/watchlists')}
          className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs hover:border-blue-300 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Watchlists
            </span>
            <div className="p-2 rounded-md bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
              <ListFilter className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {activeWatchlistsCount}
            </span>
            <span className="text-xs text-slate-500">of {watchlists.length} configured</span>
          </div>
          <div className="mt-2 text-xs text-blue-600 group-hover:underline flex items-center gap-1 font-medium">
            <span>Manage match rules</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Connectors */}
        <div
          onClick={() => navigateTo('/tenant/connectors/status')}
          className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs hover:border-blue-300 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ingestion Connectors
            </span>
            <div className="p-2 rounded-md bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {activeConnectorsCount}
            </span>
            <span className="text-xs text-slate-500">active feeds</span>
          </div>
          <div className="mt-2 text-xs text-blue-600 group-hover:underline flex items-center gap-1 font-medium">
            <span>Inspect health status</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Ingested Posts */}
        <div
          onClick={() => navigateTo('/tenant/posts')}
          className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs hover:border-blue-300 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ingested Posts
            </span>
            <div className="p-2 rounded-md bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
              <Rss className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {posts.length}
            </span>
            <span className="text-xs text-slate-500">matched items</span>
          </div>
          <div className="mt-2 text-xs text-blue-600 group-hover:underline flex items-center gap-1 font-medium">
            <span>Browse enriched feed</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Team Seats */}
        <div
          onClick={() => (isTenantAdmin ? navigateTo('/tenant/users') : navigateTo('/tenant/settings'))}
          className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs hover:border-blue-300 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Seat Utilization
            </span>
            <div className="p-2 rounded-md bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {activeTenant?.activeSeats || tenantUsers.length}
            </span>
            <span className="text-xs text-slate-500">
              of {activeTenant?.licenseSeats || 10} licensed
            </span>
          </div>
          <div className="mt-2">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, seatPercent)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Ingestion Stream & Operational Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Ingested Posts Stream Preview */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg shadow-xs p-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Recent Ingestion Stream
              </h2>
              <p className="text-xs text-slate-500">
                Latest social and news monitoring hits enriched with Azure AI
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('/tenant/posts')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>View all posts</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {posts.slice(0, 3).map((post) => (
              <div
                key={post.id}
                onClick={() => navigateTo('/tenant/posts')}
                className="py-4 hover:bg-slate-50/80 -mx-5 px-5 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider font-mono uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      {post.provider}
                    </span>
                    <span className="text-xs font-medium text-slate-700 truncate max-w-[150px]">
                      {post.author}
                    </span>
                  </div>
                  <RelativeTime dateString={post.publishedAt} className="text-xs text-slate-400" />
                </div>

                <h3 className="text-sm font-semibold text-slate-900 line-clamp-1 hover:text-blue-600">
                  {post.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {post.text}
                </p>

                <div className="mt-2.5 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                      post.enrichment.sentiment === 'Positive'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : post.enrichment.sentiment === 'Negative'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {post.enrichment.sentiment} ({(post.enrichment.sentimentScores.positive * 100).toFixed(0)}%)
                  </span>

                  {post.enrichment.entities.slice(0, 2).map((ent, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center text-[10px] bg-slate-50 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded"
                    >
                      {ent.text}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Quick Status & Platform Links */}
        <div className="space-y-6">
          {/* Connector Summary Panel */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-5">
            <h2 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-100">
              Active Connectors
            </h2>
            <div className="space-y-3 mt-3">
              {connectors.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-medium text-slate-700 truncate">{c.name}</span>
                  </div>
                  <StatusBadge variant={c.status} size="sm" />
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigateTo('/tenant/connectors/status')}
                className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Inspect Health & Latency →
              </button>
            </div>
          </div>

          {/* ADR-0027 Compliance Note */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Direct Cloud Billing Model</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              SocialEngage operates as an orchestrator and is not a billing intermediary. All API keys and cognitive endpoints connect directly under your organization's Azure & provider agreements.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
