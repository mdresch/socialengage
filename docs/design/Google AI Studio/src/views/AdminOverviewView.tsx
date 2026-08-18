import React from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  Building2,
  Users,
  Activity,
  AlertTriangle,
  ArrowRight,
  Plus,
  Server,
  Zap,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { RelativeTime } from '../components/RelativeTime';

export const AdminOverviewView: React.FC = () => {
  const { allTenants, connectors, navigateTo, switchTenant } = useApp();

  const totalTenants = allTenants.length;
  const activeTenants = allTenants.filter((t) => t.status === 'active').length;
  const totalSeats = allTenants.reduce((acc, t) => acc + t.licenseSeats, 0);
  const activeSeats = allTenants.reduce((acc, t) => acc + t.activeSeats, 0);
  const failingConnectors = connectors.filter((c) => c.status === 'failing' || c.status === 'degraded');

  return (
    <div className="space-y-6" id="admin-overview-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase bg-purple-100 text-purple-800 border border-purple-200">
              Platform Admin
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Global Platform Overview
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Cross-tenant orchestration, provisioned workspace metrics, and system-wide ingestion pipelines
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigateTo('/admin/tenants')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Provision New Tenant</span>
        </button>
      </div>

      {/* Global Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tenants */}
        <div
          onClick={() => navigateTo('/admin/tenants')}
          className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs hover:border-blue-300 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Tenants
            </span>
            <div className="p-2 rounded-md bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{totalTenants}</span>
            <span className="text-xs text-emerald-600 font-semibold">{activeTenants} active</span>
          </div>
          <div className="mt-2 text-xs text-blue-600 group-hover:underline flex items-center gap-1 font-medium">
            <span>Manage directory</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Global Licensed Seats */}
        <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Global Seats
            </span>
            <div className="p-2 rounded-md bg-purple-50 text-purple-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{activeSeats}</span>
            <span className="text-xs text-slate-500">of {totalSeats} provisioned</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {Math.round((activeSeats / totalSeats) * 100)}% platform capacity
          </div>
        </div>

        {/* Cross-tenant Connectors */}
        <div
          onClick={() => navigateTo('/admin/connectors')}
          className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs hover:border-blue-300 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ingestion Feeds
            </span>
            <div className="p-2 rounded-md bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{connectors.length}</span>
            <span className="text-xs text-slate-500">active channels</span>
          </div>
          <div className="mt-2 text-xs text-blue-600 group-hover:underline flex items-center gap-1 font-medium">
            <span>Inspect health matrix</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Platform Ingestion Rate */}
        <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cognitive Ingestion
            </span>
            <div className="p-2 rounded-md bg-indigo-50 text-indigo-600">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">4,280</span>
            <span className="text-xs text-slate-500">events / hr</span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 font-medium">
            Azure Cognitive AI: 99.98% SLA
          </div>
        </div>
      </div>

      {/* Main Grid: Tenant Quick Access & Global Pipeline Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Provisioned Tenants List */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Provisioned Enterprise Tenants
              </h2>
              <p className="text-xs text-slate-500">
                Switch context or inspect individual workspace isolation
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('/admin/tenants')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>Full Directory</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {allTenants.map((t) => (
              <div
                key={t.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70 px-2 rounded-md transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{t.name}</span>
                    <StatusBadge variant={t.status} size="sm" />
                    <span className="text-[11px] font-mono text-slate-400">@{t.domain}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Plan: <span className="font-semibold text-slate-700">{t.plan}</span> • {t.activeSeats}/{t.licenseSeats} seats allocated
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      switchTenant(t.id);
                      navigateTo('/tenant');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors shadow-xs"
                  >
                    Enter Workspace →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Cross-Tenant Health & Architecture */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100">
              System Ingestion Health
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-600 font-medium">GNews API Poller</span>
                <span className="text-emerald-600 font-semibold">● 140ms</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-600 font-medium">Newswire Feed Reader</span>
                <span className="text-emerald-600 font-semibold">● 85ms</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-600 font-medium">Azure AI Language (NER)</span>
                <span className="text-emerald-600 font-semibold">● 210ms</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-600 font-medium">Azure OpenAI (GPT-4o)</span>
                <span className="text-emerald-600 font-semibold">● 640ms</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigateTo('/admin/connectors')}
              className="w-full mt-2 text-center text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              View Connector Matrix →
            </button>
          </div>

          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 space-y-1">
            <div className="font-semibold">Sovereign Tenant Boundary (ADR-0003)</div>
            <p className="text-[11px] text-purple-800 leading-relaxed">
              Row-level security (RLS) and schema isolation ensure zero cross-tenant data leakage across all cognitive queries.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
