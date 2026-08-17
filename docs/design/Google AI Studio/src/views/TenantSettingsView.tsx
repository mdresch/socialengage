import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Building2,
  Globe,
  Calendar,
  Users,
  Download,
  ShieldAlert,
  ArrowRight,
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';

export const TenantSettingsView: React.FC = () => {
  const { activeTenant, tenantUsers, session, exportTenantData, navigateTo } = useApp();

  const isTenantAdmin = session.role === 'tenant_admin';

  return (
    <div className="space-y-6" id="tenant-settings-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Tenant Settings
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            General workspace metadata, licensed seat parameters, and compliance export utilities
          </p>
        </div>
      </div>

      {/* Workspace Profile Card */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Workspace Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Primary organizational attributes verified via Microsoft Entra
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Workspace Name</span>
            </span>
            <div className="text-sm font-semibold text-slate-900 mt-1">
              {activeTenant?.name}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              <span>Primary Corporate Domain</span>
            </span>
            <div className="text-sm font-mono font-semibold text-slate-900 mt-1">
              {activeTenant?.domain}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span>Assigned Seats</span>
            </span>
            <div className="text-sm font-semibold text-slate-900 mt-1">
              {activeTenant?.activeSeats || tenantUsers.length} of {activeTenant?.licenseSeats || 10} active
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-600" />
              <span>Established On</span>
            </span>
            <div className="text-sm font-semibold text-slate-900 mt-1">
              {activeTenant ? new Date(activeTenant.createdAt).toLocaleDateString() : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Data Export */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Workspace Data Export
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Download full historical archives of watchlists, enriched posts, and connector configs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => exportTenantData('json')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
          >
            <FileJson className="w-4 h-4 text-blue-600" />
            <span>Export Full Workspace (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => exportTenantData('csv')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Matched Posts (CSV)</span>
          </button>
        </div>
      </div>

      {/* Offboarding / Workspace Deletion Section (Tenant Admin only, ADR-0043) */}
      {isTenantAdmin && (
        <div className="bg-rose-50/50 border border-rose-200 rounded-lg p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2 text-rose-900 font-semibold text-sm">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Workspace Offboarding & Self-Service Deletion</span>
            </div>
            <p className="text-xs text-rose-700 leading-relaxed">
              Initiate a standard 30-day grace period offboarding schedule, export company assets, or permanently decommission this tenant container.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigateTo('/tenant/settings/delete')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors shadow-xs whitespace-nowrap"
          >
            <span>Decommission Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
